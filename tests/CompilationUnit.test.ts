import { describe, expect, it } from "vitest";
import { FileCompilationUnit, StringCompilationUnit } from "../src";

describe("CompilationUnit", () => {
	describe("FileCompilationUnit", () => {
		it("Returns the correct directory", async () => {
			const unit = new FileCompilationUnit("./tests/CompilationUnit.test.ts");
			const dir = unit.getDirectory();
			expect(dir).toBe("./tests");
		});
		it("Returns value, async and sync", async () => {
			const unit = new FileCompilationUnit("./package.json");
			const contents = await unit.read();
			expect(contents.length).toBeGreaterThan(0);
			expect(contents[0]).toBe("{");
			const contentsSync = unit.unsafeReadSync();
			expect(contentsSync).toBe(contents);
		});
		it("Loads relative file", async () => {
			const parent = new FileCompilationUnit(
				"./tests/CompilationUnit.test.ts",
			);
			const unit = parent.openRelative("../package.json");
			const contents = await unit.read();
			expect(contents.length).toBeGreaterThan(0);
			expect(contents[0]).toBe("{");
		});
	});
	describe("StringCompilationUnit", () => {
		it("Returns the correct directory", async () => {
			const unit = new StringCompilationUnit("test string");
			const dir = unit.getDirectory();
			expect(dir).toBe(".");
		});
		it("Returns value, async and sync", async () => {
			const unit = new StringCompilationUnit("test string");
			const contents = await unit.read();
			expect(contents).toBe("test string");
			const contentsSync = unit.unsafeReadSync();
			expect(contentsSync).toBe(contents);
		});
		it("Returns other units", async () => {
			const unit = new StringCompilationUnit("test1", {
				test2: new StringCompilationUnit("test2"),
			});
			const other = unit.openRelative("test2");
			expect(other).toBeTruthy();
		});
	});
});
