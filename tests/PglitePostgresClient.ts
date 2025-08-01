import { PGlite } from "@electric-sql/pglite";
import { PostgresClient } from "../src";

export class PglitePostgresClient extends PostgresClient {
	public db = new PGlite();

	async fetchRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
		const { rows } = await this.db.query<T>(sql, params);
		return rows;
	}
}
