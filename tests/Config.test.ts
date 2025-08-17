import { describe, expect, it } from "vitest";
import { defaultConfig, parseConfig, parseConfigFile } from "../src";

describe("Config", () => {
	it("Parses config file", async () => {
		const config = await parseConfigFile("./tests/testConfig.json");
		expect(config).toStrictEqual({
			files: "*.sql",
			connectionVariableName: "DBCONN",
			partialStackDepth: 10,
			zod: false,
		});
	});
	it("No file name returns default config", async () => {
		const config = await parseConfigFile();
		expect(config).toStrictEqual(defaultConfig);
	});
	it("Parses partial config", async () => {
		const config = parseConfig(`{"files":"*.sql"}`);
		expect(config).toStrictEqual({
			...defaultConfig,
			files: "*.sql",
		});
	});
	it("Can have multiple files", async () => {
		const config = parseConfig(`{"files":["src/**/*.sql","test/**/*.sql"]}`);
		expect(config).toStrictEqual({
			...defaultConfig,
			files: ["src/**/*.sql", "test/**/*.sql"],
		});
	});
});
