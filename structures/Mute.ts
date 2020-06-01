import { Snowflake } from 'discord.js';
import Guild from './discord.js/Guild';
import Client from '../util/Client';

const unmute = (data: Mute) => async () => {
	const guild = data.guild;
	// Dynamic muted role
	const role = guild.roles.cache.find(role => role.name === 'Muted');
	if (role) {
		try {
			const member = await guild.members.fetch(data.userID);
			if (member.roles.cache.has(role.id)) {
				await member.roles.remove(role);
			}
		} catch { } // eslint-disable-line no-empty
	} else {
		data.client.emit(
			'warn',
			'Attempted to unmute a member, but the muted role was not present in the default guild'
		);
	}
	data.delete()
		.catch(error => {
			console.error('Error deleting a mute:', error);
		});
};

export default class Mute {
	public client!: Client;
	public endTimestamp: number;
	public startedTimestamp: number;
	public timeout!: NodeJS.Timeout;
	public userID: Snowflake;
	public guildID: Snowflake;

	constructor(client: Client, data: RawMute) {
		Object.defineProperty(this, 'client', { value: client });

		this.endTimestamp = new Date(data.end).getTime();
		this.startedTimestamp = new Date(data.start).getTime();
		this.userID = data.user_id;
		this.guildID = data.guild_id;

		if (this.endTimestamp > Date.now()) {
			this.client.mutes.set(`${this.guildID}:${this.userID}`, this);
			this.timeout = client.setTimeout(
				unmute(this),
				this.endTimestamp - Date.now()
			);
		} else {
			const fn = unmute(this);
			fn();
		}
	}

	public delete() {
		this.client.mutes.delete(`${this.guildID}:${this.userID}`);
		return this.client.database.deleteMute(this.guild, this.userID);
	}

	get guild() {
		return this.client.guilds.resolve(this.guildID) as Guild;
	}

	get endAt() {
		return new Date(this.endTimestamp);
	}

	get startedAt() {
		return new Date(this.startedTimestamp);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}
}

export interface RawMute {
	guild_id: Snowflake;
	end: Date;
	start: Date;
	user_id: Snowflake;
}
