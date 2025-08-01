import { describe, expect, it } from "vitest";
import { TsGenerator } from "../src";

describe("TsGenerator", () => {
	describe("Generates simple Typescript types", () => {
		const types: Record<string, string> = {
			"character varying": "string",
			text: "string",
			integer: "number",
			vector: "string[]",
			"double precision": "number",
			boolean: "boolean",
			jsonb: "any", // TODO
			"timestamp with time zone": "Date",
		};
		for (const ty in types) {
			it(ty, () => {
				const generator = new TsGenerator();
				generator.addType("Test", {
					value: {
						name: "value",
						dataType: ty,
						isNullable: false,
					},
				});
				expect(generator.toString()).toBe(
					`export interface Test {\n  value: ${types[ty]},\n}`,
				);
			});
		}
	});
	it("Generates nullable Typescript types", () => {
		const generator = new TsGenerator();
		generator.addType("Test", {
			value: {
				name: "value",
				dataType: "text",
				isNullable: true,
			},
		});
		expect(generator.toString()).toBe(
			"export interface Test {\n  value: string | null,\n}",
		);
	});
	it("Generates array Typescript types", () => {
		const generator = new TsGenerator();
		generator.addType("Test", {
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
		expect(generator.toString()).toBe(
			"export interface Test {\n  a: string[],\n  b: number[] | null,\n}",
		);
	});
	it("Generates nested typesript types", () => {
		const generator = new TsGenerator();
		generator.addType("Test", {
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
		expect(generator.toString()).toBe(
			"export interface Test {\n  outer: {\n    inner: string,\n  } | null,\n}",
		);
	});
	it("Other types are `unkown`", () => {
		const generator = new TsGenerator();
		generator.addType("Test", {
			a: {
				name: "a",
				dataType: "someothertype",
				isNullable: false,
			},
		});
		expect(generator.toString()).toBe(
			"export interface Test {\n  a: unknown,\n}",
		);
	});
	it("Can chain multiple declarations", () => {
		const generator = new TsGenerator();
		generator.addType("Test", {
			a: {
				name: "a",
				dataType: "text",
				isNullable: false,
			},
		});
		generator.addType("Example", {
			b: {
				name: "b",
				dataType: "integer",
				isNullable: false,
			},
		});
		expect(generator.toString()).toBe(
			"export interface Test {\n  a: string,\n}\n\nexport interface Example {\n  b: number,\n}",
		);
	});
	it("Doesn't allow duplicate type names", () => {
		const generator = new TsGenerator();
		generator.addType("Test", {
			a: {
				name: "a",
				dataType: "text",
				isNullable: false,
			},
		});
		expect(() => {
			generator.addType("Test", {
				b: {
					name: "b",
					dataType: "integer",
					isNullable: true,
				},
			});
		}).toThrow();
	});
	it("Outputs SQL string", () => {
		const generator = new TsGenerator();
		generator.addSqlString("testQuerySql", "SELECT * FROM users");
		expect(generator.toString()).toBe(
			"export const testQuerySql = `-- testQuerySql\nSELECT * FROM users`;",
		);
	});
});
