import type { AST } from "node-sql-parser";
import { describe, expect, it } from "vitest";
import {
	createDeclaration,
	Declaration,
	ParamMap,
	ParsedQuery,
	parseSql,
	ResolvedType,
	TsGenerator,
} from "../src";

class MockDeclaration implements Declaration {
	public parsedQuery: ParsedQuery = {
		queryName: "testQuery",
		typeName: "TestQuery",
		query: "SELECT 1",
		paramMap: new ParamMap(),
		ast: {} as AST,
	};
	public resultType: ResolvedType = {};
	public parameterTypes: ResolvedType = {};

	getParsedQuery() {
		return this.parsedQuery;
	}

	resolveResultType() {
		return this.resultType;
	}

	resolveParameterTypes() {
		return this.parameterTypes;
	}
}

describe("TsGenerator", () => {
	describe("Generates simple Typescript types", () => {
		const types: Record<string, string> = {
			"character varying": "string",
			text: "string",
			integer: "number",
			"double precision": "number",
			boolean: "boolean",
			jsonb: "any", // TODO
			"timestamp with time zone": "Date",
		};
		for (const ty in types) {
			it(ty, () => {
				const generator = new TsGenerator();
				const result = generator.generateType("Test", {
					value: {
						name: "value",
						dataType: ty,
						isNullable: false,
					},
				});
				expect(result).toBe(
					`export interface Test {\n  value: ${types[ty]},\n}`,
				);
			});
		}
	});
	it("Generates nullable Typescript types", () => {
		const generator = new TsGenerator();
		const result = generator.generateType("Test", {
			value: {
				name: "value",
				dataType: "text",
				isNullable: true,
			},
		});
		expect(result).toBe("export interface Test {\n  value: string | null,\n}");
	});
	it("Generates array Typescript types", () => {
		const generator = new TsGenerator();
		const result = generator.generateType("Test", {
			a: {
				name: "a",
				dataType: "text[]",
				isNullable: false,
			},
			b: {
				name: "b",
				dataType: "integer[]",
				isNullable: true,
			},
		});
		expect(result).toBe(
			"export interface Test {\n  a: string[],\n  b: number[] | null,\n}",
		);
	});
	it("Generates nested typesript types", () => {
		const generator = new TsGenerator();
		const result = generator.generateType("Test", {
			outer: {
				name: "outer",
				dataType: {
					inner: {
						name: "inner",
						dataType: "text",
						isNullable: false,
					},
				},
				isNullable: true,
			},
		});
		expect(result).toBe(
			"export interface Test {\n  outer: {\n    inner: string,\n  } | null,\n}",
		);
	});
	it("Other types are `unkown`", () => {
		const generator = new TsGenerator();
		const result = generator.generateType("Test", {
			a: {
				name: "a",
				dataType: "someothertype",
				isNullable: false,
			},
		});
		expect(result).toBe("export interface Test {\n  a: unknown,\n}");
	});
	it("Doesn't allow duplicate declaration names", () => {
		const decl = new MockDeclaration();
		const generator = new TsGenerator();
		generator.addDeclaration(decl.getParsedQuery().queryName, decl);
		expect(() => {
			generator.addDeclaration(decl.getParsedQuery().queryName, decl);
		}).toThrow();
	});
	it("Outputs SQL string", () => {
		const decl = new MockDeclaration();
		const generator = new TsGenerator();
		generator.addDeclaration(decl.getParsedQuery().queryName, decl);
		expect(generator.toString()).toBe(
			"export const testQuerySql = `-- testQuerySql\nSELECT 1`;",
		);
	});
	it("Generates repo", () => {
		const queries = parseSql(`
			-- @repo Test
			-- @name testQuery1
			SELECT 1 AS value;
			-- @name testQuery2
			SELECT :id::TEXT AS value;
		`);
		const decls = queries
			.map((query) => createDeclaration({}, query))
			.filter(Boolean) as Declaration[];
		const generator = new TsGenerator();
		for (const decl of decls) {
			generator.addDeclaration(decl.getParsedQuery().queryName, decl);
		}
		expect(generator.toString("Test")).toContain(`
export class TestRepo {
  protected client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  testQuery1(): Promise<ITestQuery1[]> {
    return this.client.fetchRows(testQuery1Sql);
  }

  testQuery2(params: ITestQuery2Params): Promise<ITestQuery2[]> {
    return this.client.fetchRows(testQuery2Sql, [params.id]);
  }
}`);
	});
});
