import type { PostgresClient } from "./PostgresClient";

export type ColumnDetails = {
	tableName: string;
	columnName: string;
	dataType: string;
	isNullable: boolean;
};

export type RoutineDetails = {
	name: string;
	dataType: string;
};

export type TableDetails = Record<string, ColumnDetails>;

export type DatabaseDetails = {
	tables: Record<string, TableDetails>;
	routines: Record<string, RoutineDetails>;
};

export const fetchColumnDetails = (
	client: PostgresClient,
): Promise<ColumnDetails[]> =>
	client.fetchRows<ColumnDetails>(`
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

export const fetchRoutineDetails = (client: PostgresClient) =>
	client.fetchRows<RoutineDetails>(`
		SELECT
			LOWER(routine_name) AS "name",
			data_type AS "dataType"
		FROM information_schema.ROUTINES
	`);

export const buildDatabaseDetails = (
	columns: ColumnDetails[],
	routines: RoutineDetails[],
): DatabaseDetails => {
	const result: DatabaseDetails = {
		tables: {},
		routines: {},
	};
	for (const details of columns) {
		result.tables[details.tableName] ??= {};
		result.tables[details.tableName][details.columnName] = details;
	}
	for (const details of routines) {
		result.routines[details.name] = details;
	}
	return result;
};

export const fetchDatabaseDetails = async (client: PostgresClient) => {
	const [columnDetails, routineDetails] = await Promise.all([
		fetchColumnDetails(client),
		fetchRoutineDetails(client),
	]);
	return buildDatabaseDetails(columnDetails, routineDetails);
};
