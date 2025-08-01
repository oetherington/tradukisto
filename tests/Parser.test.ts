import { expect, describe, it } from "vitest";
import { parseSql } from "../src";

describe("Parser", () => {
	it("parser single SQL statement into an AST array", () => {
		const queries = parseSql("-- @name testQuery\nSELECT * FROM users");
		expect(queries.length).toBe(1);
		expect(queries[0].queryName).toBe("testQuery");
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
		expect(queries[0].queryName).toBe("myFirstQuery");
		expect(queries[1].queryName).toBe("mySecondQuery");
	});
	it("Parses queries split over multiple lines", () => {
		const queries = parseSql(`
			-- @name testQuery
			SELECT
				name
			FROM
				users
			WHERE
				_id = 0;
		`);
		expect(queries.length).toBe(1);
		expect(queries[0].queryName).toBe("testQuery");
	});
	it("Generates type name from query name", () => {
		const queries = parseSql("-- @name testQuery\nSELECT * FROM users");
		expect(queries.length).toBe(1);
		expect(queries[0].queryName).toBe("testQuery");
		expect(queries[0].typeName).toBe("ITestQuery");
	});
	it("Converts named params to numbered params", () => {
		const queries = parseSql("-- @name testQuery\nSELECT :id, :title");
		expect(queries.length).toBe(1);
		const query = queries[0];
		expect(query.query).toBe("SELECT $1, $2");
		expect(query.paramMap.count()).toBe(2);
		expect(query.paramMap.getParamArray()).toStrictEqual(["id", "title"]);
		expect(query.paramMap.getParamMap()).toStrictEqual({ id: 1, title: 2 });
		expect(query.paramMap.getParamIndex("id")).toBe(1);
		expect(query.paramMap.getParamIndex("title")).toBe(2);
		expect(query.paramMap.getParamName(1)).toBe("id");
		expect(query.paramMap.getParamName(2)).toBe("title");
	});
});
