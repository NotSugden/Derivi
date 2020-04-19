import { CommandErrors } from './Constants';
export default class CommandError<T extends keyof typeof CommandErrors> {
	public name: T;
	public message: string;
	constructor(name: T, ...extras: unknown[]) {
		this.name = name;
		const message = CommandErrors[name] as string | ((...args: unknown[]) => string);
		this.message = typeof message === 'string' ? message : message(...extras);
	}
}