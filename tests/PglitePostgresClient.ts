import { PGlite } from "@electric-sql/pglite";
import { PostgresClient } from "../src";

export class PglitePostgresClient extends PostgresClient {
	public db = new PGlite();

	async fetchRows<T>(sql: string): Promise<T[]> {
		const { rows } = await this.db.query<T>(sql);
		return rows;
	}
}
