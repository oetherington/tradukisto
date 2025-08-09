import { describe, expect, it } from "vitest";
import {
	createDeclaration,
	parseSql,
	ResolvedType,
	SelectDeclaration,
} from "../src";

describe("SelectDeclaration", () => {
	const parseSingle = (sql: string) => {
		const queries = parseSql("-- @query testQuery\n" + sql);
		expect(queries.length).toBe(1);
		return queries[0];
	};

	describe("Resolves simple named fields", () => {
		const simpleFieldTestQueries: Record<string, string> = {
			noQuotes: `SELECT id FROM users`,
			fieldQuotes: `SELECT "id" FROM users`,
			tableQuotes: `SELECT id FROM "users"`,
			fieldQuotesTableQuotes: `SELECT "id" FROM "users"`,
			qualifiedNoQuotes: `SELECT users.id FROM users`,
			qualifiedFieldQuotes: `SELECT users."id" FROM users`,
			qualifiedTableQuotes: `SELECT users.id FROM "users"`,
			qualifiedFieldQuotesTableQuotes: `SELECT users."id" FROM "users"`,
			quotesQualifiedNoQuotes: `SELECT "users".id FROM users`,
			quotesQualifiedFieldQuotes: `SELECT "users"."id" FROM users`,
			quotesQualifiedTableQuotes: `SELECT "users".id FROM "users"`,
			quotesQualifiedFieldQuotesTableQuotes: `SELECT "users"."id" FROM "users"`,
			aliasNoQuotes: `SELECT u.id FROM users u`,
			aliasFieldQuotes: `SELECT u."id" FROM users u`,
			aliasTableQuotes: `SELECT u.id FROM "users" u`,
			aliasFieldQuotesTableQuotes: `SELECT u."id" FROM "users" u`,
			quotedAliasNoQuotes: `SELECT "u".id FROM users u`,
			quotedAliasFieldQuotes: `SELECT "u"."id" FROM users u`,
			quotedAliasTableQuotes: `SELECT "u".id FROM "users" u`,
			quotedAliasFieldQuotesTableQuotes: `SELECT "u"."id" FROM "users" u`,
		};
		for (const testName in simpleFieldTestQueries) {
			it(testName, () => {
				const testQuery = simpleFieldTestQueries[testName];
				const decl = createDeclaration(
					{
						tables: {
							users: {
								id: {
									tableName: "users",
									columnName: "id",
									dataType: "text",
									isNullable: false,
								},
							},
						},
						routines: {},
					},
					parseSingle(testQuery),
				);
				expect(decl).not.toBeNull();
				expect(decl).toBeInstanceOf(SelectDeclaration);
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const resultType = decl!.resolveResultType();
				expect(resultType).toStrictEqual({
					id: {
						name: "id",
						dataType: "text",
						isNullable: false,
					},
				});
			});
		}
	});

	it("Resolves unqualified star fields", () => {
		const decl = createDeclaration(
			{
				tables: {
					users: {
						id: {
							tableName: "users",
							columnName: "id",
							dataType: "integer",
							isNullable: false,
						},
						name: {
							tableName: "users",
							columnName: "name",
							dataType: "text",
							isNullable: false,
						},
					},
					posts: {
						userId: {
							tableName: "posts",
							columnName: "userId",
							dataType: "integer",
							isNullable: true,
						},
					},
				},
				routines: {},
			},
			parseSingle("SELECT * FROM users JOIN posts"),
		);
		expect(decl).not.toBeNull();
		expect(decl).toBeInstanceOf(SelectDeclaration);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const resultType = decl!.resolveResultType();
		expect(resultType).toStrictEqual({
			id: {
				name: "id",
				dataType: "integer",
				isNullable: false,
			},
			name: {
				name: "name",
				dataType: "text",
				isNullable: false,
			},
			userId: {
				name: "userId",
				dataType: "integer",
				isNullable: true,
			},
		});
	});

	it("Resolves qualified star fields", () => {
		const decl = createDeclaration(
			{
				tables: {
					users: {
						id: {
							tableName: "users",
							columnName: "id",
							dataType: "integer",
							isNullable: false,
						},
						name: {
							tableName: "users",
							columnName: "name",
							dataType: "text",
							isNullable: false,
						},
					},
					posts: {
						userId: {
							tableName: "posts",
							columnName: "userId",
							dataType: "integer",
							isNullable: true,
						},
					},
				},
				routines: {},
			},
			parseSingle("SELECT users.* FROM users JOIN posts"),
		);
		expect(decl).not.toBeNull();
		expect(decl).toBeInstanceOf(SelectDeclaration);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const resultType = decl!.resolveResultType();
		expect(resultType).toStrictEqual({
			id: {
				name: "id",
				dataType: "integer",
				isNullable: false,
			},
			name: {
				name: "name",
				dataType: "text",
				isNullable: false,
			},
		});
	});

	it("Star fields disallow conflicts", () => {
		const decl = createDeclaration(
			{
				tables: {
					users: {
						id: {
							tableName: "users",
							columnName: "id",
							dataType: "integer",
							isNullable: false,
						},
						name: {
							tableName: "users",
							columnName: "name",
							dataType: "text",
							isNullable: false,
						},
					},
					posts: {
						id: {
							tableName: "posts",
							columnName: "id",
							dataType: "integer",
							isNullable: true,
						},
					},
				},
				routines: {},
			},
			parseSingle("SELECT * FROM users JOIN posts"),
		);
		expect(decl).not.toBeNull();
		expect(decl).toBeInstanceOf(SelectDeclaration);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(() => decl!.resolveResultType()).toThrow();
	});

	describe("Resolves paramater types", () => {
		type ParameterTestCase = {
			query: string;
			expectedParameters: ResolvedType;
		};
		const parameterTestCases: Record<string, ParameterTestCase> = {
			booleanExpression: {
				query: "SELECT * FROM users WHERE :id",
				expectedParameters: {
					id: { name: "id", dataType: "unknown", isNullable: true },
				},
			},
			simpleEqualityExpression: {
				query: "SELECT * FROM users WHERE id = :id",
				expectedParameters: {
					id: { name: "id", dataType: "unknown", isNullable: true },
				},
			},
			castExpression: {
				query: "SELECT * FROM users WHERE id = :id::TEXT",
				expectedParameters: {
					id: { name: "id", dataType: "text", isNullable: true },
				},
			},
			paramInSelectedColumn: {
				query: 'SELECT *, :value AS "value" FROM users',
				expectedParameters: {
					value: { name: "value", dataType: "unknown", isNullable: true },
				},
			},
		};

		for (const testName in parameterTestCases) {
			const { query, expectedParameters } = parameterTestCases[testName];
			it(testName, () => {
				const decl = createDeclaration(
					{
						tables: {
							users: {
								id: {
									tableName: "users",
									columnName: "id",
									dataType: "text",
									isNullable: false,
								},
							},
						},
						routines: {},
					},
					parseSingle(query),
				);
				expect(decl).not.toBeNull();
				expect(decl).toBeInstanceOf(SelectDeclaration);
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const parameterTypes = decl!.resolveParameterTypes();
				expect(parameterTypes).toStrictEqual(expectedParameters);
			});
		}

		it("Disallows conflicting casts", () => {
			const decl = createDeclaration(
				{
					tables: {
						users: {
							id: {
								tableName: "users",
								columnName: "id",
								dataType: "text",
								isNullable: false,
							},
						},
					},
					routines: {},
				},
				parseSingle(
					"SELECT *, :value::TEXT FROM users WHERE :value::BOOLEAN",
				),
			);
			expect(decl).not.toBeNull();
			expect(decl).toBeInstanceOf(SelectDeclaration);
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			expect(() => decl!.resolveParameterTypes()).toThrow();
		});
	});

	describe("Selects expressions", () => {
		type ExpressionTestCase = {
			query: string;
			expectedDataType: string;
			isNullable?: boolean;
		};
		const expressionTestCases: Record<string, ExpressionTestCase> = {
			"Integer literals": {
				query: "SELECT 1 AS value",
				expectedDataType: "integer",
			},
			"Float literals": {
				query: "SELECT 1.2 AS value",
				expectedDataType: "double precision",
			},
			"String literals": {
				query: "SELECT 'foobar' AS value",
				expectedDataType: "text",
			},
			"Casted values": {
				query: "SELECT (1.2)::INTEGER AS value",
				expectedDataType: "integer",
			},
			Params: {
				query: "SELECT :id AS value",
				expectedDataType: "unknown",
				isNullable: true,
			},
			"Function calls": {
				query: "SELECT PI() AS value",
				expectedDataType: "double precision",
				isNullable: true,
			},
		};
		for (const testName in expressionTestCases) {
			it(testName, () => {
				const testCase = expressionTestCases[testName];
				const database = {
					tables: {},
					routines: {
						pi: {
							name: "pi",
							dataType: "double precision",
						},
					},
				};
				const decl = createDeclaration(
					database,
					parseSingle(testCase.query),
				);
				expect(decl).not.toBeNull();
				expect(decl).toBeInstanceOf(SelectDeclaration);
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const resultType = decl!.resolveResultType();
				expect(resultType).toStrictEqual({
					value: {
						name: "value",
						dataType: testCase.expectedDataType,
						isNullable: testCase.isNullable ?? false,
					},
				});
			});
		}
	});

	describe("Can infer types of basic JSON functions", () => {
		it("jsonb_build_object", () => {
			const decl = createDeclaration(
				{
					tables: {
						users: {
							id: {
								tableName: "users",
								columnName: "id",
								dataType: "integer",
								isNullable: false,
							},
							name: {
								tableName: "users",
								columnName: "name",
								dataType: "text",
								isNullable: false,
							},
						},
					},
					routines: {},
				},
				parseSingle(`
					SELECT jsonb_build_object('id', u.id, 'name', u.name) user
					FROM users u
				`),
			);
			expect(decl).not.toBeNull();
			expect(decl).toBeInstanceOf(SelectDeclaration);
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const resultType = decl!.resolveResultType();
			expect(resultType).toStrictEqual({
				user: {
					name: "user",
					dataType: {
						id: {
							name: "id",
							dataType: "integer",
							isNullable: false,
						},
						name: {
							name: "name",
							dataType: "text",
							isNullable: false,
						},
					},
					isNullable: false,
				},
			});
		});
	});

	it("Can infer types numeric operations", () => {
		const decl = createDeclaration(
			{ tables: {}, routines: {} },
			parseSingle("SELECT 1 + 2 - 3 * 4 / 5 % 6 AS value"),
		);
		expect(decl).not.toBeNull();
		expect(decl).toBeInstanceOf(SelectDeclaration);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const resultType = decl!.resolveResultType();
		expect(resultType).toStrictEqual({
			value: {
				name: "value",
				dataType: "double precision",
				isNullable: false,
			},
		});
	});
});
