import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export abstract class CompilationUnit {
	abstract getDirectory(): string;
	abstract read(): Promise<string>;
	abstract unsafeReadSync(): string;
	abstract openRelative(path: string): CompilationUnit;
}

export class FileCompilationUnit extends CompilationUnit {
	private fileName: string;
	private parent?: CompilationUnit;
	private contents?: string;

	constructor(fileName: string, parent?: CompilationUnit) {
		super();
		this.fileName = fileName;
		this.parent = parent;
	}

	getDirectory() {
		return dirname(this.fileName);
	}

	async read(): Promise<string> {
		if (this.contents === undefined) {
			const relativeTo = this.parent?.getDirectory() ?? "";
			const filePath = resolve(relativeTo, this.fileName);
			this.contents = await readFile(filePath, "utf8");
		}
		return this.contents;
	}

	unsafeReadSync(): string {
		if (this.contents === undefined) {
			throw new Error("Call read before unsafeReadSync");
		}
		return this.contents;
	}

	openRelative(path: string): CompilationUnit {
		return new FileCompilationUnit(path, this);
	}
}

export class StringCompilationUnit extends CompilationUnit {
	private source: string;
	private otherUnits?: Record<string, CompilationUnit>;

	constructor(source: string, otherUnits?: Record<string, CompilationUnit>) {
		super();
		this.source = source;
		this.otherUnits = otherUnits;
	}

	getDirectory(): string {
		return ".";
	}

	read(): Promise<string> {
		return Promise.resolve(this.source);
	}

	unsafeReadSync(): string {
		return this.source;
	}

	openRelative(path: string): CompilationUnit {
		const unit = this.otherUnits?.[path];
		if (!unit) {
			throw new Error(`Can't find compilation unit: ${path}`);
		}
		return unit;
	}
}
