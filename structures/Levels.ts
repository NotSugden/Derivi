import { Client, Snowflake } from 'discord.js';
import DatabaseManager from '../util/DatabaseManager';

export default class Levels {
	public readonly client!: Client;
	public level!: number;
	public userID: Snowflake;
	public xp!: number;

	constructor(client: Client, data: RawLevels) {
		Object.defineProperty(this, 'client', { value: client });

		this.userID = data.user_id;
		this.patch(data);
	}

	public static levelCalc(level: number) {
		return (5 / 6) * (level + 1) * (2 * (level + 1) * (level + 1) + 27 * (level + 1) + 91);
	}

	public patch(data: Partial<RawLevels>) {
		if (typeof data.level === 'number') {
			this.level = data.level;
		}
		if (typeof data.xp === 'number') {
			this.xp = data.xp;
		}
	}

	public fetchUser(cache = true) {
		return this.client.users.fetch(this.userID, cache);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public set(data: Parameters<DatabaseManager['editLevels']>[1]) {
		return this.client.database.editLevels(this.userID, data);
	}
}

export interface RawLevels {
	user_id: Snowflake;
	level: number;
	xp: number;
}
