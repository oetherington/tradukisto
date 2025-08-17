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

const typescriptDataTypes = {
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
	json: "Json",
	jsonb: "Json",
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
	null: "null",
};

export class TsGenerator extends Generator {
	private repoName: string | null = null;
	private importTypesGenerator: Generator | null = null;
	private hasJson = false;

	constructor(
		protected inputFilePath: string,
		protected readonly dataTypes: Record<string, string> = typescriptDataTypes,
		private readonly arraySuffix = "[]",
		private readonly nullableSuffix = " | null",
		private readonly optionalSuffix = "?",
		private readonly objectPrefix = "{",
		private readonly objectSuffix = "}",
	) {
		super();
	}

	setImportTypesGenerator(generator: Generator) {
		this.importTypesGenerator = generator;
	}

	private generateSimpleType(dataType: string): string {
		let suffix = "";
		while (dataType.endsWith("[]")) {
			dataType = dataType.slice(0, dataType.length - 2);
			suffix = this.arraySuffix;
		}
		if (dataType.startsWith("json")) {
			this.hasJson = true;
		}
		const tsType = this.dataTypes[dataType] ?? this.dataTypes.unknown;
		return tsType + suffix;
	}

	private generateArrayWrapperType(
		dataType: ArrayWrapper,
		indent: number,
		nullablesAreOptional: boolean,
	): string {
		const value = this.generateBaseType(
			dataType.value,
			indent,
			nullablesAreOptional,
		);
		return value + this.arraySuffix;
	}

	private generateBaseType(
		dataType: DataType,
		indent: number,
		nullablesAreOptional: boolean,
	) {
		if (typeof dataType === "string") {
			return this.generateSimpleType(dataType);
		}
		if (dataType instanceof ArrayWrapper) {
			return this.generateArrayWrapperType(
				dataType,
				indent,
				nullablesAreOptional,
			);
		}
		return this.generateFieldDetailsRecord(
			dataType,
			indent + 2,
			nullablesAreOptional,
		);
	}

	private fieldDetailsToTSType(
		{ dataType, isNullable }: FieldDetails,
		indent: number,
		nullablesAreOptional: boolean,
	) {
		const base = this.generateBaseType(dataType, indent, nullablesAreOptional);
		return isNullable ? base + this.nullableSuffix : base;
	}

	private fieldDetailsToTS(
		details: FieldDetails,
		indent: number,
		nullablesAreOptional: boolean,
	) {
		if (details.name === ANON_COLUMN_NAME) {
			throw new Error("You must name all anonymous columns");
		}
		const optional =
			nullablesAreOptional && details.isNullable ? this.optionalSuffix : "";
		const ty = this.fieldDetailsToTSType(details, indent, nullablesAreOptional);
		return `${details.name}${optional}: ${ty},`;
	}

	protected generateFieldDetailsRecord(
		value: ResolvedType,
		indent: number,
		nullablesAreOptional: boolean,
	) {
		const lines = [this.objectPrefix];
		const spaces = " ".repeat(indent + 2);
		for (const details of Object.values(value)) {
			const ty = this.fieldDetailsToTS(details, indent, nullablesAreOptional);
			lines.push(spaces + ty);
		}
		lines.push(" ".repeat(indent) + this.objectSuffix);
		return lines.join("\n");
	}

	generateType(name: string, value: ResolvedType, nullablesAreOptional: boolean) {
		const ty = this.generateFieldDetailsRecord(value, 0, nullablesAreOptional);
		return `export interface ${name} ${ty}`;
	}

	private generateSqlString(queryName: string, sql: string) {
		const repoName = this.repoName;
		const sqlStringName = this.queryNameToSqlName(queryName);
		const comment = `-- ${repoName ? `${repoName}.` : ""}${queryName}\n`;
		const escapedSql = sql.replaceAll("`", "\\`");
		return `export const ${sqlStringName} = \`${comment}${escapedSql}\`;`;
	}

	private generateTradukistoImports(): string | null {
		const imports = [];
		if (this.hasJson && !this.importTypesGenerator) {
			imports.push("Json");
		}
		if (this.repoName) {
			imports.push("PostgresClient");
		}
		return imports.length
			? `import type { ${imports.join(", ")} } from "tradukisto";`
			: null;
	}

