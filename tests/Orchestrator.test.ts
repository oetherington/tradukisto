import { expect, describe, it } from "vitest";
import { defaultConfig, Orchestrator } from "../src";

describe("Orchestrator", () => {
	it("Can get input file name", async () => {
		const orchestrator = Orchestrator.createFromConfig(
			defaultConfig,
			"test.sql",
		);
		expect(orchestrator.getInputFileName()).toBe("test.sql");
	});
	it("Can create Typescript only strategy", async () => {
		const config = { ...defaultConfig, zod: false };
		const orchestrator = Orchestrator.createFromConfig(config, "test.sql");
		const result = orchestrator.compile();
		expect(Object.keys(result)).toStrictEqual(["test.repo.ts"]);
	});
	it("Can create Typescript/Zod strategy", async () => {
		const config = { ...defaultConfig, zod: true };
		const orchestrator = Orchestrator.createFromConfig(config, "test.sql");
		const result = orchestrator.compile();
		expect(Object.keys(result)).toStrictEqual([
			"test.schemas.ts",
			"test.repo.ts",
		]);
	});
});
