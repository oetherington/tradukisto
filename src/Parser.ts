import { AST, Parser } from "node-sql-parser";

const commentedQueryRegex =
	/--\s*@name\s+([a-z][a-zA-Z0-9_]*)\s*\n([\s\S]*?)(?=--\s*@name|\s*$)/gm;

type ParsedQuery = {
	name: string;
	query: string;
	ast: AST;
};

export const parseSql = (sqlQuery: string): ParsedQuery[] => {
	const parser = new Parser();
	const results = Array.from(sqlQuery.matchAll(commentedQueryRegex));
	if (!results) {
		throw new Error("Failed to parse query");
	}
	if (!results.length) {
		throw new Error("No queries found");
	}
	const queries: ParsedQuery[] = results.map((result) => {
		const name = result[1];
		const query = result[2].trim();
		let ast = parser.astify(query, { database: "postgresql" });
		if (Array.isArray(ast)) {
			if (ast.length === 1) {
				ast = ast[0];
			} else {
				throw new Error("Invalid query nesting");
			}
		}
		return {
			name,
			query,
			ast,
		};
	});
	return queries;
};
