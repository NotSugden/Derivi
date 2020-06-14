import { Snowflake } from 'discord.js';
import Client from '../util/Client';
import Util from '../util/Util';

export default class Profile {
	public client!: Client;
	public userID: Snowflake;
	public description: string;
	public rep: number;

	constructor(client: Client, data: RawProfile) {
		Object.defineProperty(this, 'client', { value: client });

		this.userID = data.user_id;
		this.description = Util.decrypt(data.description, client.config.encryptionPassword).toString();
		this.rep = data.reputation;
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}

	public update(data: Partial<Omit<RawProfile, 'user_id'>>) {
		if (data.description) this.description = data.description;
		if (data.reputation) this.rep = data.reputation;
		return this.client.database.updateProfile(this.userID, data);
	}
}

export interface RawProfile {
	user_id: Snowflake;
	description: Snowflake;
	reputation: number;
}