import { describe, expect, it } from "vitest";
import {
	createDeclaration,
	parseSql,
	StringCompilationUnit,
	UpdateDeclaration,
} from "../src";

describe("UpdateDeclaration", () => {
	const parseSingle = async (sql: string) => {
		const unit = new StringCompilationUnit("-- @query testUpdate\n" + sql);
		const queries = await parseSql(unit);
		expect(queries.length).toBe(1);
		return queries[0];
	};

	it("Parses simple udpate query", async () => {
		const decl = createDeclaration(
			{ tables: {}, routines: {} },
			await parseSingle(
				"UPDATE users SET name = :name::TEXT WHERE id = :id::INTEGER",
			),
		);
		expect(decl).not.toBeNull();
		expect(decl).toBeInstanceOf(UpdateDeclaration);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const resultType = decl!.resolveResultType();
		expect(resultType).toStrictEqual({});
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const parameterType = decl!.resolveParameterTypes();
		expect(parameterType).toStrictEqual({
			id: {
				name: "id",
				dataType: "integer",
				isNullable: true,
			},
			name: {
				name: "name",
				dataType: "text",
				isNullable: true,
			},
		});
	});
});
