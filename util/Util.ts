import * as crypto from 'crypto';
import { Collection, User, GuildMember, Snowflake, MessageEmbed } from 'discord.js';
import Client from './Client';
import { Errors, ModerationActionTypes, Responses, FLAGS_REGEX } from './Constants';
import Message from '../structures/discord.js/Message';

const getCipherKey = (password: string) => crypto.createHash('sha256')
	.update(password)
	.digest();

export default class Util {

	static extractFlags(string: string): {
		flags: FlagData;
		string: string;
	} {
		const flags = [...string.matchAll(FLAGS_REGEX)]
			.map(arr => arr.slice(1));
		const flagsObj: { [key: string]: string } = {};
		for (const [name, value] of flags) {
			flagsObj[name] = value.startsWith('"') ? value.slice(1, value.length - 1) : value;
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

	/* eslint-disable no-await-in-loop */
	static async reason(message: Message, options?: { fetchMembers?: false; withFlags?: false }): Promise<ReasonData>;
	static async reason(message: Message, options: { fetchMembers?: false; withFlags: true }): Promise<ReasonData & {
		flags: FlagData;
	}>;
	static async reason(message: Message, options: { fetchMembers: true; withFlags?: false }): Promise<ReasonData & {
		members: Collection<Snowflake, GuildMember & { client: Client }>;
	}>;
	static async reason(message: Message, options: { fetchMembers: true; withFlags: true }): Promise<ReasonData & {
		flags: FlagData;
		members: Collection<Snowflake, GuildMember & { client: Client }>;
	}>;
	static async reason(message: Message, { fetchMembers = false, withFlags = false } = {}) {
		const { client } = message;
		const users = new Collection<Snowflake, User & { client: Client }>();
		const [, ...content] = message.content.split(' ');
		for (const word of [...content]) {
			const [id] = word.match(/\d{17,19}/) || [];
			if (!id) break;
			content.shift();
			let user: User & { client: Client };
			try {
				user = await client.users.fetch(id) as User & { client: Client };
			} catch {
				throw new Error(Errors.RESOLVE_ID(id));
			}
			users.set(user.id, user);
		}

		const data: {
			flags?: FlagData;
			members?: Collection<Snowflake, GuildMember & { client: Client }>;
			reason: string;
			users: Collection<Snowflake, User & { client: Client }>;
		} = { reason: content.join(' '), users };

		if (fetchMembers) {
			const members = data.members = new Collection<Snowflake, GuildMember & { client: Client }>();
			for (const user of users.values()) {
				try {
					const member = await message.guild!.members.fetch(user) as GuildMember & { client: Client };
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
	/* eslint-enable no-await-in-loop */

	static async sendLog(moderator: User, users: User[], action: keyof typeof ModerationActionTypes, extras: {
		[key: string]: unknown;
		reason: string;
	}) {
		const { client } = moderator as User & { client: Client };
		const { reason, screenshots } = extras;
		delete extras.reason;
		delete extras.screenshots;
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

		const channel = client.config.punishmentChannel;
		const message = await channel.send('Initializing new case...') as Message;
		const caseData = await client.database.newCase({
			action,
			extras,
			message,
			moderator,
			reason,
			screenshots: Array.isArray(screenshots) ? screenshots : undefined,
			users
		});
		await message.edit(`Case ${caseData.id}`, embed);
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
}

export type PromiseObject<T> = Promise<T> & {
	resolve: (value?: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
};

export interface ReasonData {
	reason: string;
	users: Collection<Snowflake, User & { client: Client }>;
}

export interface FlagData {
	[key: string]: string | undefined;
}