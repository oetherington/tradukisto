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

type DeclarationResultType = "none" | "one" | "many";

export interface Declaration {
	getParsedQuery(): ParsedQuery;
	resolveResultType(): ResolvedType;
	resolveParameterTypes(): ResolvedType;
	getResultType(): DeclarationResultType;
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

type NormalizedParamName = {
	name: string;
	isNullable: boolean;
};

export const normalizeParamName = (paramName: string): NormalizedParamName => {
	const isNullable = paramName.endsWith("_");
	const name = isNullable ? paramName.slice(0, paramName.length - 1) : paramName;
	return { name, isNullable };
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
		const { name, isNullable } = normalizeParamName(paramName);
		params[name] = {
			name,
			dataType: "unknown",
			isNullable,
		};
	}

	// If a param if given as the limit then it must be an integer
	// TODO: Handle more complex expressions here
	for (const limitParam of limit?.value ?? []) {
		if (limitParam?.type === "param") {
			const { name, isNullable } = normalizeParamName(
				String(limitParam.value),
			);
			params[name] = {
				name,
				dataType: "integer",
				isNullable,
			};
		}
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
			const { name, isNullable } = normalizeParamName(value.expr.value);
			const dataType = value.target[0]?.dataType?.toLowerCase();
			if (!name || !dataType) {
				throw new Error("Invalid cast expression");
			}
			const currentType = params[name];
			if (
				currentType &&
				currentType.dataType !== dataType &&
				currentType.dataType !== "unknown"
			) {
				throw new Error(`Conflicting types for: ${name}`);
			}
			params[name] = {
				name,
				dataType,
				isNullable,
			};
		},
	).visit(ast);

	return params;
};
