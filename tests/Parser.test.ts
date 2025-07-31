import { expect, describe, it } from 'vitest'
import { parseSql } from "../src";

describe("Parser", () => {
	it("parser single SQL statement into an AST array", () => {
		const ast = parseSql("SELECT * FROM users");
		expect(ast).toStrictEqual([
			{
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
						table: 'users',
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
			},
		]);
	});
	it("parser multiple SQL statement into an AST array", () => {
		const ast = parseSql("SELECT 1; SELECT 2;");
		expect(ast).toStrictEqual([
			{
				columns: [
					{
						as: null,
						expr: {
							type: 'number',
							value: 1
						},
						type: 'expr'
					}
				],
				distinct: {
					type: null
				},
				from: null,
				groupby: null,
				having: null,
				into: {
					position: null
				},
				limit: {
					seperator: '',
					value: []
				},
				options: null,
				orderby: null,
				type: 'select',
				where: null,
				window: null,
				with: null
			},
			{
				columns: [
					{
						as: null,
						expr: {
							type: 'number',
							value: 2
						},
						type: 'expr'
					}
				],
				distinct: {
					type: null
				},
				from: null,
				groupby: null,
				having: null,
				into: {
					position: null
				},
				limit: {
					seperator: '',
					value: []
				},
				options: null,
				orderby: null,
				type: 'select',
				where: null,
				window: null,
				with: null
			}
		]);
	});
});
