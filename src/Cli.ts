#!/usr/bin/env node

import { glob, writeFile } from "node:fs/promises";
import { minimatch } from "minimatch";
import { watch } from "chokidar";
import { DatabaseDetails, fetchDatabaseDetails } from "./DatabaseDetails";
import { parseSql, setPartialStackDepth } from "./Parser";
import { PgPostgresClient } from "./PgPostgresClient";
import { createDeclaration, type Declaration } from "./Declaration";
import { FileCompilationUnit } from "./CompilationUnit";
import { parseConfigFile } from "./Config";
import { Orchestrator } from "./Orchestrator";

const processFile = async (
	databaseDetails: DatabaseDetails,
	orchestrator: Orchestrator,
): Promise<string[] | Error> => {
	const inputFileName = orchestrator.getInputFileName();
	try {
		if (!inputFileName.endsWith(".sql")) {
			throw new Error(`Expected ${inputFileName} to have .sql extension`);
		}

		const queries = await parseSql(new FileCompilationUnit(inputFileName));
		const decls = queries
			.map((query) => createDeclaration(databaseDetails, query))
			.filter(Boolean) as Declaration[];
		for (let i = 0; i < queries.length; i++) {
			const query = queries[i];
			const decl = decls[i];
			orchestrator.addDeclaration(query.queryName, decl);
		}

		const result = orchestrator.compile();
		const fileNames = Object.keys(result);
		await Promise.all(
			fileNames.map((fileName) => writeFile(fileName, result[fileName])),
		);
		return fileNames;
	} catch (error) {
		if (error instanceof Error) {
			return new Error(inputFileName, { cause: error });
		}
		throw new Error("Internal error", { cause: error });
	}
};

const reportFileError = (error: Error) => {
	const fileName = error.message;
	const actualError = error.cause as Error;
	// eslint-disable-next-line no-console
	console.error(`Error in "${fileName}":`, actualError.message);
};

const fileIsWatched = (path: string, watchedGlobs: string | string[]) =>
	Array.isArray(watchedGlobs)
		? watchedGlobs.some((pattern) => minimatch(path, pattern))
		: minimatch(path, watchedGlobs);

const cliMain = async () => {
	const configPath = process.argv[2];
	const config = await parseConfigFile(configPath);
	const watchMode = !!process.env.WATCH;

	setPartialStackDepth(config.partialStackDepth);

	const databaseUrl = process.env[config.connectionVariableName];
	if (!databaseUrl) {
		throw new Error("No database url provided");
	}

	const client = new PgPostgresClient(databaseUrl);
	const databaseDetails = await fetchDatabaseDetails(client);
	const clientEndPromise = client.end();

	const promises: Promise<string[] | Error>[] = [];
	for await (const fileName of glob(config.files)) {
		const orchestrator = Orchestrator.createFromConfig(config, fileName);
		promises.push(processFile(databaseDetails, orchestrator));
	}

	const results = await Promise.all(promises);
	const successes = results.filter((result) => typeof result === "string");
	const errors = results.filter((result) => result instanceof Error);

	if (successes.length) {
		// eslint-disable-next-line no-console
		console.log("Wrote files:", successes);
	}

	for (const error of errors) {
		reportFileError(error);
	}

	await clientEndPromise;

	if (!watchMode) {
		process.exit(errors.length > 0 ? 1 : 0);
	}

	const watchHandler = async (path: string) => {
		path = "./" + path;
		if (fileIsWatched(path, config.files)) {
			// eslint-disable-next-line no-console
			console.log(`Rebuilding ${path}...`);
			const orchestrator = Orchestrator.createFromConfig(config, path);
			const result = await processFile(databaseDetails, orchestrator);
			if (result instanceof Error) {
				reportFileError(result);
			} else {
				// eslint-disable-next-line no-console
				console.log("Wrote file", result);
			}
		} else if (path === configPath) {
			// eslint-disable-next-line no-console
			console.warn("Config file changed - restart for changes to take effect");
		}
	};

	const watcher = watch(".", {
		ignored: (path) =>
			path.startsWith("node_modules") || path.startsWith(".git"),
		awaitWriteFinish: {
			stabilityThreshold: 500,
		},
	});

	// eslint-disable-next-line no-console
	watcher.on("ready", () => console.log("Watching for changes..."));
	watcher.on("change", watchHandler);
};

cliMain();
