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

		this.amount = data.points;
		this.lastDailyTimestamp = data.last_daily;
		this.userID = data.id;
		this.vault = data.vault;
	}

	get lastDaily() {
		return this.lastDailyTimestamp ? new Date(this.lastDailyTimestamp) : null;
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public set({ points, vault, daily }: { points?: number; vault: number; daily?: boolean | number }): Promise<Points>;
	public set({ points, vault, daily }: { points: number; vault?: number; daily?: boolean | number }): Promise<Points>;
	public set({ points, vault, daily }: { points?: number; vault?: number; daily?: boolean | number }) {
		return this.client.database.setPoints(this.userID, { daily, points, vault } as {
      points: number; vault?: number; daily?: boolean | number;
    });
	}
}

export interface RawPoints {
	id: Snowflake;
	points: number;
	last_daily: number;
	vault: number;
}
