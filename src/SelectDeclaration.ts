import type {
	Cast,
	Column,
	ColumnRefItem,
	ExpressionValue,
	ExprList,
	Select,
} from "node-sql-parser";
import {
	databaseDetailsToSources,
	resolveUnqualifiedSource,
	Source,
	Sources,
} from "./Sources";
import type { DatabaseDetails } from "./DatabaseDetails";
import type { ResolvedType, FieldDetails } from "./Declaration";
import { Visitor } from "./Visitor";

export class SelectDeclaration {
	private databaseDetails: DatabaseDetails;
	private ast: Select;

	constructor(databaseDetails: DatabaseDetails, ast: Select) {
		this.databaseDetails = databaseDetails;
		this.ast = ast;
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
			// The librarry types say this case should never happen, but
			// empirically is does...
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

	private resolveExpression(
		sources: Sources,
		expr: ExpressionValue,
	): FieldDetails[] {
		switch (expr.type) {
			case "expr_list":
				return [this.resolveExprList(sources, expr as ExprList)];
			case "column_ref":
				return this.resolveColumnRef(sources, expr as ColumnRefItem);
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

	resolveParameterTypes(): Record<string, string | null> {
		const params: Record<string, string | null> = {};

		// First just make sure we find _all_ the parameters, but don't make
		// any attempt at typechecking
		type Param = { type: "param"; value: string };
		const isParam = (value: unknown): value is Param =>
			!!value &&
			typeof value === "object" &&
			"type" in value &&
			value.type === "param" &&
			"value" in value &&
			!!value.value &&
			typeof value.value === "string";
		new Visitor<Param>(isParam, (value) => (params[value.value] = null)).visit(
			this.ast,
		);

		// Now fill in the types for any parameters with explicit casts
		type CastedParam = Omit<Cast, "expr"> & { expr: Param };
		new Visitor<CastedParam>(
			(value): value is CastedParam =>
				!!value &&
				typeof value === "object" &&
				"type" in value &&
				value.type === "cast" &&
				"expr" in value &&
				isParam(value.expr),
			(value) => {
				const paramName = value.expr.value;
				const dataType = value.target[0]?.dataType?.toLowerCase();
				if (!paramName || !dataType) {
					throw new Error("Invalid cast expression");
				}
				const currentType = params[paramName];
				if (currentType && currentType !== dataType) {
					throw new Error(`Conflicting types for :${paramName}`);
				}
				params[paramName] = dataType;
			},
		).visit(this.ast);

		// If everything was explicitely casted then we're done
		if (Object.values(params).every((value) => !!value)) {
			return params;
		}

		// Finally add some special cases to try to figure out as many types as
		// possible
		// TODO

		return params;
	}
}
