import type { FieldDetails, ResolvedType } from "./Declaration";

export class TsGenerator {
	private static readonly dataTypes: Record<string, string> = {
		"character varying": "string",
		text: "string",
		integer: "number",
		vector: "string[]",
		"double precision": "number",
		boolean: "boolean",
		jsonb: "any", // TODO
		"timestamp with time zone": "Date",
	};

	private types: Record<string, ResolvedType> = {};

	addType(name: string, ty: Record<string, FieldDetails>) {
		if (this.types[name]) {
			throw new Error("Duplicate type name: " + name);
		}
		this.types[name] = ty;
	}

	private generateSimpleType = (dataType: string): string => {
		let suffix = "";
		if (dataType.endsWith("[]")) {
			dataType = dataType.slice(0, dataType.length - 2);
			suffix = "[]";
		}
		return (TsGenerator.dataTypes[dataType] ?? "unknown") + suffix;
	};

	private fieldDetailsToTSType = (
		{ dataType, isNullable }: FieldDetails,
		indent: number,
	) => {
		const base =
			typeof dataType === "string"
				? this.generateSimpleType(dataType)
				: this.generateFieldDetailsRecord(dataType, indent + 2);
		return isNullable ? base + " | null" : base;
	};

	private fieldDetailsToTS(details: FieldDetails, indent: number) {
		return `${details.name}: ${this.fieldDetailsToTSType(details, indent)},`;
	}

	private generateFieldDetailsRecord(
		value: Record<string, FieldDetails>,
		indent: number,
	) {
		const lines = [`{`];
		const spaces = " ".repeat(indent + 2);
		for (const details of Object.values(value)) {
			lines.push(spaces + this.fieldDetailsToTS(details, indent));
		}
		lines.push(" ".repeat(indent) + "}");
		return lines.join("\n");
	}

	private generateType(name: string, value: Record<string, FieldDetails>) {
		return `type ${name} = ${this.generateFieldDetailsRecord(value, 0)}`;
	}

	toString(): string {
		const result: string[] = [];
		for (const name in this.types) {
			result.push(this.generateType(name, this.types[name]));
		}
		return result.join("\n\n");
	}
}
