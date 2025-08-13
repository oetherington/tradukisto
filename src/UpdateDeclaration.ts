import type { Update } from "node-sql-parser";
import type { DatabaseDetails } from "./DatabaseDetails";
import type { ParsedQuery } from "./Parser";
import { inferParameterTypes, Declaration, ResolvedType } from "./Declaration";

export class UpdateDeclaration implements Declaration {
	private databaseDetails: DatabaseDetails;
	private parsedQuery: ParsedQuery;
	private ast: Update;

	constructor(databaseDetails: DatabaseDetails, parsedQuery: ParsedQuery) {
		this.databaseDetails = databaseDetails;
		this.parsedQuery = parsedQuery;
		if (parsedQuery.ast.type === "update") {
			this.ast = parsedQuery.ast;
		} else {
			throw new Error("Invalid update AST");
		}
	}

	getParsedQuery(): ParsedQuery {
		return this.parsedQuery;
	}

	resolveResultType(): ResolvedType {
		if (!this.ast.returning) {
			return {};
		}

		// TODO
		void this.databaseDetails;
		throw new Error("Unimplemented: resolveResultType with 'returning'");
	}

	resolveParameterTypes(): ResolvedType {
		return inferParameterTypes(this.parsedQuery.paramMap, this.ast, null);
	}

	isSingleRow(): boolean {
		// TODO
		return false;
	}
}
