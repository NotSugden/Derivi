import { Snowflake } from 'discord.js';
import TextChannel from './discord.js/TextChannel';
import User from './discord.js/User';
import Client from '../util/Client';
import { CommandErrors, Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

export default class Giveaway {
	public client!: Client;
	public channelID: Snowflake;
	public createdByID: Snowflake;
	public endAt: Date;
	public messageID: Snowflake;
	public messageRequirement: number | null;
	public prize: string;
	public startAt: Date;
	public winnerIDs: Snowflake[] | null;

	constructor(client: Client, data: RawGiveaway) {
		Object.defineProperty(this, 'client', { value: client });

		this.startAt = new Date(data.start);
		this.endAt = new Date(data.end);

		this.channelID = data.channel_id;
		this.createdByID = data.created_by;
		this.messageID = data.message_id;
		this.prize = Util.decrypt(data.prize, client.config.encryptionPassword).toString();

		this.winnerIDs = data.winners ? JSON.parse(data.winners) : null;
		this.messageRequirement = data.message_requirement ?? null;
	}

	public async end() {
		const message = await this.message();
		const entries = await message.reactions.cache.get('🎁')!.users.fetch();
		entries.delete(this.client.user!.id);
		if (this.messageRequirement) {
			const config = this.client.config.guilds.get(message.guild.id)!;
			for (const user of entries.values()) {
				const [{ count }] = await this.client.database.query<{ count: number }>(
					'SELECT COUNT(*) AS count FROM messages WHERE sent_timestamp > ? AND channel_id = ?',
					new Date(this.startAt), config.generalChannelID
				);
				if (count < this.messageRequirement) entries.delete(user.id);
			}
		}
		if (entries.size === 0) {
			return message.channel.send(CommandErrors.NO_GIVEAWAY_WINNERS(
				this.prize, this.messageRequirement !== null
			));
		}
		const winner = entries.random() as User;
		await this.setWinners([winner.id]);
		return message.channel.send(Responses.WON_GIVEAWAY(winner, this.prize, message));
	}

	get ended() {
		return this.endAt.getTime() > Date.now();
	}

	get channel() {
		return this.client.channels.resolve(this.channelID) as TextChannel;
	}

	get winners() {
		return this.winnerIDs
			? this.winnerIDs.map(winnerID => this.client.users.resolve(winnerID)) as (User | null)[]
			: null;
	}

	public message() {
		return this.channel.messages.fetch(this.messageID) as Promise<GuildMessage<true>>;
	}

	public setWinners(userIDs: Snowflake[]) {
		return this.client.database.setGiveawayWinners(this.messageID, userIDs);
	}
}

export interface RawGiveaway {
	created_by: Snowflake;
	prize: string;
	message_id: Snowflake; 
	channel_id: Snowflake;
	start: Date;
	end: Date;
	winners: string | null;
	message_requirement: number | null;
}