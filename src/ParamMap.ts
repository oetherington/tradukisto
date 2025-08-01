export type ParamAST = { type: "param"; value: string; prefix?: string };

export const isParam = (value: unknown): value is ParamAST =>
	!!value &&
	typeof value === "object" &&
	"type" in value &&
	value.type === "param" &&
	"value" in value &&
	!!value.value &&
	typeof value.value === "string";

export class ParamMap {
	private paramCount: number = 0;
	private paramMap: Record<string, number> = {};
	private paramArray: string[] = [];

	constructor(values: string[] = []) {
		for (const value of values) {
			this.add(value);
		}
	}

	add(name: string) {
		if (!this.paramMap[name]) {
			this.paramMap[name] = ++this.paramCount;
			this.paramArray.push(name);
		}
	}

	count() {
		return this.paramCount;
	}

	getParamArray(): readonly string[] {
		return this.paramArray;
	}

	getParamMap(): Record<string, number> {
		return this.paramMap;
	}

	getParamIndex(name: string): number {
		const value = this.paramMap[name];
		if (!value) {
			throw new Error(`Parameter "${name}" is not defined`);
		}
		return value;
	}

	getParamName(index: number): string {
		const value = this.paramArray[index - 1];
		if (!value) {
			throw new Error(`Parameter with index ${index} is not defined`);
		}
		return value;
	}
}
