import { ArrayWrapper, FieldDetails } from "./Declaration";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JsonArray extends ReadonlyArray<Json> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JsonRecord extends Record<string, Json> {}
export type Json = boolean | number | string | null | JsonArray | JsonRecord;

export const chunk = <T>(arr: T[], size: number) =>
	Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
		arr.slice(i * size, i * size + size),
	);

export const operatorTypes: Record<string, string> = {
	and: "boolean",
	or: "boolean",
	not: "boolean",
	"<": "boolean",
	">": "boolean",
	"<=": "boolean",
	">=": "boolean",
	"=": "boolean",
	"!=": "boolean",
	"<>": "boolean",
	"+": "double precision",
	"-": "double precision",
	"*": "double precision",
	"/": "double precision",
	"%": "double precision",
	"^": "double precision",
	"|/": "double precision",
	"||/": "double precision",
	"!": "double precision",
	"!!": "double precision",
	"@": "integer",
	"&": "integer",
	"|": "integer",
	"#": "integer",
	"~": "integer",
	"<<": "integer",
	">>": "integer",
	"||": "text",
	like: "boolean",
	ilike: "boolean",
};

export const aggregates: Record<string, (details: FieldDetails) => FieldDetails> = {
	array_agg: ({ dataType }) => ({
		name: "array_agg",
		dataType: new ArrayWrapper(dataType),
		isNullable: false,
	}),
	avg: ({ isNullable }) => ({ name: "avg", dataType: "float", isNullable }),
	bit_and: ({ isNullable }) => ({
		name: "bit_and",
		dataType: "integer",
		isNullable,
	}),
	bit_or: ({ isNullable }) => ({
		name: "bit_or",
		dataType: "integer",
		isNullable,
	}),
	bool_and: ({ isNullable }) => ({
		name: "bool_and",
		dataType: "boolean",
		isNullable,
	}),
	bool_or: ({ isNullable }) => ({
		name: "bool_and",
		dataType: "boolean",
		isNullable,
	}),
	count: () => ({ name: "count", dataType: "integer", isNullable: false }),
	every: ({ isNullable }) => ({ name: "every", dataType: "boolean", isNullable }),
	json_agg: ({ dataType }) => ({
		name: "json_agg",
		dataType: new ArrayWrapper(dataType),
		isNullable: false,
	}),
	jsonb_agg: ({ dataType }) => ({
		name: "jsonb_agg",
		dataType: new ArrayWrapper(dataType),
		isNullable: false,
	}),
	json_object_agg: () => ({
		name: "json_object_agg",
		dataType: "json",
		isNullable: false,
	}),
	jsonb_object_agg: () => ({
		name: "jsonb_object_agg",
		dataType: "json",
		isNullable: false,
	}),
	max: (details) => ({ ...details, name: "max" }),
	min: (details) => ({ ...details, name: "min" }),
	string_agg: () => ({
		name: "string_agg",
		dataType: "text",
		isNullable: false,
	}),
	sum: ({ dataType, isNullable }) => ({
		name: "sum",
		dataType: ["smallint", "int", "integer", "bigint"].includes(
			dataType as string,
		)
			? "bigint"
			: dataType,
		isNullable,
	}),
	xml_agg: () => ({
		name: "xml_agg",
		dataType: "xml",
		isNullable: false,
	}),
};
