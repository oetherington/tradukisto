export class Visitor<T> {
	private condition: (value: unknown) => value is T;
	private action: (value: T) => void;

	constructor(
		condition: (value: unknown) => value is T,
		action: (value: T) => void,
	) {
		this.condition = condition;
		this.action = action;
	}

	visit(target: unknown) {
		if (this.condition(target)) {
			this.action(target);
			return;
		}
		if (!target || typeof target !== "object") {
			return;
		}
		for (const key of Object.keys(target)) {
			this.visit((target as Record<string, unknown>)[key]);
		}
	}
}
