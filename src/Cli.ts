#!/usr/bin/env node

import { fetchDatabaseDetails } from "./DatabaseDetails";
import { parseSql } from "./Parser";
import { PgPostgresClient } from "./PgPostgresClient";
import { createDeclaration, type Declaration } from "./Declaration";
import { TsGenerator } from "./TsGenerator";

const cliMain = async () => {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("No database url provided");
	}

	const client = new PgPostgresClient(databaseUrl);
	const databaseDetails = await fetchDatabaseDetails(client);
	const queries = parseSql(`
		SELECT p."_id", u."_id" "userId"
		FROM "Posts" p
		LEFT JOIN "Users" u ON p."userId" = u."_id";
	`);
	const decls = queries
		.map((query) => createDeclaration(databaseDetails, query.ast))
		.filter(Boolean) as Declaration[];

	const generator = new TsGenerator();
	for (let i = 0; i < queries.length; i++) {
		const query = queries[i];
		const decl = decls[i];
		const returnType = decl.resolveResultType();
		generator.addType(query.name, returnType);
	}
	const result = generator.toString();
	// TODO
	console.log("result", result);
};

cliMain();
