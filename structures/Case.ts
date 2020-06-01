import { Snowflake, MessageEmbed } from 'discord.js';
import Guild from './discord.js/Guild';
import TextChannel from './discord.js/TextChannel';
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
	public guildID: Snowflake;

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
		this.guildID = data.guild_id;
	}

	public logMessage() {
		/**
		 * Using a function here as its more likely than not
		 * that the log message would be uncached
		 */
		return (this.client.channels.resolve(
			this.client.config.guilds.get(this.guildID)!.starboard!.channelID
		) as TextChannel).messages.fetch(this.logMessageID);
	}
  
	get guild() {
		return this.client.guilds.resolve(this.guildID) as Guild;
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
		await this.client.database.updateCase(this.guild, this.id, this.screenshots);
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
  guild_id: Snowflake;
	id: number;
	message_id: string;
	moderator_id: Snowflake;
	reason: string;
	screenshots: string;
	timestamp: Date;
	user_ids: string;
}