import { Snowflake } from 'discord.js';
import Case from './Case';
import Client from '../util/Client';

export default class Warn {
	public caseID: number;
	public client!: Client;
	public moderatorID: Snowflake;
	public reason: string;
	public timestamp: Date;
	public userID: Snowflake;

	constructor(client: Client, data: RawWarn) {
		Object.defineProperty(this, 'client', { value: client });

		this.caseID = data.case_id;
		this.moderatorID = data.moderator_id;
		this.reason = data.reason;
		this.timestamp = new Date(data.timestamp);
		this.userID = data.user_id;
	}

	public case() {
		// The case shouldn't be null here as it should be linked to a valid case
		return this.client.database.case(this.caseID) as Promise<Case>;
	}

	get moderator() {
		return this.client.users.resolve(this.moderatorID);
	}

	get user() {
		return this.client.users.resolve(this.userID);
	}
}

export interface RawWarn {
	case_id: number;
	moderator_id: Snowflake;
	reason: string;
	timestamp: Date;
	user_id: Snowflake;
}
