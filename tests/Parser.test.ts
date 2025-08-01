import { expect, describe, it } from "vitest";
import { parseSql } from "../src";

describe("Parser", () => {
	it("parser single SQL statement into an AST array", () => {
		const queries = parseSql("-- @name testQuery\nSELECT * FROM users");
		expect(queries.length).toBe(1);
		expect(queries[0].name).toBe("testQuery");
		expect(queries[0].ast).toStrictEqual({
			type: "select",
			where: null,
			window: null,
			with: null,
			columns: [
				{
					as: null,
					expr: {
						type: "column_ref",
						column: "*",
						table: null,
					},
				},
			],
			distinct: {
				type: null,
			},
			from: [
				{
					table: "users",
					as: null,
					db: null,
				},
			],
			groupby: null,
			having: null,
			into: {
				position: null,
			},
			limit: {
				seperator: "",
				value: [],
			},
			options: null,
			orderby: null,
		});
	});
	it("Names multiple queries from comments", () => {
		const queries = parseSql(`
			-- @name myFirstQuery
			SELECT * FROM users;

			-- @name mySecondQuery
			SELECT * FROM posts;
		`);
		expect(queries.length).toBe(2);
		expect(queries[0].name).toBe("myFirstQuery");
		expect(queries[1].name).toBe("mySecondQuery");
	});
});
