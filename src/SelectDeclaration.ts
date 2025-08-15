import type {
	AggrFunc,
	Binary,
	Cast,
	Column,
	ColumnRefItem,
	ExpressionValue,
	ExprList,
	Function,
	Select,
} from "node-sql-parser";
import {
	databaseDetailsToSources,
	resolveUnqualifiedSource,
	Source,
	Sources,
} from "./Sources";
import {
	ResolvedType,
	FieldDetails,
	Declaration,
	ANON_COLUMN_NAME,
	inferParameterTypes,
	normalizeParamName,
} from "./Declaration";
import { aggregates, chunk, operatorTypes } from "./Helpers";
import type { DatabaseDetails } from "./DatabaseDetails";
import type { ParsedQuery } from "./Parser";

export class SelectDeclaration implements Declaration {
	private databaseDetails: DatabaseDetails;
	private parsedQuery: ParsedQuery;
	private ast: Select;

	constructor(databaseDetails: DatabaseDetails, parsedQuery: ParsedQuery) {
		this.databaseDetails = databaseDetails;
		this.parsedQuery = parsedQuery;
		if (parsedQuery.ast.type === "select") {
			this.ast = parsedQuery.ast;
		} else {
			throw new Error("Invalid select AST");
		}
	}

	getParsedQuery() {
		return this.parsedQuery;
	}

	private resolveExprList(sources: Sources, expr: ExprList) {
		const items = expr.value.flatMap((e: ExpressionValue) =>
			this.resolveExpression(sources, e),
		);
		const result: ResolvedType = {};
		for (const item of items) {
			if (result[item.name]) {
				throw new Error("Duplicate field: " + item.name);
			}
			result[item.name] = item;
		}
		return {
			name: "record",
			dataType: result,
			isNullable: false,
		};
	}

	private starSelectSource({ isNullable, table }: Source): FieldDetails[] {
		const fieldNames = Object.keys(table);
		return fieldNames.map((name) => ({
			name,
			dataType: table[name].dataType,
			isNullable: isNullable || table[name].isNullable,
		}));
	}

	private resolveColumnRef(sources: Sources, item: ColumnRefItem): FieldDetails[] {
		let columnName: string;
		if (typeof item.column === "string") {
			columnName = item.column;
		} else if (
			item.column.expr.type === "default" ||
			item.column.expr.type === "double_quote_string"
		) {
			columnName = item.column.expr.value as string;
		} else {
			throw new Error("Invalid column ref");
		}

		if (!columnName || typeof columnName !== "string") {
			throw new Error("Couldn't find column name");
		}

		const isStarSelect = columnName === "*";

		let source: Source;
		if (item.table) {
			let sourceName = item.table;
			if (!sourceName) {
				throw new Error("Missing source name");
			}
			// The library types say this case should never happen, but
			// empirically it does...
			if (typeof sourceName === "object") {
				const sourceNameObject = sourceName as unknown as {
					type: "default";
					value: string;
				};
				if (sourceNameObject.value) {
					sourceName = sourceNameObject.value;
				}
			}
			source = sources[sourceName];
			if (!source) {
				throw new Error("Missing source: " + JSON.stringify(sourceName));
			}
			if (isStarSelect) {
				return this.starSelectSource(source);
			}
		} else if (isStarSelect) {
			return Object.values(sources).flatMap((source) =>
				this.starSelectSource(source),
			);
		} else {
			source = resolveUnqualifiedSource(sources, columnName);
		}

		const columnDetails = source.table[columnName];
		if (!columnDetails) {
			throw new Error("Column not found: " + columnName);
		}

		return [
			{
				name: columnName,
				dataType: columnDetails.dataType,
				isNullable: columnDetails.isNullable || source.isNullable,
			},
		];
	}

	private resolveJsonBuildObject(
		sources: Sources,
		name: string,
		argList?: ExprList,
	): FieldDetails[] {
		const args = argList?.value ?? [];
		if (!args.length) {
			return [
				{
					name,
					dataType: {},
					isNullable: false,
				},
			];
		}

		const dataType: Record<string, FieldDetails> = {};

		const entries = chunk(args, 2);
		for (const entry of entries) {
			if (entry.length !== 2) {
				throw new Error("json_build_object expected even number of args");
			}
			const nameNode = entry[0];
			if (nameNode.type !== "single_quote_string") {
				return [
					{
						name,
						dataType: "json",
						isNullable: false,
					},
				];
			}
			const fieldName = nameNode.value;
			const valueType = this.resolveExpression(sources, entry[1]);
			if (valueType.length !== 1) {
				throw new Error("json_build_object expected single value");
			}
			dataType[fieldName] = valueType[0];
		}

		return [
			{
				name,
				dataType,
				isNullable: false,
			},
		];
	}

