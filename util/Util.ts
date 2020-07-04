import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import ms from '@naval-base/ms';
import { Collection, Snowflake, MessageEmbed, DiscordAPIError } from 'discord.js';
import fetch from 'node-fetch';
import Client from './Client';
import CommandError from './CommandError';
import { ModerationActionTypes, Responses, FLAGS_REGEX, OPTIONS_REGEX } from './Constants';
import { GuildMessage, DMMessage } from './Types';
import { VALID_EXTENSIONS } from '../commands/Moderation/Attach';
import OAuthUser from '../structures/OAuthUser';
import Guild from '../structures/discord.js/Guild';
import GuildMember from '../structures/discord.js/GuildMember';
import Message from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import User from '../structures/discord.js/User';

const arrToObject = <T extends string>(array: T[], fn: (key: string, index: number) => unknown) => {
	const obj: { [key: string]: unknown } = {};
	for (let i = 0;i < array.length;i++) {
		const key = array[i];
		obj[key] = fn(key, i);
	}
	return obj as { [K in T]: null };
};

const getCipherKey = (password: string) => crypto.createHash('sha256')
	.update(password)
	.digest();

export default class Util {
	static async downloadImage(url: string, name: string, config: Client['config']) {
		const buffer = await fetch(url)
			.then(resp => resp.buffer())
			.then(data => this.encrypt(data, config.encryptionPassword));
		await fs.writeFile(path.join(config.filesDir, name), buffer);
		return `${config.attachmentsURL!}/${name}`;
	}

	static getOptions<T extends string>(string: string, options: T[]) {
		const given = [...string.matchAll(OPTIONS_REGEX)]
			.map(arr => arr.slice(1)) as [T, string][];
		const obj: { [K in T]: string | null } = arrToObject(options, () => null);
		for (const [name, value] of given) {
			obj[name] = value.startsWith('"') ? value.slice(1, value.length - 1) : value;
		}
		return obj;
	}

