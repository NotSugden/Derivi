import { Snowflake } from 'discord.js';
import Client from '../util/Client';
import { ModerationActionTypes } from '../util/Constants';

export default class Case {
	public client!: Client;
	public action: string;
	public extras: string[];
	public id: number;
	public logMessageID: Snowflake;
	public moderatorID: Snowflake;
	public reason: string;
	public screenshot_urls: string[];
	public userIDs: Snowflake[];
	

	constructor(client: Client, data: RawCase) {
		Object.defineProperty(this, 'client', { value: client });

		this.action = data.action;
		this.extras = JSON.parse(data.extras);
		this.id = data.id;
		this.logMessageID = data.message_id;
		this.moderatorID = data.moderator_id;
		this.reason = data.reason;
		this.screenshot_urls = JSON.parse(data.screenshot_urls);
		this.userIDs = JSON.parse(data.user_ids);
	}

	public logMessage() {
		/**
		 * Using a function here as its more likely than not
		 * that the log message would be uncached
		 */
		return this.client.config.punishmentChannel.messages.fetch(this.logMessageID);
	}

	get moderator() {
		return this.client.users.resolve(this.moderatorID);
	}

	get users() {
		/**
		 * Opted for a getter over a function here. if any of the users are null
		 * then they'll have to be accounted for and fetched
		 */
		return this.userIDs.map(id => this.client.users.resolve(id));
	}
}

export interface RawCase {
	action: keyof typeof ModerationActionTypes;
	extras: string;
	id: number;
	message_id: string;
	moderator_id: Snowflake;
	reason: string;
	screenshot_urls: string;
	user_ids: string;
}