import { describe, expect, it } from "vitest";
import { Visitor } from "../src";

describe("Visitor", () => {
	it("visits every descendant of an object", () => {
		const results: number[] = [];
		const visitor = new Visitor<number>(
			(value) => typeof value === "number",
			(value) => results.push(value),
		);
		visitor.visit({
			a: "foo",
			b: null,
			c: 4,
			d: [],
			e: {
				f: 3,
				g: undefined,
				h: {
					i: 2,
				},
				j: "bar",
			},
			k: {
				l: {
					m: {
						n: new Set([]),
						o: {
							p: 1,
						},
						q: new ArrayBuffer(),
					},
				},
			},
		});
		expect(results.sort()).toStrictEqual([1, 2, 3, 4]);
	});
});
