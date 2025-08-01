import type { AST } from "node-sql-parser";
import type { DatabaseDetails } from "./DatabaseDetails";
import type { ParamMap } from "./ParamMap";
import { SelectDeclaration } from "./SelectDeclaration";

export type FieldDetails = {
	name: string;
	dataType: string | Record<string, FieldDetails>;
	isNullable: boolean;
};

export type ResolvedType = Record<string, FieldDetails>;

export interface Declaration {
	resolveResultType(): ResolvedType;
	resolveParameterTypes(): ResolvedType;
}

export const createDeclaration = (
	databaseDetails: DatabaseDetails,
	ast: AST,
	paramMap: ParamMap,
): Declaration | null => {
	switch (ast.type) {
		case "select":
			return new SelectDeclaration(databaseDetails, ast, paramMap);
		default:
			return null;
	}
};
