import { describe, expect, it } from "vitest";
import { PglitePostgresClient } from "./PglitePostgresClient";
import {
	columnDetailsToDatabaseDetails,
	fetchDatabaseDetails,
} from "../src";

describe("DatabaseDetails", () => {
	it("Converts empty column details to empty database details", () => {
		const result = columnDetailsToDatabaseDetails([]);
		expect(result).toStrictEqual({});
	});
	it("Converts column details to database details", () => {
		const result = columnDetailsToDatabaseDetails([
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
		]);
		expect(result).toStrictEqual({
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
		});
	});
	it("Fetches column details from Postgres", async () => {
		const client = new PglitePostgresClient();
		await client.db.query(`
			CREATE TABLE users ( id INT PRIMARY KEY, name TEXT NOT NULL );
		`);
		await client.db.query(`
			CREATE TABLE transactions ( id INT PRIMARY KEY );
		`);
		const result = await fetchDatabaseDetails(client);
		expect(result).toStrictEqual({
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
	});
});
