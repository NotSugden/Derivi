import { Errors } from './Constants';
type ArgumentTypes<T> = T extends (...args: infer U ) => infer R ? U: never;

const makeError = (Class: typeof Error) => {
	return class DeriviError<T extends keyof typeof Errors> extends Class {
		public code: T;
		public message: string;
	
		constructor(name: T, ...extras:
			(typeof Errors)[T] extends Function ?
				ArgumentTypes<(typeof Errors)[T]> :
				never[]
		) {
			super();
			this.code = name;
			const message = Errors[name] as string | (
				(...args: (typeof Errors)[T] extends Function ?
					ArgumentTypes<(typeof Errors)[T]> :
					never[]
				) => string);
			this.message = typeof message === 'string' ? message : message(...extras);
		}

		get name() {
			return `${super.name} [${this.code}]`;
		}
	};
};

const _Error = makeError(Error);
const _RangeError = makeError(RangeError);
const _TypeError = makeError(TypeError);

export {
	_Error as Error,
	_RangeError as RangeError,
	_TypeError as TypeError
};