import * as djs from 'discord.js';
import {
	CategoryChannel, DMChannel,
	GuildMember, NewsChannel,
	StoreChannel, TextChannel,
	VoiceChannel
} from 'discord.js';
import { DeriviClientT } from './Client';
import Guild, { DeriviGuildT } from '../structures/discord.js/Guild';
import { DeriviMessageT } from '../structures/discord.js/Message';

export type TextBasedChannels = djs.Message['channel'];

export type GuildChannels =
	| TextChannel
	| NewsChannel
	| StoreChannel
	| CategoryChannel
	| VoiceChannel;

export interface GuildMessage<E = false> extends djs.Message {
	channel: Exclude<TextBasedChannels, DMChannel>;
	guild: Guild;
	member: E extends true ? GuildMember : (GuildMember | null);
}

export interface DMMessage extends djs.Message {
	channel: DMChannel;
	guild: null;
	readonly member: null;
}

export type MessageT<M = false> = GuildMessage<M> | DMMessage;

export type MapObject<T extends object, V> = {
	[K in keyof T]: V
};

export interface PackageJSON {
	name: string;
	version: string;
	description: string;
	main: string;
	scripts: {
		[key: string]: string;
		build: string;
		start: string;
	};
	repository: {
		type: string;
		url: string;
	};
	author: string;
	license: string;
	bugs: {
		url: string;
	};
	homepage: string;
	dependencies: {
		[key: string]: string;
	};
	devDependencies: {
		[key: string]: string;
	};
}

/* eslint-disable @typescript-eslint/no-empty-interface */

declare module 'discord.js' {
	interface Client extends DeriviClientT { }

	interface Guild extends DeriviGuildT { }

	interface Message extends DeriviMessageT { }
}