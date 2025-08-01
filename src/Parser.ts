import { AST, Parser } from "node-sql-parser";

const commentedQueryRegex =
	/--\s*@name\s+([a-z][a-zA-Z0-9_]*)\s*\r?\n((?:(?!--\s*@name).|\s)*)/gm;

type ParsedQuery = {
	queryName: string;
	typeName: string;
	query: string;
	ast: AST;
};

export const parseSql = (sqlQuery: string): ParsedQuery[] => {
	const parser = new Parser();
	const results = Array.from(sqlQuery.matchAll(commentedQueryRegex));
	if (!results?.length) {
		throw new Error("No queries found");
	}
	const queries: ParsedQuery[] = results.map((result) => {
		const queryName = result[1];
		const typeName = `I${queryName[0].toUpperCase()}${queryName.slice(1)}`;
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
			queryName,
			typeName,
			query,
			ast,
		};
	});
	return queries;
};
