import { Snowflake } from 'discord.js';
import Guild from './discord.js/Guild';
import TextChannel from './discord.js/TextChannel';
import User from './discord.js/User';
import Client from '../util/Client';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export default class Star {
	public readonly client!: Client;
	public authorID: Snowflake;
	public channelID: Snowflake;
	public guildID: Snowflake;
	public messageID: Snowflake;
	public starboardID!: Snowflake;
	public timestamp: Date;
	public userIDs!: Snowflake[];

	constructor(client: Client, data: RawStar) {
		Object.defineProperty(this, 'client', { value: client });

		this.authorID = data.author_id;
		this.channelID = data.channel_id;
		this.guildID = data.guild_id;
		this.messageID = data.message_id;
		this.timestamp = new Date(data.timestamp);
		this.patch(data);
	}

	public patch(data: Partial<Omit<RawStar, 'users'>> & { users?: Snowflake[] | string }) {
		if (typeof data.starboard_id === 'string') {
			this.starboardID = data.starboard_id;
		}
		if (typeof data.users !== 'undefined') {
			this.userIDs = typeof data.users === 'string'
				? JSON.parse(data.users) : data.users;
		}
	}

	get author() {
		return this.client.users.resolve(this.authorID);
	}

	get channel() {
		return this.client.channels.resolve(this.channelID) as TextChannel;
	}

	public async fetchAuthor({ cache = false, fromMessage = false } = {}) {
		if (fromMessage) {
			const message = await this.fetchMessage(cache);
			return message.author;
		}
		return this.client.users.fetch(this.authorID, cache) as Promise<User>;
	}

	public fetchMessage(cache = false) {
		return this.channel.messages.fetch(this.messageID, cache) as Promise<GuildMessage>;
	}

	public fetchStarboardMessage(cache = false) {
		return this.starboardChannel.messages.fetch(this.starboardID, cache) as Promise<GuildMessage<true>>;
	}

	public fetchUsers(cache = true) {
		return Promise.all(this.userIDs.map(id => this.client.users.fetch(id, cache))) as Promise<User[]>;
	}

	get guild() {
		return this.client.guilds.resolve(this.guildID) as Guild;
	}

	get starboardChannel() {
		const config = this.client.config.guilds.get(this.guildID)!;
		return this.client.channels.resolve(config.starboard!.channelID) as TextChannel;
	}

	get starCount() {
		return this.userIDs.length;
	}

	public async updateMessage(cache = false) {
		const message = await this.fetchStarboardMessage();
		return message.edit(
			Responses.STARBOARD_EMBED(this.starCount, await this.fetchMessage(cache))
		) as Promise<GuildMessage<true>>;
	}

	get users() {
		return this.userIDs.map(id => this.client.users.resolve(id));
	}

	public async addStar(user: User | Snowflake, cacheMessage = false) {
		const id = this.client.users.resolveID(user)!;
		if (this.userIDs.includes(id)) return this;
		await this.client.database.editStar(this.messageID, { users: this.userIDs });
		const message = await this.fetchStarboardMessage(cacheMessage);
		await message.edit(Responses.STARBOARD_EMBED(this.starCount, await this.fetchMessage()));
		return this;
	}

	public async removeStar(user: User | Snowflake, cacheMessage = false) {
		const index = this.userIDs.indexOf(this.client.users.resolveID(user)!);
		if (index === -1) return this;
		this.userIDs.splice(index, 1);
		await this.client.database.editStar(this.messageID, { users: this.userIDs });
		return this.updateMessage(cacheMessage);
	}
}

export interface RawStar {
	author_id: Snowflake;
	guild_id: Snowflake;
	message_id: Snowflake;
	starboard_id: Snowflake;
	channel_id: Snowflake;
	stars: number;
	timestamp: Date;
	users: string;
}
