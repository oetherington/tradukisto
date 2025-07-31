import type { PostgresClient } from "./PostgresClient";

export type ColumnDetails = {
	tableName: string,
	columnName: string,
	dataType: string,
	isNullable: boolean,
}

export type TableDetails = Record<string, ColumnDetails>;

export type DatabaseDetails = Record<string, TableDetails>;

export const fetchColumnDetails = (
	client: PostgresClient,
): Promise<ColumnDetails[]> => client.fetchRows<ColumnDetails>(`
	SELECT
		c.table_name AS "tableName",
		c.column_name AS "columnName",
		c.udt_name::REGTYPE AS "dataType",
		c.is_nullable = 'YES' AS "isNullable"
	FROM information_schema.COLUMNS c
	INNER JOIN information_schema.TABLES t ON
		t.table_name = c.table_name AND
		t.table_type = 'BASE TABLE'
	WHERE c.table_schema = 'public'
`);

export const columnDetailsToDatabaseDetails = (
	rows: ColumnDetails[],
): DatabaseDetails => {
	const result: DatabaseDetails = {};
	for (const details of rows) {
		result[details.tableName] ??= {};
		result[details.tableName][details.columnName] = details;
	}
	return result;
}

export const fetchDatabaseDetails = async (client: PostgresClient) => {
	const columnDetails = await fetchColumnDetails(client);
	return columnDetailsToDatabaseDetails(columnDetails);
}
