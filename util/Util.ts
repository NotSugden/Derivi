import * as crypto from 'crypto';
import { Collection, User, GuildMember, Snowflake, MessageEmbed } from 'discord.js';
import Client from './Client';
import { Errors, ModerationActionTypes, Responses } from './Constants';
import Message from '../structures/discord.js/Message';

const getCipherKey = (password: string) => crypto.createHash('sha256')
	.update(password)
	.digest();

export default class Util {
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
	static async reason(message: Message, fetchMembers?: false): Promise<ReasonData>;
	static async reason(message: Message, fetchMembers: true): Promise<ReasonData & {
		members: Collection<Snowflake, GuildMember>;
	}>;
	static async reason(message: Message, fetchMembers = false) {
		const { client } = message;
		const users = new Collection<Snowflake, User>();
		const [, ...content] = message.content.split(' ');
		for (const word of [...content]) {
			const [id] = word.match(/\d{17,19}/) || [];
			if (!id) break;
			content.shift();
			let user: User;
			try {
				user = await client.users.fetch(id);
			} catch {
				throw new Error(Errors.RESOLVE_ID(id));
			}
			users.set(user.id, user);
		}

		const data: {
			members?: Collection<Snowflake, GuildMember>;
			reason: string;
			users: Collection<Snowflake, User>;
		} = { reason: content.join(' '), users };

		if (fetchMembers) {
			const members = data.members = new Collection<Snowflake, GuildMember>();
			for (const user of users.values()) {
				try {
					const member = await message.guild!.members.fetch(user);
					members.set(member.id, member);
				} catch { } // eslint-disable-line no-empty
			}
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
}

interface ReasonData {
	reason: string;
	users: Collection<Snowflake, User>;
}