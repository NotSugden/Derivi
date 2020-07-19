import { Client, MessageEmbed, Snowflake } from 'discord.js';
import { ModerationActionTypes } from '../util/Constants';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

export default class Case {
	public client!: Client;
	public action!: keyof typeof ModerationActionTypes;
	public extras!: { [key: string]: string };
	public id!: number;
	public logMessageID!: Snowflake;
	public moderatorID: Snowflake;
	public reason!: string;
	public screenshots!: string[];
	public timestamp: Date;
  public userIDs!: Snowflake[];
	public guildID: Snowflake;

	constructor(client: Client, data: RawCase) {
		Object.defineProperty(this, 'client', { value: client });

		this.guildID = data.guild_id;
		this.moderatorID = data.moderator_id;
		this.timestamp = new Date(data.timestamp);
		this.patch(data);
	}

	public patch(data: Partial<Omit<RawCase, 'extras' | 'screenshots' | 'user_ids'>> & {
		extras?: { [key: string]: string } | string;
		screenshots?: string[] | string;
		user_ids?: Snowflake[] | string;
	}) {
		if (typeof data.action === 'string') {
			this.action = data.action;
		}
		if (typeof data.extras !== 'undefined') {
			this.extras = typeof data.extras === 'string'
				? JSON.parse(data.extras) : data.extras;
		}
		if (typeof data.id === 'number') this.id = data.id;
		if (typeof data.message_id === 'string') this.logMessageID = data.message_id;
		if (typeof data.reason === 'string') {
			this.reason = Util.decrypt(data.reason, this.client.config.encryptionPassword).toString();
		}
		if (typeof data.screenshots !== 'undefined') {
			this.screenshots = typeof data.screenshots === 'string'
				? JSON.parse(data.screenshots) : data.screenshots;
		}
		if (typeof data.user_ids !== 'undefined') {
			this.userIDs = typeof data.user_ids === 'string'
				? JSON.parse(data.user_ids) : data.user_ids;
		}
	}

	get channel() {
		if (!this.guild.config) return null;
		return this.guild.config.punishmentChannel;
	}

	public async fetchLogMessage(cache = false) {
		if (!this.channel) {
			await this.guild.fetchConfig();
		}
		return this.channel!.messages.fetch(this.logMessageID, cache) as Promise<GuildMessage<true>>;
	}
	
	public fetchModerator(cache = true) {
		return this.client.users.fetch(this.moderatorID, cache);
	}

	public fetchUsers(cache = true) {
		return Promise.all(this.userIDs.map(id => this.client.users.fetch(id, cache)));
	}

	get guild() {
		return this.client.guilds.resolve(this.guildID)!;
	}

	get moderator() {
		return this.client.users.resolve(this.moderatorID);
	}

	get users() {
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
		await this.client.database.editCase(this.guild, this.id, { screenshots: this.screenshots });
		const message = await this.fetchLogMessage();
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