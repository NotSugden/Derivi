import { Snowflake, GuildEmoji } from 'discord.js';
import Client from './Client';

export default class EmojiStore extends Map {
	public readonly client!: Client;
	constructor(client: Client) {
		super();
		Object.defineProperty(this, 'client', { value: client });
	}
  
	public set(name: string, id: Snowflake) {
		return super.set(name, () => this.client.emojis.cache.get(id));
	}
  
	public get(name: string): GuildEmoji | undefined {
		const getter = super.get(name);
		return getter ? getter() : undefined;
	}
  
	public *values() {
		yield* [...super.values()].map(value => value());
	}
  
	public *entries() {
		yield* [...super.entries()].map(
			([name, value]) => [name, value() as GuildEmoji]
		) as unknown as IterableIterator<[string, GuildEmoji]>;
	}
  
	public *[Symbol.iterator]() {
		yield* this.entries();
	}
}