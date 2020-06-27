import { Snowflake } from 'discord.js';
import Guild from './discord.js/Guild';
import TextChannel from './discord.js/TextChannel';
import User from './discord.js/User';
import Client from '../util/Client';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export default class Star {
	public client!: Client;
	public userIDs: Snowflake[];
	public messageID: Snowflake;
	public channelID: Snowflake;
	public starboardID: Snowflake;
	public guildID: Snowflake;

	constructor(client: Client, data: RawStar) {
		Object.defineProperty(this, 'client', { value: client });

		this.userIDs = JSON.parse(data.users);
		this.messageID = data.message_id;
		this.channelID = data.channel_id;
		this.starboardID = data.starboard_id;
		this.guildID = data.guild_id;
	}

	get starCount() {
		return this.userIDs.length;
	}

	public async removeStar(user: User) {
		this.userIDs = await this.client.database.addRemoveStar(
			this.guild,
			this.messageID,
			user.id,
			false
		);
		const message = await this.starboardMessage();
		await message.edit(Responses.STARBOARD_EMBED(this.starCount, await this.message()));
		return this;
	}

	public async starboardMessage() {
		return (this.client.channels.resolve(
			this.client.config.guilds.get(this.guildID)!.starboard!.channelID
		) as TextChannel).messages.fetch(this.starboardID) as Promise<GuildMessage<true>>;
	}

	public async addStar(user: User) {
		this.userIDs = await this.client.database.addRemoveStar(
			this.guild,
			this.messageID,
			user.id,
			true
		);
		const message = await this.starboardMessage();
		await message.edit(Responses.STARBOARD_EMBED(this.starCount, await this.message()));
		return this;
	}

	public message() {
		return (this.client.channels.resolve(this.channelID) as TextChannel)
			.messages.fetch(this.messageID) as Promise<GuildMessage>;
	}
	
	get guild() {
		return this.client.guilds.resolve(this.guildID) as Guild;
	}

	get users() {
		return this.userIDs.map(id => this.client.users.resolve(id));
	}
}

export interface RawStar {
	guild_id: Snowflake;
	message_id: Snowflake;
	starboard_id: Snowflake;
	channel_id: Snowflake;
	stars: number;
	users: string;
}