	private resolveFunctionExpression(
		sources: Sources,
		expr: Function,
	): FieldDetails[] {
		const name = expr.name.name[0]?.value ?? "function";
		const nameLower = name.toLowerCase();

		if (
			nameLower === "json_build_object" ||
			nameLower === "jsonb_build_object"
		) {
			return this.resolveJsonBuildObject(sources, name, expr.args);
		}

		const routine = this.databaseDetails.routines[nameLower];
		if (routine) {
			return [
				{
					name,
					dataType: routine.dataType,
					isNullable: true,
				},
			];
		}

		// Anything else is unknown
		return [
			{
				name,
				dataType: "unknown",
				isNullable: false,
			},
		];
	}

	private resolveAggregateExpression(
		sources: Sources,
		expr: AggrFunc,
	): FieldDetails[] {
		const name = expr.name.toLowerCase();
		if (name in aggregates) {
			const handler = aggregates[name];
			const arg = this.resolveExpression(sources, expr.args.expr);
			return [handler(arg[0])];
		}
		return [
			{
				name,
				dataType: "unknown",
				isNullable: false,
			},
		];
	}

	private resolveExpression(
		sources: Sources,
		expr: ExpressionValue,
	): FieldDetails[] {
		switch (expr.type) {
			case "expr_list":
				return [this.resolveExprList(sources, expr as ExprList)];
			case "column_ref":
				return this.resolveColumnRef(sources, expr as ColumnRefItem);
			case "number":
				return [
					{
						name: ANON_COLUMN_NAME,
						dataType: Number.isSafeInteger(expr.value)
							? "integer"
							: "double precision",
						isNullable: false,
					},
				];
			case "single_quote_string":
				return [
					{
						name: ANON_COLUMN_NAME,
						dataType: "text",
						isNullable: false,
					},
				];
			case "cast": {
				const cast = expr as Cast;
				const subexpr = this.resolveExpression(sources, cast.expr);
				const dataType = cast.target[0]?.dataType?.toLowerCase();
				if (!dataType) {
					throw new Error("Can't resolve casted data type");
				}
				return [
					{
						// Casts can have an `as` field, but this isn't in the types
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						name: (cast as any).as ?? ANON_COLUMN_NAME,
						dataType,
						isNullable: subexpr[0]?.isNullable ?? true,
					},
				];
			}
			case "binary_expr": {
				const bin = expr as Binary;
				const left = this.resolveExpression(sources, bin.left);
				const right = this.resolveExpression(sources, bin.right);
				return [
					{
						name: ANON_COLUMN_NAME,
						dataType: operatorTypes[bin.operator] ?? "unknown",
						isNullable: left[0].isNullable || right[0].isNullable,
					},
				];
			}
			case "function":
				return this.resolveFunctionExpression(sources, expr as Function);
			case "aggr_func":
				return this.resolveAggregateExpression(sources, expr as AggrFunc);
			case "param":
				return [
					{
						name: ANON_COLUMN_NAME,
						dataType: "unknown",
						isNullable: normalizeParamName(expr.value).isNullable,
					},
				];
			default:
				throw new Error("Unknown expression type: " + expr.type);
		}
	}

	private resolveColumn(sources: Sources, column: Column): FieldDetails[] {
		if (!column.expr) {
			throw new Error("Column has no expression");
		}
		const result = this.resolveExpression(sources, column.expr);
		if (column.as) {
			if (result.length !== 1) {
				throw new Error("Can't use AS with *");
			}
			if (typeof column.as === "string") {
				result[0].name = column.as;
			} else {
				throw new Error("Complex AS not supported");
			}
		}
		return result;
	}

	resolveResultType(): ResolvedType {
		const { databaseDetails, ast } = this;
		const sources = databaseDetailsToSources(databaseDetails, ast.from);

		const result: ResolvedType = {};
		for (const column of ast.columns) {
			for (const resolvedColumn of this.resolveColumn(sources, column)) {
				if (result[resolvedColumn.name]) {
					throw new Error("Duplicate column: " + resolvedColumn.name);
				}
				result[resolvedColumn.name] = resolvedColumn;
			}
		}
		return result;
	}

	resolveParameterTypes(): ResolvedType {
		return inferParameterTypes(
			this.parsedQuery.paramMap,
			this.ast,
			this.ast.limit,
		);
	}

	getResultType() {
		return this.ast.limit?.value?.[0]?.value === 1 ? "one" : "many";
	}
}
