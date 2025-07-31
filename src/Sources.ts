import type { Select } from "node-sql-parser";
import type { DatabaseDetails, TableDetails } from "./DatabaseDetails";

export type Source = {
	isNullable: boolean;
	table: TableDetails;
};

export type Sources = Record<string, Source>;

export const databaseDetailsToSources = (
	details: DatabaseDetails,
	sources: Select["from"],
) => {
	const result: Sources = {};
	if (sources === null) {
		return result;
	} else if (Array.isArray(sources)) {
		for (const source of sources) {
			if ("table" in source) {
				const table = details[source.table];
				const isNullable = "join" in source && source.join !== "INNER JOIN";
				if (table) {
					result[source.table] = { table, isNullable };
					if (source.as) {
						result[source.as] = { table, isNullable };
					}
				} else {
					throw new Error("Table not found: " + source.table);
				}
			} else {
				// TODO
				throw new Error("Source table not found");
			}
		}
	} else {
		// TODO
		throw new Error("Sources expected an array");
	}
	return result;
};

export const resolveUnqualifiedSource = (sources: Sources, name: string) => {
	let foundSource: Source | null = null;
	for (const sourceName in sources) {
		const source = sources[sourceName];
		const table = sources[sourceName].table;
		for (const columnName in table) {
			if (columnName !== name) {
				continue;
			}
			if (foundSource && foundSource !== source) {
				throw new Error(`Unqualified column "${name}" is ambiguous`);
			}
			foundSource = source;
		}
	}
	if (!foundSource) {
		throw new Error(`No value in scope named "${name}"`);
	}
	return foundSource;
};
