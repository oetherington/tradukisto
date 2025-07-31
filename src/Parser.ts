import Parser, { type AST } from "node-sql-parser";

export const parseSql = (sql: string): AST[] => {
	const parser = new Parser.Parser();
	const result = parser.astify(sql, {
		database: "Postgresql",
		parseOptions: {
			includeLocations: true,
		},
	});
	return Array.isArray(result) ? result : [result];
};
