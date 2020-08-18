import { Client, Snowflake } from 'discord.js';
import DatabaseManager from './DatabaseManager';
import LimitedCollection from './LimitedCollection';
import Case from '../structures/Case';
import Giveaway from '../structures/Giveaway';
import Levels from '../structures/Levels';
import Mute from '../structures/Mute';
import Partnership from '../structures/Partnership';
import Profile from '../structures/Profile';
import Star from '../structures/Star';
import Warn from '../structures/Warn';

type Collection<V, K = Snowflake> = LimitedCollection<K, V>;

export default class CacheManager {
	public readonly client!: Client;

	public cases: Collection<Case, string>
	public giveaways: Collection<Giveaway>;
	public levels: Collection<Levels>;
	public mutes: Collection<Mute>;
	public partnerships: Collection<Partnership, number>;
	public profiles: Collection<Profile>;
	public stars: Collection<Star>;
	public warnings: Collection<Warn>;

	public sweepInterval: NodeJS.Timer;

	private readonly database!: DatabaseManager
	constructor(database: DatabaseManager) {
		Object.defineProperties(this, {
			client: { value: database.client },
			database: { value: database }
		});

		const { cacheSweepInterval, maxCacheSize: maxSize } = database.client.config.database;
		if (typeof maxSize !== 'number') throw null;
		this.cases = new LimitedCollection(maxSize);
		this.giveaways = new LimitedCollection(maxSize);
		this.levels = new LimitedCollection(maxSize);
		this.mutes = new LimitedCollection(maxSize);
		this.partnerships = new LimitedCollection(maxSize);
		this.profiles = new LimitedCollection(maxSize);
		this.stars = new LimitedCollection(maxSize);
		this.warnings = new LimitedCollection(maxSize);
		this.sweepInterval = database.client.setInterval(() => this.sweepCache(), cacheSweepInterval! * 1000);
	}

	public sweepCache() {
		const keys = Object.keys(this) as (keyof this)[];
		for (const key of keys) {
			const coll = this[key];
			if (!(coll instanceof LimitedCollection) || coll.hasTimeouts) continue;
			coll.clear();
		}
	}
}