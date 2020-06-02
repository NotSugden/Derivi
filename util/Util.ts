import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Collection, Snowflake, MessageEmbed } from 'discord.js';
import fetch from 'node-fetch';
import Client from './Client';
import CommandError from './CommandError';
import { ModerationActionTypes, Responses, FLAGS_REGEX, OPTIONS_REGEX } from './Constants';
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
			.map(arr => arr.slice(1));
		const flagsObj: { [key: string]: string | boolean | number } = {};
		for (const [name, value] of flags) {
			flagsObj[name] = value.startsWith('"') ? value.slice(1, value.length - 1) : value;
			if (flagTypes) {
				const data = flagTypes.find(flag => flag.name === name);
				if (!data) throw new CommandError('INVALID_FLAG', name, flagTypes.map(flag => flag.name));
				if (data.type === 'boolean') {
					if (value === 'true' || value === 'false') flagsObj[name] = value === 'true';

				} else if (data.type === 'number') {
					const number = parseInt(value);
					if (!isNaN(number)) flagsObj[name] = number;
				}

				if (typeof flagsObj[name] !== data.type) {
					throw new CommandError('INVALID_FLAG_TYPE', data.name, data.type);
				}
			}
		}
		return {
			flags: flagsObj, 
			string: string.replace(FLAGS_REGEX, '').replace(/\s\s+/g, ' ')
		};
	}

	static encrypt(data: Buffer, password: string) {
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv('aes256', getCipherKey(password), iv);
		const buffer = Buffer.concat([iv, cipher.update(data), cipher.final()]);
		return buffer;
	}

	static decrypt(encryptedData: Buffer, password: string) {
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

	static async sendLog(moderator: User, users: User[], action: keyof typeof ModerationActionTypes, extras: {
		[key: string]: unknown;
    reason: string;
    guild: Guild;
	}) {
		const { client } = moderator;
		const { reason, screenshots, guild } = extras;
		delete extras.reason;
		delete extras.screenshots;
		delete extras.guild;
		const embed = new MessageEmbed({
			color: ModerationActionTypes[action],
			fields: Responses.MODERATION_LOG_FIELDS(moderator, users)
			/* Description set using setDescription as passing it
			 * in the options object doesn't take a StringResolvable
			 * which *is* what the `MODERATION_LOG_DESCRIPTION` returns
			 */
		}).setDescription(Responses.MODERATION_LOG_DESCRIPTION(action, reason, extras));
		if (client.config.attachmentLogging) {
			embed.addField(
				'Screenshots',
				Array.isArray(screenshots) ?
					screenshots.join('\n') :
					'None attached'
			);
		}
    
		const config = client.config.guilds.get(guild.id)!;

		const channel = client.channels.resolve(
			config.casesChannelID
		) as TextChannel;
		const message = await channel!.send('Initializing new case...') as Message;
		const caseData = await client.database.newCase({
			action,
			extras,
			guild,
			message,
			moderator,
			reason,
			screenshots: Array.isArray(screenshots) ? screenshots : undefined,
			users
		});
		await message.edit(`Case ${caseData.id}`, embed);
		if (client.config.attachmentLogging) {
			const VALID_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];
			moderator.send(`Please reply to this message with a screenshot to attach to case ${caseData.id}!`)
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
							time: 6e4
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
						await moderator.send(`Updated case ${caseData.id}`);
					} catch (error) {
						if (error instanceof Map) {
							await moderator.send(
								// eslint-disable-next-line max-len
								`Timeout for case ${caseData.id}, attach a screenshot in <#${config.staffCommandsChannelID}> using the \`attach\` command`
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

	static levelCalc(level: number) {
		return (
			(5 / 6) *
			(level + 1) *
			(2 * (level + 1) * (level + 1) + 27 * (level + 1) + 91)
		);
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

export interface Flag {
	type: 'string' | 'number' | 'boolean';
	name: string;
}