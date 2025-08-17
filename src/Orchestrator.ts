import type { Config } from "./Config";
import type { Declaration } from "./Declaration";
import type { Generator } from "./Generator";
import { TsGenerator } from "./TsGenerator";
import { ZodGenerator } from "./ZodGenerator";

export class Orchestrator {
	private constructor(
		private inputFileName: string,
		private generators: Generator[],
	) {}

	private static createTypescriptOnlyStrategy(
		inputFileName: string,
	): Orchestrator {
		const tsGenerator = new TsGenerator(inputFileName);
		return new Orchestrator(inputFileName, [tsGenerator]);
	}

	private static createTypescriptZodStrategy(inputFileName: string): Orchestrator {
		const zodGenerator = new ZodGenerator(inputFileName);
		const tsGenerator = new TsGenerator(inputFileName);
		tsGenerator.setImportTypesGenerator(zodGenerator);
		return new Orchestrator(inputFileName, [zodGenerator, tsGenerator]);
	}

	static createFromConfig(config: Config, inputFileName: string): Orchestrator {
		return config.zod
			? Orchestrator.createTypescriptZodStrategy(inputFileName)
			: Orchestrator.createTypescriptOnlyStrategy(inputFileName);
	}

	getInputFileName() {
		return this.inputFileName;
	}

	addDeclaration(name: string, decl: Declaration) {
		for (const generator of this.generators) {
			generator.addDeclaration(name, decl);
		}
	}

	/**
	 * Returns a map from output file names to output file contents
	 */
	compile(): Record<string, string> {
		const result: Record<string, string> = {};
		for (const generator of this.generators) {
			result[generator.getOutputFileName()] = generator.toString();
		}
		return result;
	}
}
