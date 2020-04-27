import { Snowflake, MessageEmbed } from 'discord.js';
import Client from '../util/Client';
import { ModerationActionTypes } from '../util/Constants';

export default class Case {
	public client!: Client;
	public action: keyof typeof ModerationActionTypes;
	public extras: { [key: string]: string };
	public id: number;
	public logMessageID: Snowflake;
	public moderatorID: Snowflake;
	public reason: string;
	public screenshots: string[];
	public timestamp: Date;
	public userIDs: Snowflake[];
	

	constructor(client: Client, data: RawCase) {
		Object.defineProperty(this, 'client', { value: client });

		this.action = data.action;
		this.extras = JSON.parse(data.extras);
		this.id = data.id;
		this.logMessageID = data.message_id;
		this.moderatorID = data.moderator_id;
		this.reason = data.reason;
		this.screenshots = JSON.parse(data.screenshots);
		this.timestamp = new Date(data.timestamp);
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

	public async update(urls: string[], add = true) {
		urls = urls.filter(url => this.screenshots.includes(url) === !add);
		if (!urls.length) return Promise.resolve(this);
		if (add) {
			this.screenshots.push(...urls);
		} else {
			this.screenshots = this.screenshots.filter(url => !urls.includes(url));
		}
		await this.client.database.updateCase(this.id, this.screenshots);
		const message = await this.logMessage();
		const embed = new MessageEmbed(message.embeds[0]);
		const field = embed.fields.find(field => field.name === 'Screenshots');
		if (field) {
			field.value = this.screenshots.join('\n');
		} else {
			embed.addField('Screenshots', this.screenshots.join('\n'));
		}
		await message.edit(`Case ${this.id}`, embed);
		return this;
	}
}

export interface RawCase {
	action: keyof typeof ModerationActionTypes;
	extras: string;
	id: number;
	message_id: string;
	moderator_id: Snowflake;
	reason: string;
	screenshots: string;
	timestamp: number;
	user_ids: string;
}