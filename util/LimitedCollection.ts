import { Collection } from 'discord.js';
import Giveaway from '../structures/Giveaway';
import Mute from '../structures/Mute';

export default class LimitedCollection<K, V> extends Collection<K, V> {
	public maxSize: number;
	private timeouts!: { key: K; timeout: NodeJS.Timeout }[] | null;
	constructor(maxSize: number, iterable?: [K, V][]) {
		super(iterable);
		this.maxSize = maxSize;
		Object.defineProperty(this, 'timeouts', {
			value: null,
			writable: true
		});
	}

	public set(key: K, value: V) {
		if (this.has(key)) return super.set(key, value);
		if (this.size === this.maxSize) this.delete(this.firstKey()!);
		if (value instanceof Mute && value.endTimestamp > Date.now()) {
			if (!this.timeouts) {
				this.timeouts = [];
			}
			if (!this.timeouts.some(({ key: k }) => k === key)) {
				const timeout = setTimeout(() => {
					value.unmute();
					this.timeouts!.splice(this.timeouts!.findIndex(({ key: k }) => k === key), 1);
				}, value.endTimestamp - Date.now());
				this.timeouts.push({ key, timeout });
			}
		} else if (value instanceof Giveaway && value.endTimestamp > Date.now()) {
			if (!this.timeouts) {
				this.timeouts = [];
			}
			if (!this.timeouts.some(({ key: k }) => k === key)) {
				const timeout = setTimeout(() => {
					value.end();
					this.timeouts!.splice(this.timeouts!.findIndex(({ key: k }) => k === key), 1);
				}, value.endTimestamp - Date.now());
				this.timeouts.push({ key, timeout });
			}
		}
		return super.set(key, value);
	}
}