import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const defaultConfigPath = "./tradukisto.config.json";

type ConfigContents = {
	files: string | string[];
	connectionVariableName: string;
	partialStackDepth: number;
	zod: boolean;
};

export type Config = Readonly<ConfigContents>;

// Note that these values are duplicated in the README documentation
export const defaultConfig: Config = {
	files: "./**/*.sql",
	connectionVariableName: "DATABASE_URL",
	partialStackDepth: 100,
	zod: true,
};

export const parseConfig = (contents: string): Config => {
	try {
		const json = JSON.parse(contents);
		if (!json || typeof json !== "object") {
			throw new Error("Config is not an object");
		}
		const config: ConfigContents = structuredClone(defaultConfig);
		if (typeof json.files === "string") {
			config.files = json.files;
		} else if (Array.isArray(json.files)) {
			for (const item in json.files) {
				if (typeof item !== "string") {
					throw new Error("`files` should be a string or string[]");
				}
			}
			config.files = json.files;
		} else if (json.files) {
			throw new Error("`files` should be a string or string[]");
		}
		if (typeof json.connectionVariableName === "string") {
			config.connectionVariableName = json.connectionVariableName;
		} else if (json.connectionVariableName) {
			throw new Error("`connectionVariableName` should be a string");
		}
		if (typeof json.partialStackDepth === "number") {
			config.partialStackDepth = json.partialStackDepth;
		} else if (json.partialStackDepth) {
			throw new Error("`partialStackDepth` should be an integer");
		}
		if (typeof json.zod === "boolean") {
			config.zod = json.zod;
		} else if (json.zod) {
			throw new Error("`zod` should be a boolean");
		}
		return config;
	} catch (e) {
		throw new Error("Error parsing config", { cause: e });
	}
};

export const parseConfigFile = async (filePath?: string): Promise<Config> => {
	if (!filePath) {
		return existsSync(defaultConfigPath)
			? parseConfigFile(defaultConfigPath)
			: defaultConfig;
	}
	try {
		const contents = await readFile(filePath, "utf-8");
		return parseConfig(contents);
	} catch (e) {
		throw new Error("Error reading config file", { cause: e });
	}
};
