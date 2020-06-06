import { Snowflake } from 'discord.js';
import Case from './Case';
import Guild from './discord.js/Guild';
import Client from '../util/Client';
import Util from '../util/Util';

export default class Warn {
	public caseID: number;
	public client!: Client;
	public moderatorID: Snowflake;
	public reason: string;
	public timestamp: Date;
	public userID: Snowflake;
	public guildID: Snowflake;
	public id: Snowflake;

	constructor(client: Client, data: RawWarn) {
		Object.defineProperty(this, 'client', { value: client });

		this.id = data.id;
		this.caseID = data.case_id;
		this.moderatorID = data.moderator_id;
		this.reason = Util.decrypt(data.reason, client.config.encryptionPassword).toString();
		this.timestamp = new Date(data.timestamp);
		this.userID = data.user_id;
		this.guildID = data.guild_id;
	}

	public case() {
		// The case shouldn't be null here as it should be linked to a valid case
		return this.client.database.case(this.guild, this.caseID) as Promise<Case>;
	}
	
	get guild() {
		return this.client.guilds.resolve(this.guildID) as Guild;
	}

	get moderator() {
		return this.client.users.resolve(this.moderatorID);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}
}

export interface RawWarn {
	id: Snowflake;
	guild_id: Snowflake;
	case_id: number;
	moderator_id: Snowflake;
	reason: string;
	timestamp: Date;
	user_id: Snowflake;
}
