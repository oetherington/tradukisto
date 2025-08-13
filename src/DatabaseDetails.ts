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
			c.relname AS "tableName",
			a.attname AS "columnName",
			FORMAT_TYPE(a.atttypid, NULL) AS "dataType",
			NOT a.attnotnull AS "isNullable"
		FROM pg_attribute a
		INNER JOIN pg_class c ON a.attrelid = c.oid
		INNER JOIN pg_namespace n ON c.relnamespace = n.oid
		WHERE
			NOT a.attisdropped
			AND a.attnum > 0
			AND c.relkind IN ('r', 'v', 'm')
			AND n.nspname = 'public'
		ORDER BY c.relname, a.attnum
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
