/* eslint-disable consistent-return */
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { MessageOptions, MessageEditOptions, StringResolvable, MessageAdditions, Snowflake } from 'discord.js';
import fetch from 'node-fetch';
import { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import Levels from '../structures/Levels';
import Message from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import { Events } from '../util/Client';
import CommandError from '../util/CommandError';
import { CommandErrors, Responses } from '../util/Constants';
import { QueryTypes } from '../util/DatabaseManager';
import Util from '../util/Util';

const XP_COOLDOWN = new Set<Snowflake>();
const random = (min: number, max: number): number => {
	const ran = Math.floor(Math.random() * max);
	if (ran < min) return random(min, max);
	return ran;
};

export default (async message => {
	try {
		const { client, guild } = message;
		const config = guild && client.config.guilds.get(guild.id);
		const edited = Boolean(message.editedTimestamp);
		if (
			message.author.bot ||
			!message.guild
		) return;
		if (config) {
			try {
				if (!edited) {
					await client.database.query(QueryTypes.INSERT, 'messages', {
						channel_id: message.channel.id,
						guild_id: message.guild.id,
						id: message.id, 
						sent_timestamp: message.createdAt,
						user_id: message.author.id
					});
				}
			} catch (error) {
				console.error(error);
			}
			if (message.attachments.size && config.filePermissionsRole && client.config.attachmentLogging && !edited) {
				const urls = message.attachments.map(({ proxyURL }) => proxyURL);
				for (let i = 0; i < urls.length; i++) {
					const url = urls[i];
					const extension = extname(url);
					const name = join(
						client.config.filesDir,
						`${message.id}-${i}${extension}`
					);
					const buffer = await fetch(url)
						.then(response => response.buffer())
						.then(data => Util.encrypt(data, client.config.encryptionPassword));
					await fs.writeFile(name, buffer);
				}
			}

			if (config.reportsRegex.length && config.reportsChannelID) {
				const content = message.content.replace(/( |\n)*/g, '');
				if (config.reportsRegex.some(regex => regex.test(content))) {
					(client.channels.resolve(config.reportsChannelID) as TextChannel)
						.send(Responses.AUTO_REPORT_EMBED(message));
				}
			}
			const partnerChannel = config.partnerships.channels.get(message.channel.id);
			if (partnerChannel) {
				if (message.invites.length > 1) {
					await message.delete();
					throw new CommandError('TOO_MANY_INVITES').dm();
				} else if (!message.invites.length) {
					await message.delete();
					throw new CommandError('NO_INVITE').dm();
				}

				try {
					const invite = await client.fetchInvite(message.invites[0]);
					if (!invite.guild) throw new CommandError('GROUP_INVITE').dm();
					else if (invite.guild.id === message.guild.id) {
						throw new CommandError('UNKNOWN_INVITE', invite.code).dm();
					}

					if (invite.memberCount < partnerChannel.minimum || invite.memberCount > partnerChannel.maximum) {
						throw new CommandError(
							'PARTNER_MEMBER_COUNT', invite.memberCount < partnerChannel.minimum
						).dm();
					}

					await (client.channels.resolve(config.partnerships.rewardsChannelID) as TextChannel)
						.send(Responses.PARTNER_REWARD(
							message.author, message.channel as TextChannel, partnerChannel.points
						));

					const points = await client.database.points(message.author);
					await points.set({ amount: points.amount + partnerChannel.points });

					return;
				} catch (error) {
					await message.delete();
					if (error.message === 'The user is banned from this guild.'){
						throw new CommandError('CLIENT_BANNED_INVITE').dm();
					} else if (error.message === 'Unknown Invite') {
						throw new CommandError('UNKNOWN_INVITE', message.invites[0]).dm();
					}
					throw error;
				}
			}
		
			const allowedChannels = client.config.allowedLevelingChannels;
			if (
				(!allowedChannels.length || allowedChannels.includes(message.channel.id)) &&
				!XP_COOLDOWN.has(message.author.id) && !edited
			) {
				const levels = await client.database.levels(message.author.id);

				const newData: { xp: number; level?: number } = {
					xp: levels.xp + random(12, 37)
				};
				if (newData.xp > Levels.levelCalc(levels.level)) {
					const { levelRoles } = config;
					newData.level = levels.level + 1;
					const index = levelRoles?.findIndex(data => data.level === newData.level);
					if (typeof index === 'number' && index !== -1) {
						if (index > 0 && message.member.roles.cache.has(levelRoles![index - 1].id)) {
							const roles = message.member.roles.cache.keyArray();
							roles.splice(roles.indexOf(levelRoles![index - 1].id), 1, levelRoles![index].id);
							await message.member.roles.set(roles);
						} else {
							await message.member.roles.add(levelRoles![index].id);
						}
					}
				}

				await levels.set(newData);

				XP_COOLDOWN.add(message.author.id);
				setTimeout(() => XP_COOLDOWN.delete(message.author.id), 6e4);

				if (typeof newData.level === 'number') {
					await message.channel.send(Responses.LEVEL_UP(message.author, newData.level)); 
				}
			}
		}

		if (!client.config.prefix.some(pfx => message.content.startsWith(pfx))) return;
		const [plainCommand] = message.content.slice(1).split(' ');
		const args = new CommandArguments(message);
		const command = client.commands.resolve(plainCommand);
		if (!command) return;
		const { permissions } = command;

		const send = (async (
			content: StringResolvable,
			options?: MessageOptions | MessageEditOptions | MessageAdditions
		) => {
			if (typeof message.commandID === 'string') {
				const msg = message.channel.messages.cache.get(message.commandID);
				// Lazy fix here casting it to MessageEditOptions, TS complains otherwise.
				if (msg) return msg.edit(content, options as MessageEditOptions) as Promise<Message>;
			}

			// Lazy fix here casting it to MessageOptions, TS complains otherwise.
			const msg = await message.channel.send(content, options as MessageOptions | MessageAdditions) as Message;
			message.commandID = msg.id;
			return msg;
		}) as CommandData['send'];

		if (
			!['attach', 'history', 'warnings', 'case', 'purge'].includes(command.name)
			&& command.category === 'Moderation' && !config
		) {
			throw new CommandError('GUILD_NOT_CONFIGURED');
		}

		let hasPermissions: boolean | string;
		if (typeof permissions === 'function') {
			hasPermissions = await permissions(message.member, message.channel as TextChannel);
		} else {
			hasPermissions = message.member.hasPermission(permissions);
		}
		if (!hasPermissions || typeof hasPermissions === 'string') {
			return send(typeof hasPermissions === 'string' ?
				hasPermissions : CommandErrors.INSUFFICIENT_PERMISSIONS
			);
		}
    
		if (command.name !== 'attach' && command.category === 'Moderation' && config?.mfaModeration) {
			const [data] = await client.database.query(
				'SELECT access_token, token_type, expires_at FROM users WHERE id = ?',
				message.author.id
			) as [{ access_token?: string; token_type?: string; expires_at?: Date }?];
			const error = new CommandError('NOT_LOGGED_IN', client.config.loginURL!).dm();
			if (!data || !data.expires_at || data.expires_at.getTime() < Date.now()) {
				throw error;
			}
      
			try {
				const user = await Util.fetchOauthUser(client, data.access_token!, data.token_type!);
				if (!user.mfaEnabled) {
					throw new CommandError('NEED_MFA').dm();
				}
			} catch (err) {
				if (err.message === '401: Unauthorized') throw error;
				throw err;
			}
		}

		await command.run(message, args, {
			edited,
			send
		});
	} catch (error) {
		if (error instanceof CommandError) {
			return error.dmError ?
				message.author.send(error.message)
					.catch(() => message.channel.send(CommandErrors.ERROR_MUST_DM)) :
				message.channel.send(error.message);
		}
		await message.channel.send([
			`An unexpected error has occoured: \`${error.name}\``,
			`\`\`\`js\n${error.message}\`\`\``
		]).catch(console.error);
		console.error(error);
	}
}) as (...args: Events['message']) => void;
