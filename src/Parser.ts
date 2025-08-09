import { AST, Parser } from "node-sql-parser";
import { Visitor } from "./Visitor";
import { isParam, ParamAST, ParamMap } from "./ParamMap";

const repoNameRegex = /--\s*@repo\s+([A-Z][a-zA-Z0-9_]*)/;
const partialRegex =
	/--\s*@partial\s+([a-z][a-zA-Z0-9_]*)\(\s*([a-z][a-zA-Z0-9_]*(?:\s*,\s*[a-z][a-zA-Z0-9_]*)*)?\s*\)\s*\r?\n((?:(?!--\s*@)[\s\S])*)/gm;
const argRegex = /[^,]+/g;
const queryRegex =
	/--\s*@query\s+([a-z][a-zA-Z0-9_]*)\s*\r?\n((?:(?!--\s*@).|\s)*)/gm;

export type ParsedQuery = {
	repoName?: string;
	queryName: string;
	typeName: string;
	query: string;
	paramMap: ParamMap;
	ast: AST;
};

type ParsedPartial = {
	name: string;
	args: string[];
	replacement: string;
	regex: RegExp;
};

const parsePartials = (sqlQuery: string) => {
	const partials: Record<string, ParsedPartial> = {};
	const partialResults = sqlQuery.matchAll(partialRegex);
	for (const result of partialResults) {
		const [_fullMatch, name, argsRaw = "", replacementRaw] = result;
		if (!name) {
			throw new Error("Failed to parse partial name");
		}
		if (partials[name]) {
			throw new Error(`Duplicate partial: ${name}`);
		}
		const replacement = replacementRaw?.trim();
		if (!replacement) {
			throw new Error(`Partial ${name} is empty`);
		}
		const args = Array.from(argsRaw.matchAll(argRegex))
			.map(([argName]) => argName?.trim())
			.filter(Boolean);
		const regex = new RegExp(`${name}\\(([^),]+(?:,[^),]+)*[,]?)?\\)`, "m");
		partials[name] = {
			name,
			args,
			replacement,
			regex,
		};
	}
	return partials;
};

const expandPartials = (query: string, partials: Record<string, ParsedPartial>) => {
	for (const partialName in partials) {
		const parsedPartial = partials[partialName];
		for (
			let match = query.match(parsedPartial.regex);
			match;
			match = query.match(parsedPartial.regex)
		) {
			if (match.index === undefined) {
				throw new Error("Invalid match");
			}
			const fullText = match[0];
			if (!fullText?.length) {
				throw new Error("Invalid partial match");
			}
			const argText = match[1] ?? "";
			const args = Array.from(argText.matchAll(argRegex))
				.map(([argName]) => argName?.trim())
				.filter(Boolean);
			if (args.length !== parsedPartial.args.length) {
				throw new Error(
					`Partial ${partialName} expected ${parsedPartial.args.length} arguments, found ${args.length}`,
				);
			}
			let expanded = parsedPartial.replacement;
			for (let i = 0; i < args.length; i++) {
				const argName = parsedPartial.args[i];
				const argValue = args[i].trim();
				if (!argValue) {
					throw new Error(
						`Missing value for ${argName} in ${partialName}`,
					);
				}
				expanded = expanded.replaceAll(argName, argValue);
			}
			const before = query.slice(0, match.index);
			const after = query.slice(match.index + fullText.length);
			query = before + expanded + after;
		}
	}
	return query;
};

export const parseSql = (sqlQuery: string): ParsedQuery[] => {
	const parser = new Parser();

	const repoMatch = sqlQuery.match(repoNameRegex);
	const repoName = repoMatch?.[1];

	const partials = parsePartials(sqlQuery);

	const queryResults = Array.from(sqlQuery.matchAll(queryRegex));
	if (!queryResults?.length) {
		throw new Error("No queries found");
	}

	const parserOptions = { database: "postgresql" };

	const queries: ParsedQuery[] = queryResults.map((result) => {
		// Get the query name, type name and raw query from the regex.
		const queryName = result[1];
		const typeName = `I${queryName[0].toUpperCase()}${queryName.slice(1)}`;
		const rawQuery = result[2].trim();

		// Expand all the partials
		const expandedQuery = expandPartials(rawQuery, partials);

		// Parse the query into an AST.
		let ast = parser.astify(expandedQuery, parserOptions);
		if (Array.isArray(ast)) {
			if (ast.length === 1) {
				ast = ast[0];
			} else {
				throw new Error("Invalid query nesting");
			}
		}

		// Find all the parameters and number them (1-indexed). Update the
		// query to use numbered parameters instead of named.
		const transformedAst = structuredClone(ast);
		const paramMap = new ParamMap();
		new Visitor<ParamAST>(isParam, (value) => {
			paramMap.add(value.value);
			value.value = String(paramMap.getParamIndex(value.value));
			value.prefix = "$";
		}).visit(transformedAst);

		// Now regenerate the query with the new parameters
		const query = paramMap.count()
			? parser.sqlify(transformedAst, parserOptions)
			: expandedQuery;

		// Done!
		return {
			repoName,
			queryName,
			typeName,
			query,
			paramMap,
			ast,
		};
	});

	return queries;
};
