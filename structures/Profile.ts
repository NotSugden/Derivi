import { Client, Snowflake } from 'discord.js';
import DatabaseManager from '../util/DatabaseManager';
import Util from '../util/Util';

export default class Profile {
	public readonly client!: Client;
	public userID: Snowflake;
	public description!: string;
	public rep!: number;

	constructor(client: Client, data: RawProfile) {
		Object.defineProperty(this, 'client', { value: client });

		this.userID = data.user_id;
		this.patch(data);
	}

	public patch(data: Partial<RawProfile>) {
		if (typeof data.description === 'string') {
			this.description = Util.decrypt(data.description, this.client.config.encryptionPassword).toString();
		}
		if (typeof data.reputation === 'number') {
			this.rep = data.reputation;
		}
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public update(data: Parameters<DatabaseManager['editProfile']>[1]) {
		return this.client.database.editProfile(this.userID, data);
	}
}

export interface RawProfile {
	user_id: Snowflake;
	description: Snowflake;
	reputation: number;
}