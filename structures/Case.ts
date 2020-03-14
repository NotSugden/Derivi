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
		this.moderatorID = data.moderator;
		this.reason = data.reason;
		this.screenshot_urls = JSON.parse(data.screenshot_urls);
		this.userIDs = JSON.parse(data.users);
	}

	logMessage() {
		return this.client.config.punishmentChannel.messages.fetch(this.logMessageID);
	}

	get moderator() {
		return this.client.users.resolve(this.moderatorID);
	}

	public users() {
		return Promise.all(this.userIDs.map(userID => this.client.users.fetch(userID)));
	}
}

export interface RawCase {
	action: keyof typeof ModerationActionTypes;
	extras: string;
	id: number;
	message_id: string;
	moderator: Snowflake;
	reason: string;
	screenshot_urls: string;
	users: string;
}