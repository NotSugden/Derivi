import * as djs from 'discord.js';
import Client from './Client';
import Guild from '../structures/discord.js/Guild';
import Message from '../structures/discord.js/Message';
import User from '../structures/discord.js/User';

export interface Invite extends djs.Invite {
	readonly client: Client;
	channel: (
		(djs.GuildChannel & { guild: Guild }) |
		djs.PartialGroupDMChannel
	) & {
		client: Client;
	};
	guild: Guild | null;
	inviter: User | null;
}

export interface PartialMessage extends djs.PartialMessage {
	author: User | null;
	channel: Message['channel'];
	readonly client: Client;
}