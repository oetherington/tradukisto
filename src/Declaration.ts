import type { DatabaseDetails } from "./DatabaseDetails";
import type { ParsedQuery } from "./Parser";
import { SelectDeclaration } from "./SelectDeclaration";

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
