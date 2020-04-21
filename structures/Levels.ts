import { Snowflake } from 'discord.js';
import Client from '../util/Client';

export default class Levels {
	public client!: Client;
	public level: number;
	public userID: Snowflake;
	public xp: number;

	constructor(client: Client, data: RawLevels) {
		Object.defineProperty(this, 'client', { value: client });

		this.level = data.level;
		this.userID = data.user_id;
		this.xp = data.xp;
	}

	public static levelCalc(level: number) {
		return (5 / 6) * (level + 1) * (2 * (level + 1) * (level + 1) + 27 * (level + 1) + 91);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public set({ level, xp }: { level?: number; xp: number}): Promise<this>;
	public set({ level, xp }: { level: number; xp?: number}): Promise<this>;
	public set({ level, xp }: { level?: number; xp?: number }) {
		return this.client.database.setLevels(this.userID, { level, xp } as {
      level?: number; xp: number;
    }) as Promise<this>;
	}
}

export interface RawLevels {
	user_id: Snowflake;
	level: number;
	xp: number;
}
