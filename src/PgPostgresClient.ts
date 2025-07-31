import { Client } from "pg";
import { PostgresClient } from "./PostgresClient";

export class PgPostgresClient extends PostgresClient {
	private client: Client;

	constructor(databaseUrl: string) {
		super();
		this.client = new Client(databaseUrl);
	}

	async fetchRows<T>(sql: string): Promise<T[]> {
		try {
			await this.client.connect();
			const { rows } = await this.client.query(sql);
			return rows;
		} catch (error) {
			throw new Error("Failed to fetch rows from Postgres", {
				cause: error,
			});
		} finally {
			await this.client.end();
		}
	}
}
