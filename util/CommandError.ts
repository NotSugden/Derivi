import { CommandErrors } from './Constants';
type ArgumentTypes<T> = T extends (... args: infer U ) => infer R ? U: never;

export default class CommandError<T extends keyof typeof CommandErrors> {
	public name: T;
	public message: string;
	public dmError: boolean;

	constructor(name: T, ...extras:
		(typeof CommandErrors)[T] extends Function ?
			ArgumentTypes<(typeof CommandErrors)[T]> :
			never[]
	) {
		this.name = name;
		const message = CommandErrors[name] as string | (
			(...args: (typeof CommandErrors)[T] extends Function ?
				ArgumentTypes<(typeof CommandErrors)[T]> :
				never[]
			) => string);
		this.message = typeof message === 'string' ? message : message(...extras);

		this.dmError = false;
	}

	dm() {
		this.dmError = true;
		return this;
	}
}