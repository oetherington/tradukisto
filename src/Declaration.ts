import type { AST } from "node-sql-parser";
import type { DatabaseDetails } from "./DatabaseDetails";
import { SelectDeclaration } from "./SelectDeclaration";

export type FieldDetails = {
	name: string;
	dataType: string | Record<string, FieldDetails>;
	isNullable: boolean;
};

export type ResolvedType = Record<string, FieldDetails>;

export interface Declaration {
	resolveResultType(): ResolvedType;
	resolveParameterTypes(): Record<string, string | null>;
}

export const createDeclaration = (
	databaseDetails: DatabaseDetails,
	ast: AST,
): Declaration | null => {
	switch (ast.type) {
		case "select":
			return new SelectDeclaration(databaseDetails, ast);
		default:
			return null;
	}
};
