import {
	ANON_COLUMN_NAME,
	ArrayWrapper,
	type DataType,
	type Declaration,
	type FieldDetails,
	type ResolvedType,
} from "./Declaration";
import { Generator } from "./Generator";
import { ParamMap } from "./ParamMap";

export class TsGenerator extends Generator {
	private static readonly dataTypes: Record<string, string> = {
		bigint: "BigInt",
		bigserial: "BigInt",
		boolean: "boolean",
		bytea: "ArrayBuffer",
		"character varying": "string",
		cidr: "string",
		date: "Date",
		varchar: "string",
		"double precision": "number",
		float: "number",
		inet: "string",
		integer: "number",
		interval: "number",
		json: "any", // TODO
		jsonb: "any", // TODO
		money: "number",
		real: "number",
		smallint: "number",
		smallserial: "number",
		serial: "number",
		text: "string",
		time: "Date",
		"time without time zone": "Date",
		"time with time zone": "Date",
		"timestamp without time zone": "Date",
		"timestamp with time zone": "Date",
		tsquery: "string[]",
		tsvector: "string[]",
		unknown: "unknown",
		uuid: "string",
		xml: "string",
	};

	private declarations: Record<string, Declaration> = {};

	addDeclaration(name: string, decl: Declaration) {
		if (this.declarations[name]) {
			throw new Error(`Duplicate declaration: ${name}`);
		}
		this.declarations[name] = decl;
	}

	private generateSimpleType(dataType: string): string {
		let suffix = "";
		if (dataType.endsWith("[]")) {
			dataType = dataType.slice(0, dataType.length - 2);
			suffix = "[]";
		}
		return (TsGenerator.dataTypes[dataType] ?? "unknown") + suffix;
	}

	private generateArrayWrapperType(
		dataType: ArrayWrapper,
		indent: number,
	): string {
		const value = this.generateBaseType(dataType.value, indent);
		return value + "[]";
	}

	private generateBaseType(dataType: DataType, indent: number) {
		if (typeof dataType === "string") {
			return this.generateSimpleType(dataType);
		}
		if (dataType instanceof ArrayWrapper) {
			return this.generateArrayWrapperType(dataType, indent);
		}
		return this.generateFieldDetailsRecord(dataType, indent + 2);
	}

	private fieldDetailsToTSType(
		{ dataType, isNullable }: FieldDetails,
		indent: number,
	) {
		const base = this.generateBaseType(dataType, indent);
		return isNullable ? base + " | null" : base;
	}

	private fieldDetailsToTS(details: FieldDetails, indent: number) {
		if (details.name === ANON_COLUMN_NAME) {
			throw new Error("You must name all anonymous columns");
		}
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

	generateType(name: string, value: ResolvedType) {
		return `export interface ${name} ${this.generateFieldDetailsRecord(value, 0)}`;
	}

	private generateSqlString(name: string, sql: string) {
		const comment = `-- ${name}\n`;
		const escapedSql = sql.replaceAll("`", "\\`");
		return `export const ${name} = \`${comment}${escapedSql}\`;`;
	}

	private generateImports(repoName?: string): string[] {
		return repoName ? ['import type { PostgresClient } from "tradukisto";'] : [];
	}

	private queryNameToSqlName(queryName: string) {
		return queryName + "Sql";
	}

	private typeNameToParamsName(queryName: string) {
		return queryName + "Params";
	}

	private generateParams(typeName: string, paramMap: ParamMap): [string, string] {
		if (!paramMap.count()) {
			return ["", ""];
		}
		const namedArgs = `params: ${this.typeNameToParamsName(typeName)}`;
		const paramArray = paramMap.getParamArray();
		const positionalArgs = paramArray.map((item) => `params.${item}`).join(", ");
		return [namedArgs, `, [${positionalArgs}]`];
	}

	private generateRepoMethod(decl: Declaration) {
		const { queryName, typeName, paramMap } = decl.getParsedQuery();
		const sqlName = this.queryNameToSqlName(queryName);
		const [namedArgs, positionalArgs] = this.generateParams(typeName, paramMap);
		const result: string[] = [
			`\n  ${queryName}(${namedArgs}): Promise<${typeName}[]> {`,
			`    return this.client.fetchRows(${sqlName}${positionalArgs});`,
			"  }",
		];
		return result.join("\n");
	}

	private generateRepo(name: string): string {
		const result: string[] = [
			`export class ${name}Repo {`,
			"  protected client: PostgresClient;\n",
			"  constructor(client: PostgresClient) {",
			"    this.client = client;",
			"  }",
		];
		for (const declName in this.declarations) {
			result.push(this.generateRepoMethod(this.declarations[declName]));
		}
		result.push("}");
		return result.join("\n");
	}

	toString(repoName?: string): string {
		const result = this.generateImports(repoName);
		for (const declName in this.declarations) {
			const decl = this.declarations[declName];
			const { queryName, typeName, query } = decl.getParsedQuery();
			const paramTypeName = this.typeNameToParamsName(typeName);
			const sqlStringName = this.queryNameToSqlName(queryName);
			const resultType = decl.resolveResultType();
			const parameterTypes = decl.resolveParameterTypes();
			if (Object.keys(resultType).length) {
				result.push(this.generateType(typeName, resultType));
			}
			if (Object.keys(parameterTypes).length) {
				result.push(this.generateType(paramTypeName, parameterTypes));
			}
			result.push(this.generateSqlString(sqlStringName, query));
		}
		if (repoName) {
			result.push(this.generateRepo(repoName));
		}
		return result.join("\n\n");
	}
}
