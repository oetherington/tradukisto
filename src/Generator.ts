import type { Declaration } from "./Declaration";

export abstract class Generator {
	abstract addDeclaration(name: string, decl: Declaration): void;
	abstract toString(repoName?: string): string;
}
