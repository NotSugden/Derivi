import * as djs from 'discord.js';
import Client from './Client';
import DMChannel from '../structures/discord.js/DMChannel';
import Guild from '../structures/discord.js/Guild';
import GuildMember from '../structures/discord.js/GuildMember';
import DeriviMessage from '../structures/discord.js/Message';
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
	channel: DeriviMessage['channel'];
	readonly client: Client;
}

export interface GuildMessage<E = false> extends DeriviMessage {
	channel: Exclude<DeriviMessage['channel'], DMChannel>;
	guild: Guild;
	member: E extends true ? GuildMember : (GuildMember | null);
}

export interface DMMessage extends DeriviMessage {
	channel: DMChannel;
	guild: null;
	member: null;
}

export type Message<E = false> = GuildMessage<E> | DMMessage;