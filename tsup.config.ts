import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/Cli.ts", "src/index.ts"],
	format: ["cjs", "esm"],
	sourcemap: true,
	minify: true,
	clean: true,
	dts: true,
});
