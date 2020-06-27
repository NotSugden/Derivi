import * as djs from 'discord.js';
import Client from './Client';
import DMChannel from '../structures/discord.js/DMChannel';
import Guild from '../structures/discord.js/Guild';
import GuildMember from '../structures/discord.js/GuildMember';
import DeriviMessage from '../structures/discord.js/Message';
import User from '../structures/discord.js/User';

export interface Invite extends Omit<djs.Invite, 'client' | 'channel' | 'guild' | 'inviter'> {
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

export interface PartialMessage extends Omit<djs.PartialMessage, 'channel' | 'client' | 'author'> {
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
	readonly member: null;
}

export type Message<E = false> = GuildMessage<E> | DMMessage;

export interface Role extends Omit<djs.Role, 'client' | 'guild'> {
	readonly client: Client;
	guild: Guild;
}