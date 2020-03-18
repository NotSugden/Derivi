import * as djs from 'discord.js';
import Client from './Client';
import Guild from '../structures/discord.js/Guild';
import User from '../structures/discord.js/User';

export type Invite = Extend<djs.Invite, {
	client: Client;
	channel: Exclude<djs.GuildChannelTypes, djs.CategoryChannel> & {
		client: Client;
		guild: Guild;
	} | Omit<djs.PartialDMChannel, 'client'> & {
		client: Client;
	};
	guild: Guild | null;
	inviter: User | null;
}>;


type Extend<C, P extends object> = {
	[K in keyof Omit<C, keyof P>]: C[K];
} & {
	[K in keyof P]: P[K]
};