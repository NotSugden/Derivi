import { Snowflake } from 'discord.js';
import Client from '../util/Client';

export default class Points {
	public amount: number;
	public client!: Client;
	public lastDailyTimestamp: number;
	public userID: Snowflake;
	public vault: number;

	constructor(client: Client, data: RawPoints) {
		Object.defineProperty(this, 'client', { value: client });

		this.amount = data.amount;
		this.lastDailyTimestamp = new Date(data.last_daily).getTime();
		this.userID = data.user_id;
		this.vault = data.vault;
	}

	get lastDaily() {
		return new Date(this.lastDailyTimestamp);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public set({ points, vault, daily }: {
		points?: number; vault: number;
		daily?: boolean | number | string | Date;
	}): Promise<Points>;
	public set({ points, vault, daily }: {
		points: number; vault?: number;
		daily?: boolean | number | string | Date;
	}): Promise<Points>;
	public set({ points, vault, daily }: {
		points?: number; vault?: number;
		daily?: boolean | number | string | Date;
	}) {
		return this.client.database.setPoints(this.userID, {
			daily: typeof daily === 'string' ? new Date(daily) : daily, points, vault } as {
      points: number; vault?: number; daily?: boolean | number;
    });
	}
}

export interface RawPoints {
	user_id: Snowflake;
	amount: number;
	last_daily: string;
	vault: number;
}
