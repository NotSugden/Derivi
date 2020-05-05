import { Snowflake } from 'discord.js';
import Message from './discord.js/Message';
import TextChannel from './discord.js/TextChannel';
import User from './discord.js/User';
import Client from '../util/Client';
import { Responses } from '../util/Constants';

export default class Star {
	public client!: Client;
	public userIDs: Snowflake[];
	public messageID: Snowflake;
	public channelID: Snowflake;
	public starboardID: Snowflake;

	constructor(client: Client, data: RawStar) {
		Object.defineProperty(this, 'client', { value: client });

		this.userIDs = JSON.parse(data.users);
		this.messageID = data.message_id;
		this.channelID = data.channel_id;
		this.starboardID = data.starboard_id;
	}

	get starCount() {
		return this.userIDs.length;
	}

	public async removeStar(user: User) {
		this.userIDs = await this.client.database.addRemoveStar(
			this.messageID,
			user.id,
			false
		);
		const message = await this.starboardMessage();
		await message.edit(Responses.STARBOARD_EMBED(this.starCount, await this.message()));
		return this;
	}

	public async starboardMessage() {
		return this.client.config.starboard!.channel
			.messages.fetch(this.starboardID) as Promise<Message>;
	}

	public async addStar(user: User) {
		this.userIDs = await this.client.database.addRemoveStar(
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
			.messages.fetch(this.messageID) as Promise<Message>;
	}

	get users() {
		return this.userIDs.map(id => this.client.users.resolve(id));
	}
}

export interface RawStar {
	message_id: Snowflake;
	starboard_id: Snowflake;
	channel_id: Snowflake;
	stars: number;
	users: string;
}