	static extractFlags(string: string, flagTypes?: Flag[]): {
		flags: FlagData;
		string: string;
	} {
		const flags = [...string.matchAll(FLAGS_REGEX)]
			.map(arr => arr.slice(2));
		const flagsObj: { [key: string]: string | boolean | number } = {};
		for (const [name, value] of flags) {
			flagsObj[name] = /^("|'|“)/.test(value) ? value.slice(1, value.length - 1) : value;
			if (flagTypes) {
				const data = flagTypes.find(flag => flag.name === name);
				if (!data) throw new CommandError('INVALID_FLAG', name, flagTypes.map(flag => flag.name));
				const includes = (string: FlagType) => Array.isArray(data.type) && data.type.includes(string);
				if (data.type === 'boolean' || includes('boolean')) {
					if (value === 'true' || value === 'false') flagsObj[name] = value === 'true';

				} else if (data.type === 'number' || includes('number')) {
					const number = parseInt(value);
					if (!isNaN(number)) flagsObj[name] = number;
				}
        
				const type = typeof flagsObj[name];

				if (typeof data.type === 'string' ? type !== data.type : !includes(type as FlagType)) {
					throw new CommandError('INVALID_FLAG_TYPE', data.name, data.type);
				}
			}
		}
		return {
			flags: flagsObj, 
			string: string.replace(FLAGS_REGEX, '').replace(/\s\s+/g, ' ')
		};
	}

	static encrypt(data: Buffer | string, password: string) {
		if (typeof data === 'string') {
			data = Buffer.from(data);
		}
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv('aes256', getCipherKey(password), iv);
		const buffer = Buffer.concat([iv, cipher.update(data), cipher.final()]);
		return buffer;
	}

	static decrypt(encryptedData: Buffer | string, password: string) {
		if (typeof encryptedData === 'string') {
			encryptedData = Buffer.from(encryptedData, 'base64');
		}
		const iv = encryptedData.slice(0, 16);
		const data = encryptedData.slice(16);
		const decipher = crypto.createDecipheriv('aes256', getCipherKey(password), iv);
		return Buffer.concat([decipher.update(data), decipher.final()]);
	}

	static async users(message: Message, limit?: number): Promise<Collection<Snowflake, User>>;
	static async users(message: Message, limit: 1): Promise<User | null>;
	static async users(message: Message, limit = 0) {
		const { client } = message;
		const users = new Collection<Snowflake, User>();
		const [, ...content] = message.content.split(' ');
		for (const word of [...content]) {
			const [id] = word.match(/\d{17,19}/) || [];
			if (!id) break;
			content.shift();
			let user: User;
			try {
				user = await client.users.fetch(id) as User;
			} catch {
				throw new CommandError('RESOLVE_ID', id);
			}
			users.set(user.id, user);
			if (limit && users.size === limit) {
				return limit === 1 ? users.first() : users;
			}
		}
		return limit === 1 ? null : users;
	}

	static async reason(message: Message, options?: { fetchMembers?: false; withFlags?: false }): Promise<ReasonData>;
	static async reason(message: Message, options: { fetchMembers?: false; withFlags: Flag[] }): Promise<ReasonData & {
		flags: FlagData;
	}>;
	static async reason(message: Message, options: { fetchMembers: true; withFlags?: false }): Promise<ReasonData & {
		members: Collection<Snowflake, GuildMember>;
	}>;
	static async reason(message: Message, options: { fetchMembers: true; withFlags: Flag[] }): Promise<ReasonData & {
		flags: FlagData;
		members: Collection<Snowflake, GuildMember>;
	}>;
	static async reason(message: Message, { fetchMembers = false, withFlags = false }: {
		fetchMembers?: boolean;
		withFlags?: false | Flag[];
	} = {}) {
		const { client } = message;
		const users = new Collection<Snowflake, User>();
		const [, ...content] = message.content.split(' ');
		for (const word of [...content]) {
			const [id] = word.match(/\d{17,19}/) || [];
			if (!id) break;
			content.shift();
			let user: User;
			try {
				user = await client.users.fetch(id) as User;
			} catch {
				throw new CommandError('RESOLVE_ID', id);
			}
			users.set(user.id, user);
		}

		const data: {
			flags?: FlagData;
			members?: Collection<Snowflake, GuildMember>;
			reason: string;
			users: Collection<Snowflake, User>;
		} = { reason: content.join(' '), users };

		if (fetchMembers) {
			const members = data.members = new Collection<Snowflake, GuildMember>();
			for (const user of users.values()) {
				try {
					const member = await message.guild!.members.fetch(user) as GuildMember;
					members.set(member.id, member);
				} catch { } // eslint-disable-line no-empty
			}
		}

		if (withFlags) {
			const { flags, string: newReason } = Util.extractFlags(data.reason);
			data.reason = newReason;
			data.flags = flags;
		}
		
		return data;
	}

	static async sendLog(options: {
		action: keyof typeof ModerationActionTypes;
		context?: Message;
		extras: { [key: string]: string };
    guild: Guild;
		moderator: User;
		reason: string;
		screenshots: string[];
		users: User[];
	}) {
		const { client } = options.guild;
		const embed = new MessageEmbed({
			color: ModerationActionTypes[options.action],
			fields: Responses.MODERATION_LOG_FIELDS(options.moderator, options.users)
			/* Description set using setDescription as passing it
			 * in the options object doesn't take a StringResolvable
			 * which *is* what the `MODERATION_LOG_DESCRIPTION` returns
			 */
		}).setDescription(Responses.MODERATION_LOG_DESCRIPTION(options.action, options.reason, {
			context: options.context,
			extras: options.extras
		}));
		if (client.config.attachmentLogging) {
			embed.addField(
				'Screenshots', options.screenshots.length ?
					options.screenshots.join('\n') : 'None attached'
			);
		}
    
		const config = client.config.guilds.get(options.guild.id)!;

		const channel = client.channels.resolve(
			config.casesChannelID
		) as TextChannel;
		const message = await channel!.send('Initializing new case...') as GuildMessage<true>;
		const caseData = await client.database.createCase({
			action: options.action,
			extras: options.extras,
			guild: options.guild,
			message: message,
			moderator: options.moderator,
			reason: options.reason,
			screenshots: options.screenshots,
			users: options.users
		});
		await message.edit(`Case ${caseData.id}`, embed);
		if (client.config.attachmentLogging) {
			options.moderator.send(`Please reply to this message with a screenshot to attach to case ${caseData.id}!`)
				.then(async ({ channel }) => {
					try {
						const response = (await channel.awaitMessages((msg: Message) => {
							if (msg.author.bot || !msg.attachments.size) return false;
							if (msg.attachments.some(({ proxyURL }) => !VALID_EXTENSIONS.includes(
								path.extname(proxyURL).slice(1).toLowerCase()
							))) return false;
							return true;
						}, {
							errors: ['time'],
							max: 1,
							time: 18e4
						})).first()!;
            
						const urls = [];
						for (const attachment of response.attachments.values()) {
							const url = await Util.downloadImage(
								attachment.proxyURL,
								`case-reference-${caseData.id}-${attachment.id + path.extname(attachment.proxyURL)}`,
								client.config
							);
							urls.push(url);
						}
						await caseData.update(urls);
						await options.moderator.send(`Updated case ${caseData.id}`);
					} catch (error) {
						if (error instanceof Map) {
							await options.moderator.send(
								`Timeout for case ${caseData.id}, attach a screenshot in ` +
								`<#${config.staffCommandsChannelID}> using the \`attach\` command`
							);
							return;
						}
						throw error;
					}
				}).catch(error => {
					if (error.message === 'Cannot send messages to this user') return;
					console.error(error);
				});
		}
		return caseData; 
	}

	static makePromiseObject<T>() {
		const promise = new Promise<T>((resolve, reject) => {
			// setImmediate has to be used here, otherwise an error is thrown
			setImmediate(() => {
				promise.resolve = resolve;
				promise.reject = reject;
			});
		}) as PromiseObject<T>;
		return promise;
	}

	static manageable(member: GuildMember, by: GuildMember) {
		if (member.id === member.guild.ownerID) return false;
		if (by.id === member.guild.ownerID) return true;
		const position = member.roles.highest.comparePositionTo(by.roles.highest);
		if (position < 0) return true;
		return false;
	}
  
	static async fetchOauthUser(client: Client, accessToken: string, tokenType = 'Bearer') {
		const response = await fetch(
			`${client.options.http!.api}/v${client.options.http!.version}/users/@me`, {
				headers: {
					Authorization: `${tokenType} ${accessToken}`
				}
			}
		);
		const data = await response.json();
		if (response.status !== 200) {
			if (response.status === 401 || response.status === 403) {
				await client.database.query(
					'DELETE FROM users WHERE access_token = :accessToken',
					{ accessToken }
				);
			}
			throw new DiscordAPIError('/users/@me', data, 'GET', response.status);
		}
		return new OAuthUser(client, data);
	}

	static async awaitResponse<C extends Message['channel']>(
		channel: C, user: User, allowedResponses: string[] | '*', time = 18e4
	) {
		const response = (await channel.awaitMessages(message => {
			if (message.author.id !== user.id) return false;
			if (allowedResponses === '*') return true;
			return allowedResponses.includes(message.content.toLowerCase());
		}, {
			max: 1,
			time
		})).first() as C extends GuildMessage<true>['channel'] ? GuildMessage<true> : DMMessage;
		return response ? response : null;
	}

	static parseMS<T extends { reason: string } | string>(
		data: T
	): T extends string ? number : T & { time: number } {
		const string = (typeof data === 'string'
			? data
			: (data as { reason: string }).reason).split(' ');
		let time: number;
		try {
			time = ms(string.shift() || '');
		} catch {
			time = -1;
		}
		return (typeof data === 'string'
			? time
			: Object.assign(data, { reason: string.join(' '), time })
		) as T extends string ? number : T & { time: number };
	}
}

export type PromiseObject<T> = Promise<T> & {
	resolve: (value?: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
};

export interface ReasonData {
	reason: string;
	users: Collection<Snowflake, User>;
}

export interface FlagData {
	[key: string]: string | boolean | number;
}

type FlagType = 'string' | 'number' | 'boolean'

export interface Flag {
	type: FlagType | FlagType[];
	name: string;
}