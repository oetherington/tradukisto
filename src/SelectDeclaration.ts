import type {
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

export class SelectDeclaration {
	private databaseDetails: DatabaseDetails;
	private ast: Select;

	constructor(
		databaseDetails: DatabaseDetails,
		ast: Select
	) {
		this.databaseDetails = databaseDetails;
		this.ast = ast;
	}

	private resolveExprList(sources: Sources, expr: ExprList) {
		const items = expr.value.map(
			(e: ExpressionValue) => this.resolveExpression(sources, e),
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

	private resolveColumnRef(
		sources: Sources,
		item: ColumnRefItem,
	): FieldDetails {
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

		let source: Source;
		if (item.table) {
			const sourceName = item.table;
			if (!sourceName) {
				throw new Error("Missing source name");
			}
			source = sources[sourceName];
			if (!source) {
				throw new Error("Missing source: " + sourceName);
			}
		} else {
			source = resolveUnqualifiedSource(sources, columnName);
		}

		const columnDetails = source.table[columnName];
		if (!columnDetails) {
			throw new Error("Column not found: " + columnName);
		}

		return {
			name: columnName,
			dataType: columnDetails.dataType,
			isNullable: columnDetails.isNullable || source.isNullable,
		};
	}

	private resolveExpression(
		sources: Sources,
		expr: ExpressionValue,
	): FieldDetails {
		switch (expr.type) {
		case "expr_list":
			return this.resolveExprList(sources, expr as ExprList);
		case "column_ref":
			return this.resolveColumnRef(sources, expr as ColumnRefItem);
		default:
			throw new Error("Unknown expression type: " + expr.type);
		}
	};

	private resolveColumn(sources: Sources, column: Column): FieldDetails {
		if (!column.expr) {
			throw new Error("Column has no expression");
		}
		const result = this.resolveExpression(sources, column.expr);
		if (column.as) {
			if (typeof column.as === "string") {
				result.name = column.as;
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
			const resolvedColumn = this.resolveColumn(sources, column);
			if (result[resolvedColumn.name]) {
				throw new Error("Duplicate column: " + resolvedColumn.name);
			}
			result[resolvedColumn.name] = resolvedColumn;
		}
		return result;
	}
}
