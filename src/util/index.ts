export default class Util {
	static tryCatch<T>(...callbacks: (() => T)[]): T | null {
		for (const callback of callbacks) {
			try {
				return callback();
			} catch { } // eslint-disable-line no-empty
		}
		return null;
	}
}