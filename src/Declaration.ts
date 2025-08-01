import type { DatabaseDetails } from "./DatabaseDetails";
import type { ParsedQuery } from "./Parser";
import { SelectDeclaration } from "./SelectDeclaration";

export const ANON_COLUMN_NAME = "?column?";

export type FieldDetails = {
	name: string;
	dataType: string | Record<string, FieldDetails>;
	isNullable: boolean;
};

export type ResolvedType = Record<string, FieldDetails>;

export interface Declaration {
	getParsedQuery(): ParsedQuery;
	resolveResultType(): ResolvedType;
	resolveParameterTypes(): ResolvedType;
}

export const createDeclaration = (
	databaseDetails: DatabaseDetails,
	parsedQuery: ParsedQuery,
): Declaration | null => {
	switch (parsedQuery.ast.type) {
		case "select":
			return new SelectDeclaration(databaseDetails, parsedQuery);
		default:
			return null;
	}
};
