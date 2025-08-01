import postgres, { ParameterOrJSON, Sql } from "postgres";
import { PostgresClient } from "./PostgresClient";

export class PgPostgresClient extends PostgresClient {
	private sql: Sql;

	constructor(databaseUrl: string) {
		super();
		this.sql = postgres(databaseUrl);
	}

	async fetchRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
		try {
			const rows = await this.sql.unsafe(
				sql,
				params as ParameterOrJSON<never>[],
				{ prepare: params.length === 0 },
			);
			return rows as unknown as T[];
		} catch (error) {
			throw new Error("Failed to fetch rows from Postgres", {
				cause: error,
			});
		}
	}

	async end(timeout?: number) {
		await this.sql.end({ timeout });
	}
}
