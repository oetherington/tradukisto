#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { glob } from "glob";
import { DatabaseDetails, fetchDatabaseDetails } from "./DatabaseDetails";
import { parseSql, setPartialStackDepth } from "./Parser";
import { PgPostgresClient } from "./PgPostgresClient";
import { createDeclaration, type Declaration } from "./Declaration";
import { FileCompilationUnit } from "./CompilationUnit";
import { TsGenerator } from "./TsGenerator";
import { parseConfigFile } from "./Config";
import type { Generator } from "./Generator";

const processFile = async (
	databaseDetails: DatabaseDetails,
	generator: Generator,
	fileName: string,
): Promise<string | Error> => {
	try {
		if (!fileName.endsWith(".sql")) {
			throw new Error(`Expected ${fileName} to have .sql extension`);
		}

		const queries = await parseSql(new FileCompilationUnit(fileName));
		const decls = queries
			.map((query) => createDeclaration(databaseDetails, query))
			.filter(Boolean) as Declaration[];
		for (let i = 0; i < queries.length; i++) {
			const query = queries[i];
			const decl = decls[i];
			generator.addDeclaration(query.queryName, decl);
		}

		const repoName = queries[0].repoName;
		const contents = generator.toString(repoName);

		const outputFileName = fileName.replace(/sql$/, "queries.ts");
		await writeFile(outputFileName, contents);

		return outputFileName;
	} catch (error) {
		if (error instanceof Error) {
			return new Error(fileName, { cause: error });
		}
		throw new Error("Internal error", { cause: error });
	}
};

const cliMain = async () => {
	const configPath = process.argv[2];
	const config = await parseConfigFile(configPath);

	setPartialStackDepth(config.partialStackDepth);

	const databaseUrl = process.env[config.connectionVariableName];
	if (!databaseUrl) {
		throw new Error("No database url provided");
	}

	const fileNames = await glob(config.files);
	if (!fileNames.length) {
		throw new Error(`No files found matching glob "${config.files}"`);
	}

	const client = new PgPostgresClient(databaseUrl);
	const databaseDetails = await fetchDatabaseDetails(client);
	const clientEndPromise = client.end();

	const promises: Promise<string | Error>[] = [];
	for (const fileName of fileNames) {
		const generator = new TsGenerator();
		promises.push(processFile(databaseDetails, generator, fileName));
	}

	const results = await Promise.all(promises);
	const successes = results.filter((result) => typeof result === "string");
	const errors = results.filter((result) => result instanceof Error);

	// eslint-disable-next-line no-console
	console.log("Wrote files:", successes);

	for (const error of errors) {
		const fileName = error.message;
		const actualError = error.cause as Error;
		// eslint-disable-next-line no-console
		console.error(`Error in "${fileName}":`, actualError.message);
	}

	await clientEndPromise;

	process.exit(errors.length ? 1 : 0);
};

cliMain();
