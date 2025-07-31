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
	const asts = parseSql(`
		SELECT p."_id", u."_id" "userId"
		FROM "Posts" p
		LEFT JOIN "Users" u ON p."userId" = u."_id";
	`);
	const decls = asts
		.map((ast) => createDeclaration(databaseDetails, ast))
		.filter(Boolean) as Declaration[];

	const generator = new TsGenerator();
	for (const decl of decls) {
		const returnType = decl.resolveResultType();
		generator.addType("TestType", returnType);
	}
	const result = generator.toString();
	console.log("result", result);
}

cliMain();
