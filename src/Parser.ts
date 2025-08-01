import { AST, Parser } from "node-sql-parser";
import { Visitor } from "./Visitor";
import { isParam, ParamAST, ParamMap } from "./ParamMap";

const commentedQueryRegex =
	/--\s*@name\s+([a-z][a-zA-Z0-9_]*)\s*\r?\n((?:(?!--\s*@name).|\s)*)/gm;

type ParsedQuery = {
	queryName: string;
	typeName: string;
	query: string;
	paramMap: ParamMap;
	ast: AST;
};

export const parseSql = (sqlQuery: string): ParsedQuery[] => {
	const parser = new Parser();
	const results = Array.from(sqlQuery.matchAll(commentedQueryRegex));
	if (!results?.length) {
		throw new Error("No queries found");
	}

	const parserOptions = { database: "postgresql" };

	const queries: ParsedQuery[] = results.map((result) => {
		// Get the query name, type name and raw query from the regex.
		const queryName = result[1];
		const typeName = `I${queryName[0].toUpperCase()}${queryName.slice(1)}`;
		const rawQuery = result[2].trim();

		// Parse the query into an AST.
		let ast = parser.astify(rawQuery, parserOptions);
		if (Array.isArray(ast)) {
			if (ast.length === 1) {
				ast = ast[0];
			} else {
				throw new Error("Invalid query nesting");
			}
		}

		// Find all the parameters and number them (1-indexed). Update the
		// query to use numbered parameters instead of named.
		const transformedAst = structuredClone(ast);
		const paramMap = new ParamMap();
		new Visitor<ParamAST>(isParam, (value) => {
			paramMap.add(value.value);
			value.value = String(paramMap.getParamIndex(value.value));
			value.prefix = "$";
		}).visit(transformedAst);

		// Now regenerate the query with the new parameters
		const query = paramMap.count()
			? parser.sqlify(transformedAst, parserOptions)
			: rawQuery;

		return {
			queryName,
			typeName,
			query,
			paramMap,
			ast,
		};
	});

	return queries;
};
