import type { FieldDetails, ResolvedType } from "./Declaration";
import { Generator } from "./Generator";

export class TsGenerator extends Generator {
	private static readonly dataTypes: Record<string, string> = {
		"character varying": "string",
		text: "string",
		integer: "number",
		vector: "string[]",
		"double precision": "number",
		boolean: "boolean",
		jsonb: "any", // TODO
		"timestamp with time zone": "Date",
		unknown: "unknown",
	};

	private types: Record<string, ResolvedType> = {};
	private sqlStrings: Record<string, string> = {};

	addType(name: string, ty: ResolvedType) {
		if (this.types[name]) {
			throw new Error("Duplicate type name: " + name);
		}
		this.types[name] = ty;
	}

	addSqlString(name: string, sql: string) {
		if (this.sqlStrings[name]) {
			throw new Error("Duplicate query name: " + name);
		}
		this.sqlStrings[name] = sql;
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

	private generateFieldDetailsRecord(value: ResolvedType, indent: number) {
		const lines = [`{`];
		const spaces = " ".repeat(indent + 2);
		for (const details of Object.values(value)) {
			lines.push(spaces + this.fieldDetailsToTS(details, indent));
		}
		lines.push(" ".repeat(indent) + "}");
		return lines.join("\n");
	}

	private generateType(name: string, value: ResolvedType) {
		return `export interface ${name} ${this.generateFieldDetailsRecord(value, 0)}`;
	}

	private generateSqlString(name: string, sql: string) {
		const comment = `-- ${name}\n`;
		const escapedSql = sql.replaceAll("`", "\\`");
		return `export const ${name} = \`${comment}${escapedSql}\`;`;
	}

	toString(): string {
		const result: string[] = [];
		for (const name in this.types) {
			const ty = this.types[name];
			if (!Object.keys(ty).length) {
				continue;
			}
			result.push(this.generateType(name, this.types[name]));
		}
		for (const name in this.sqlStrings) {
			result.push(this.generateSqlString(name, this.sqlStrings[name]));
		}
		return result.join("\n\n");
	}
}
