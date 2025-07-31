export abstract class PostgresClient {
	abstract fetchRows<T>(sql: string): Promise<T[]>;
}
