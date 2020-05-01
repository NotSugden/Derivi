import { Snowflake } from 'discord.js';
import Client from '../util/Client';

const unmute = (data: Mute) => async () => {
	const guild = data.client.config.defaultGuild;
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

	constructor(client: Client, data: RawMute) {
		Object.defineProperty(this, 'client', { value: client });

		this.endTimestamp = new Date(data.end).getTime();
		this.startedTimestamp = new Date(data.start).getTime();
		this.userID = data.user_id;

		if (this.endTimestamp > Date.now()) {
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
		this.client.mutes.delete(this.userID);
		return this.client.database.deleteMute(this.userID);
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
	end: Date;
	start: Date;
	user_id: Snowflake;
}