	private generateTypeImports(): string | null {
		if (!this.importTypesGenerator) {
			return null;
		}
		const imports: string[] = [];
		for (const declName in this.declarations) {
			const decl = this.declarations[declName];
			const { typeName } = decl.getParsedQuery();
			const paramTypeName = this.typeNameToParamsName(typeName);
			const resultType = decl.resolveResultType();
			const parameterTypes = decl.resolveParameterTypes();
			if (Object.keys(resultType).length) {
				imports.push(typeName);
			}
			if (Object.keys(parameterTypes).length) {
				imports.push(paramTypeName);
			}
		}
		if (!imports.length) {
			return null;
		}
		const filePath = this.importTypesGenerator.getOutputFilePath();
		const fileParts = filePath.split("/");
		const fileName = fileParts[fileParts.length - 1];
		const importPath = `./${fileName.replace(".ts$", "")}`;
		return `import type {\n  ${imports.join(",\n  ")},\n} from "${importPath}";`;
	}

	protected generateImports(): string | null {
		return [this.generateTradukistoImports(), this.generateTypeImports()]
			.filter(Boolean)
			.join("\n");
	}

	private queryNameToSqlName(queryName: string) {
		return queryName + "Sql";
	}

	protected typeNameToParamsName(queryName: string) {
		return queryName + "Params";
	}

	private generateParams(typeName: string, paramMap: ParamMap): [string, string] {
		if (!paramMap.count()) {
			return ["", ""];
		}
		const namedArgs = `params: ${this.typeNameToParamsName(typeName)}`;
		const paramArray = paramMap.getParamArray();
		const positionalArgs = paramArray
			.map((item) => {
				if (item.endsWith("_")) {
					item = item.slice(0, item.length - 1);
				}
				return `      params.${item} === undefined ? null : params.${item},`;
			})
			.join("\n");
		return [namedArgs, `, [\n${positionalArgs}\n    ]`];
	}

	private generateRepoMethod(decl: Declaration) {
		const { queryName, typeName, paramMap } = decl.getParsedQuery();
		const sqlName = this.queryNameToSqlName(queryName);
		const [namedArgs, positionalArgs] = this.generateParams(typeName, paramMap);
		const allArgs = sqlName + positionalArgs;
		const declResultType = decl.getResultType();

		const rowsType = `${typeName}[]`;
		const isVoid = declResultType === "none";
		const isSingle = declResultType === "one";
		const resultType = isVoid
			? "void"
			: isSingle
				? `${typeName} | null`
				: rowsType;
		const variable = isVoid ? "" : `const res: ${rowsType} = `;

		const result: string[] = [
			`\n  async ${queryName}(${namedArgs}): Promise<${resultType}> {`,
			`    ${variable}await this.client.fetchRows(${allArgs});`,
		];
		if (!isVoid) {
			result.push(`    return ${isSingle ? "res?.[0] ?? null" : "res"};`);
		}
		result.push("  }");
		return result.join("\n");
	}

	private generateRepo(): string {
		const result: string[] = [
			`export class ${this.repoName}Repo {`,
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

	toString(): string {
		for (const declName in this.declarations) {
			const repoName = this.declarations[declName].getParsedQuery().repoName;
			if (repoName) {
				this.repoName = repoName;
				break;
			}
		}

		const result: string[] = [];
		for (const declName in this.declarations) {
			const decl = this.declarations[declName];
			const { queryName, typeName, query } = decl.getParsedQuery();
			if (!this.importTypesGenerator) {
				const paramTypeName = this.typeNameToParamsName(typeName);
				const resultType = decl.resolveResultType();
				const parameterTypes = decl.resolveParameterTypes();
				if (Object.keys(resultType).length) {
					const ty = this.generateType(typeName, resultType, false);
					result.push(ty);
				}
				if (Object.keys(parameterTypes).length) {
					const ty = this.generateType(
						paramTypeName,
						parameterTypes,
						true,
					);
					result.push(ty);
				}
			}
			result.push(this.generateSqlString(queryName, query));
		}
		if (this.repoName) {
			result.push(this.generateRepo());
		}
		const imports = this.generateImports();
		if (imports) {
			result.unshift(imports);
		}
		return [Generator.header, ...result].join("\n\n");
	}

	getOutputFilePath(): string {
		return this.inputFilePath.replace(/sql$/, "repo.ts");
	}
}
