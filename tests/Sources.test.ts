import { expect, describe, it } from "vitest";
import { resolveUnqualifiedSource, Sources } from "../src";

describe("Sources", () => {
	it("can resolve unqualified source", () => {
		const sources: Sources = {
			users: {
				table: {
					id: {
						tableName: "users",
						columnName: "id",
						dataType: "text",
						isNullable: false,
					},
				},
				isNullable: false,
			},
			posts: {
				table: {
					title: {
						tableName: "posts",
						columnName: "title",
						dataType: "text",
						isNullable: false,
					},
				},
				isNullable: false,
			},
		};
		const result = resolveUnqualifiedSource(sources, "title");
		expect(result).toStrictEqual(sources.posts);
	});
});
