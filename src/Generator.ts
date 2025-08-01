import type { ResolvedType } from "./Declaration";

export abstract class Generator {
	abstract addType(name: string, ty: ResolvedType): void;
	abstract addSqlString(name: string, sql: string): void;
	abstract toString(): string;
}
