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
});
