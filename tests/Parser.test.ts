import { expect, describe, it } from "vitest";
import { parseSql } from "../src";

describe("Parser", () => {
	it("parser single SQL statement into an AST array", () => {
		const queries = parseSql("-- @query testQuery\nSELECT * FROM users");
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
			-- @query myFirstQuery
			SELECT * FROM users;

			-- @query mySecondQuery
			SELECT * FROM posts;
		`);
		expect(queries.length).toBe(2);
		expect(queries[0].queryName).toBe("myFirstQuery");
		expect(queries[1].queryName).toBe("mySecondQuery");
	});
	it("Parses queries split over multiple lines", () => {
		const queries = parseSql(`
			-- @query testQuery
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
		const queries = parseSql("-- @query testQuery\nSELECT * FROM users");
		expect(queries.length).toBe(1);
		expect(queries[0].queryName).toBe("testQuery");
		expect(queries[0].typeName).toBe("ITestQuery");
	});
	it("Converts named params to numbered params", () => {
		const queries = parseSql("-- @query testQuery\nSELECT :id, :title");
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
	it("Parses the repo name", () => {
		const queries = parseSql("-- @repo Test\n-- @query testQuery\nSELECT 1");
		expect(queries.length).toBe(1);
		expect(queries[0].repoName).toBe("Test");
	});
	it("Parses and expands partials with no arguments", () => {
		const queries = parseSql(`
			-- @partial myFilter()
			verified IS TRUE

			-- @query testQuery
			SELECT id FROM users WHERE myFilter()
		`);
		expect(queries.length).toBe(1);
		expect(queries[0].query).toBe("SELECT id FROM users WHERE verified IS TRUE");
	});
	it("Parses and expands partials with one argument", () => {
		const queries = parseSql(`
			-- @partial myFilter(table)
			table.verified IS TRUE

			-- @query testQuery
			SELECT id FROM users WHERE myFilter(users)
		`);
		expect(queries.length).toBe(1);
		expect(queries[0].query).toBe(
			"SELECT id FROM users WHERE users.verified IS TRUE",
		);
	});
	it("Parses and expands partials with multiple arguments", () => {
		const queries = parseSql(`
			-- @partial myFilter(table , value)
			table.verified IS value

			-- @query testQuery
			SELECT id FROM users WHERE myFilter(users, FALSE)
		`);
		expect(queries.length).toBe(1);
		expect(queries[0].query).toBe(
			"SELECT id FROM users WHERE users.verified IS FALSE",
		);
	});
});
