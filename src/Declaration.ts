import type { AST, Cast, Limit } from "node-sql-parser";
import type { DatabaseDetails } from "./DatabaseDetails";
import type { ParsedQuery } from "./Parser";
import { isParam, ParamAST, ParamMap } from "./ParamMap";
import { SelectDeclaration } from "./SelectDeclaration";
import { UpdateDeclaration } from "./UpdateDeclaration";
import { Visitor } from "./Visitor";

export const ANON_COLUMN_NAME = "?column?";

export type ResolvedType = Record<string, FieldDetails>;

export type DataType = string | ResolvedType | ArrayWrapper;

export class ArrayWrapper {
	public value: DataType;

	constructor(value: DataType) {
		this.value = value;
	}
}

export type FieldDetails = {
	name: string;
	dataType: DataType;
	isNullable: boolean;
};

export interface Declaration {
	getParsedQuery(): ParsedQuery;
	resolveResultType(): ResolvedType;
	resolveParameterTypes(): ResolvedType;
	isSingleRow(): boolean;
}

export const createDeclaration = (
	databaseDetails: DatabaseDetails,
	parsedQuery: ParsedQuery,
): Declaration | null => {
	switch (parsedQuery.ast.type) {
		case "select":
			return new SelectDeclaration(databaseDetails, parsedQuery);
		case "update":
			return new UpdateDeclaration(databaseDetails, parsedQuery);
		default:
			return null;
	}
};

export const inferParameterTypes = (
	paramMap: ParamMap,
	ast: AST,
	limit: Limit | null,
) => {
	const params: ResolvedType = {};

	// First just make sure we find _all_ the parameters, but don't make
	// any attempt at typechecking
	for (const paramName of paramMap.getParamArray()) {
		params[paramName] = {
			name: paramName,
			dataType: "unknown",
			isNullable: true,
		};
	}

	// If a param if given as the limit then it must be an integer
	// TODO: Handle more complex expressions here
	const limitParam = limit?.value?.[0];
	if (limitParam?.type === "param") {
		const limitParamName = String(limitParam.value);
		params[limitParamName] = {
			name: limitParamName,
			dataType: "integer",
			isNullable: false,
		};
	}

	// Now fill in the types for any parameters with explicit casts
	type CastedParam = Omit<Cast, "expr"> & { expr: ParamAST };
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
			if (
				currentType &&
				currentType.dataType !== dataType &&
				currentType.dataType !== "unknown"
			) {
				throw new Error(`Conflicting types for: ${paramName}`);
			}
			params[paramName] = {
				name: paramName,
				dataType,
				isNullable: true,
			};
		},
	).visit(ast);

	return params;
};
