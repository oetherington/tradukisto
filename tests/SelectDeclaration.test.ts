import { describe, expect, it } from "vitest";
import { createDeclaration, parseSql, SelectDeclaration } from "../src";

describe("SelectDeclaration", () => {
	describe("Resolves simple named fields", () => {
		const simpleFieldTestQueries = {
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
						users: {
							id: {
								tableName: "users",
								columnName: "id",
								dataType: "text",
								isNullable: false,
							},
						},
					},
					parseSql(testQuery)[0],
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
			parseSql("SELECT * FROM users JOIN posts")[0],
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
			parseSql("SELECT users.* FROM users JOIN posts")[0],
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
			parseSql("SELECT * FROM users JOIN posts")[0],
		);
		expect(decl).not.toBeNull();
		expect(decl).toBeInstanceOf(SelectDeclaration);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(() => decl!.resolveResultType()).toThrow();
	});

	describe("Resolves paramater types", () => {
		type ParameterTestCase = {
			query: string;
			expectedParameters: Record<string, string | null>;
		};
		const parameterTestCases: Record<string, ParameterTestCase> = {
			booleanExpression: {
				query: "SELECT * FROM users WHERE :id",
				expectedParameters: { id: null },
			},
			simpleEqualityExpression: {
				query: "SELECT * FROM users WHERE id = :id",
				expectedParameters: { id: null },
			},
			castExpression: {
				query: "SELECT * FROM users WHERE id = :id::TEXT",
				expectedParameters: { id: "text" },
			},
			paramInSelectedColumn: {
				query: 'SELECT *, :value AS "value" FROM users',
				expectedParameters: { value: null },
			},
		};

		// console.log(parseSql("SELECT * FROM users WHERE id = :id::TEXT")[0].where);
		for (const testName in parameterTestCases) {
			const { query, expectedParameters } = parameterTestCases[testName];
			it(testName, () => {
				const decl = createDeclaration(
					{
						users: {
							id: {
								tableName: "users",
								columnName: "id",
								dataType: "text",
								isNullable: false,
							},
						},
					},
					parseSql(query)[0],
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
					users: {
						id: {
							tableName: "users",
							columnName: "id",
							dataType: "text",
							isNullable: false,
						},
					},
				},
				parseSql(
					"SELECT *, :value::TEXT FROM users WHERE :value::BOOLEAN",
				)[0],
			);
			expect(decl).not.toBeNull();
			expect(decl).toBeInstanceOf(SelectDeclaration);
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			expect(() => decl!.resolveParameterTypes()).toThrow();
		});
	});
});
