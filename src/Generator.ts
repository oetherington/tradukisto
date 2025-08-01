import type { FieldDetails } from "./Declaration";

export abstract class Generator {
	abstract addType(name: string, ty: Record<string, FieldDetails>): void;
	abstract toString(): string;
}
