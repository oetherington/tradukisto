import type { ResolvedType } from "./Declaration";
import { Generator } from "./Generator";
import { TsGenerator } from "./TsGenerator";

const dateType =
	"z.union([z.string(), z.date()]).pipe(z.transform((val) => val instanceof Date ? val : new Date(val)))";

const zodDataTypes = {
	bigint: "z.bigint()",
	bigserial: "z.bigint()",
	boolean: "z.boolean()",
	bytea: "z.int().array()",
	"character varying": "z.string()",
	cidr: "z.string()",
	date: dateType,
	varchar: "z.string()",
	"double precision": "z.number()",
	float: "z.()number",
	ine: "z.string()",
	integer: "z.int()",
	interval: "z.number()",
	json: "z.json()",
	jsonb: "z.json()",
	money: "z.number()",
	real: "z.number()",
	smallint: "z.int()",
	smallserial: "z.int()",
	serial: "z.int()",
	text: "z.string()",
	time: dateType,
	"time without time zone": dateType,
	"time with time zone": dateType,
	"timestamp without time zone": dateType,
	"timestamp with time zone": dateType,
	tsquery: "z.string().array()",
	tsvector: "z.string().array()",
	unknown: "z.unknown()",
	uuid: "z.string()",
	xml: "z.string()",
	null: "z.null()",
};

export class ZodGenerator extends TsGenerator {
	constructor(inputFileName: string) {
		super(
			inputFileName,
			zodDataTypes,
			".array()",
			".optional()",
			"",
			"z.object({",
			"})",
		);
	}

	generateType(name: string, value: ResolvedType, nullablesAreOptional: boolean) {
		const schemaName = `${name[1].toLowerCase()}${name.slice(2)}Schema`;
		const ty = this.generateFieldDetailsRecord(value, 0, nullablesAreOptional);
		const parts = [
			`export const ${schemaName} = ${ty};`,
			`export type ${name} = z.infer<typeof ${schemaName}>;`,
		];
		return parts.join("\n\n");
	}

	toString(): string {
		const result: string[] = [Generator.header, `import z from "zod/v4";`];
		const imports = this.generateImports();
		if (imports) {
			result.push(imports);
		}
		for (const declName in this.declarations) {
			const decl = this.declarations[declName];
			const { typeName } = decl.getParsedQuery();
			const paramTypeName = this.typeNameToParamsName(typeName);
			const resultType = decl.resolveResultType();
			const parameterTypes = decl.resolveParameterTypes();
			if (Object.keys(resultType).length) {
				const ty = this.generateType(typeName, resultType, false);
				result.push(ty);
			}
			if (Object.keys(parameterTypes).length) {
				const ty = this.generateType(paramTypeName, parameterTypes, true);
				result.push(ty);
			}
		}
		return result.join("\n\n");
	}

	getOutputFilePath(): string {
		return this.inputFilePath.replace(/sql$/, "schemas.ts");
	}
}
