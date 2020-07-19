import { Client, Snowflake } from 'discord.js';
import Case from './Case';
import Util from '../util/Util';

export default class Warn {
	public caseID!: number;
	public readonly client!: Client;
	public moderatorID: Snowflake;
	public reason!: string;
	public timestamp: Date;
	public userID: Snowflake;
	public guildID: Snowflake;
	public id: Snowflake;

	constructor(client: Client, data: RawWarn) {
		Object.defineProperty(this, 'client', { value: client });

		this.id = data.id;
		this.moderatorID = data.moderator_id;
		this.timestamp = new Date(data.timestamp);
		this.userID = data.user_id;
		this.guildID = data.guild_id;
		this.patch(data);
	}

	public patch(data: Partial<RawWarn>) {
		if (typeof data.case_id === 'number') {
			this.caseID = data.case_id;
		}
		if (typeof data.reason === 'string') {
			this.reason = Util.decrypt(data.reason, this.client.config.encryptionPassword).toString();
		}
	}

	public fetchCase() {
		// The case shouldn't be null here as it should be linked to a valid case
		return this.client.database.case(this.guild, this.caseID) as Promise<Case>;
	}
	
	get guild() {
		return this.client.guilds.resolve(this.guildID)!;
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
