import { describe, expect, it } from "vitest";
import { PglitePostgresClient } from "./PglitePostgresClient";
import { buildDatabaseDetails, fetchDatabaseDetails } from "../src";

describe("DatabaseDetails", () => {
	it("Converts empty details to empty database details", () => {
		const result = buildDatabaseDetails([], []);
		expect(result).toStrictEqual({ tables: {}, routines: {} });
	});
	it("Converts column details to database details", () => {
		const result = buildDatabaseDetails(
			[
				{
					tableName: "users",
					columnName: "id",
					dataType: "integer",
					isNullable: false,
				},
				{
					tableName: "users",
					columnName: "name",
					dataType: "text",
					isNullable: false,
				},
				{
					tableName: "transactions",
					columnName: "id",
					dataType: "integer",
					isNullable: false,
				},
				{
					tableName: "transactions",
					columnName: "timestamp",
					dataType: "timestamp with time zone",
					isNullable: true,
				},
			],
			[
				{
					name: "pi",
					dataType: "double precision",
				},
				{
					name: "time",
					dataType: "time without time zone",
				},
			],
		);
		expect(result).toStrictEqual({
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
				transactions: {
					id: {
						tableName: "transactions",
						columnName: "id",
						dataType: "integer",
						isNullable: false,
					},
					timestamp: {
						tableName: "transactions",
						columnName: "timestamp",
						dataType: "timestamp with time zone",
						isNullable: true,
					},
				},
			},
			routines: {
				pi: {
					name: "pi",
					dataType: "double precision",
				},
				time: {
					name: "time",
					dataType: "time without time zone",
				},
			},
		});
	});
	it("Fetches column details and routine details from Postgres", async () => {
		const client = new PglitePostgresClient();
		await client.db.query(`
			CREATE TABLE users ( id INT PRIMARY KEY, name TEXT NOT NULL );
		`);
		await client.db.query(`
			CREATE TABLE transactions ( id INT PRIMARY KEY );
		`);
		const result = await fetchDatabaseDetails(client);
		expect(result.tables).toStrictEqual({
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
			transactions: {
				id: {
					tableName: "transactions",
					columnName: "id",
					dataType: "integer",
					isNullable: false,
				},
			},
		});
		expect(Object.keys(result.routines).length).toBeGreaterThan(100);
		expect(result.routines.pi).toStrictEqual({
			name: "pi",
			dataType: "double precision",
		});
	});
});
