import { Snowflake } from 'discord.js';
import Client from '../util/Client';
import DatabaseManager from '../util/DatabaseManager';

export default class Points {
	public amount!: number;
	public client!: Client;
	public lastDailyTimestamp!: number;
	public userID: Snowflake;
	public vault!: number;

	constructor(client: Client, data: RawPoints) {
		Object.defineProperty(this, 'client', { value: client });

		this.userID = data.user_id;
		this.patch(data);
	}

	public patch(data: Partial<RawPoints>) {
		if (typeof data.amount === 'number') {
			this.amount = data.amount;
		}
		// future proofing incase `last_daily` can be another type it will still construct a date
		if (typeof data.last_daily !== 'undefined') {
			this.lastDailyTimestamp = new Date(data.last_daily).getTime();
		}
		if (typeof data.vault === 'number') {
			this.vault = data.vault;
		}
	}

	get lastDaily() {
		return new Date(this.lastDailyTimestamp);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public set(data: Parameters<DatabaseManager['editPoints']>[1]) {
		return this.client.database.editPoints(this.userID, data);
	}
}

export interface RawPoints {
	user_id: Snowflake;
	amount: number;
	last_daily: Date;
	vault: number;
}
