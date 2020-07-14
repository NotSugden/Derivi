import { Client, Snowflake } from 'discord.js';

export default class Partnership {
	public client!: Client;
	public guildID: Snowflake;
	public invite: string;
	public postedTimestamp: number;
	public userID: Snowflake;

	constructor(client: Client, data: RawPartnership) {
		Object.defineProperty(this, 'client', { value: client });

		this.guildID = data.guild_id;
		this.invite = data.guild_invite;
		this.postedTimestamp = new Date(data.timestamp).getTime();
		this.userID = data.user_id;
	}

	public fetchInvite() {
		return this.client.fetchInvite(this.invite);
	}

	public fetchUser(cache = true) {
		return this.client.users.fetch(this.userID, cache);
	}

	get postedAt() {
		return new Date(this.postedTimestamp);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}
}

export interface RawPartnership {
	guild_id: Snowflake;
	user_id: Snowflake;
	guild_invite: string;
	timestamp: Date;
}
