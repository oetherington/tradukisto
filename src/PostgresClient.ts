export abstract class PostgresClient {
	abstract fetchRows<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
