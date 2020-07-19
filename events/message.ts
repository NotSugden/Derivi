/* eslint-disable consistent-return */
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import {
	ClientEvents, MessageAdditions,
	MessageEditOptions, MessageOptions,
	Snowflake, StringResolvable
} from 'discord.js';
import fetch from 'node-fetch';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import Levels from '../structures/Levels';
import CommandError from '../util/CommandError';
import { CommandErrors, Responses } from '../util/Constants';
import { QueryTypes } from '../util/DatabaseManager';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

const XP_COOLDOWN = new Set<Snowflake>();
const random = (min: number, max: number): number => {
	const ran = Math.floor(Math.random() * max);
	if (ran < min) return random(min, max);
	return ran;
};

export default (async message => {
	try {
		if (message.author.bot || !Util.isGuildMessage(message, true)) return;
		const { client, guild } = message;
		const config = await guild.fetchConfig();
		const edited = Boolean(message.editedTimestamp);
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
				client.emit('error', error);
			}
			if (message.attachments.size && !edited && client.config.attachmentLogging) {
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

			const [partnerChannel] = await client.database.query<{
				min_members: number;
				max_members: number | null;
				points: number;
			}>(
				'SELECT min_members, max_members, points FROM partnership_channels WHERE channel_id = :channelID',
				{ channelID: message.channel.id }
			);
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

					if (
						invite.memberCount < partnerChannel.min_members ||
						(partnerChannel.max_members && invite.memberCount > partnerChannel.max_members)
					) {
						throw new CommandError(
							'PARTNER_MEMBER_COUNT', invite.memberCount < partnerChannel.min_members
						).dm();
					}

					await config.partnerRewardsChannel.send(Responses.PARTNER_REWARD(
						message.author, message.channel, partnerChannel.points
					));

					const points = await client.database.points(message.author);
					await points.set({ amount: points.amount + partnerChannel.points });
					await client.database.createPartnership({
						guild: { id: invite.guild.id, invite: invite.code },
						timestamp: new Date(),
						user: message.author
					});

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

			if (
				config.generalChannelID === message.channel.id &&
				!XP_COOLDOWN.has(message.author.id) && !edited
			) {
				const levels = await client.database.levels(message.author.id);

				const newData: { xp: number; level?: number } = {
					xp: levels.xp + random(12, 37)
				};
				if (newData.xp > Levels.levelCalc(levels.level)) {
					const newLevel = newData.level = levels.level + 1;
					const options = { guildID: config.guildID, level: newLevel };
					const [data] = await client.database.query<{ role_id: Snowflake }>(
						'SELECT role_id FROM level_roles WHERE guild_id = :guildID AND level = :level',
						options
					);
					if (data) {
						// only start removing roles after level 5 to reduce spam on new members
						let roles = message.member.roles.cache.keyArray();
						if (newLevel > 5) {
							const previousRoles = (await client.database.query<{ role_id: Snowflake }>(
								'SELECT role_id FROM level_roles WHERE guild_id = :guildID AND level < :level',
								options
							)).map(({ role_id }) => role_id);
							if (
								previousRoles.length &&
								previousRoles.some(roleID => roles.includes(roleID))
							) {
								roles = roles.filter(roleID => !previousRoles.includes(roleID));
							}
						}
						roles.push(data.role_id);
						await message.member.roles.set(roles);
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
		const { alias, command } = client.commands.resolve(plainCommand, true);
		if (!command) return;
		if (typeof alias === 'object') {
			if (alias.prepend) {
				args.unshift(...alias.prepend);
				args.regular.unshift(...alias.prepend);
			}
			if (alias.append) {
				args.push(...alias.append);
				args.regular.push(...alias.append);
			}
		}

		const send: CommandData['send'] = async (
			content: StringResolvable,
			options?: MessageOptions | MessageEditOptions | MessageAdditions
		) => {
			if (typeof message.commandID === 'string') {
				const msg = message.channel.messages.cache.get(message.commandID);
				// Lazy fix here casting it to MessageEditOptions, TS complains otherwise.
				if (msg) return msg.edit(content, options as MessageEditOptions) as Promise<GuildMessage<true>>;
			}

			// Lazy fix here casting it to MessageOptions, TS complains otherwise.
			const msg = await message.channel.send(content, options as MessageOptions | MessageAdditions);
			message.commandID = msg.id;
			return msg as GuildMessage<true>;
		};

		if (
			!['attach', 'history', 'warnings', 'case', 'purge'].includes(command.name)
			&& command.category === 'Moderation' && !config
		) {
			throw new CommandError('GUILD_NOT_CONFIGURED');
		}

		const hasPermissions = await Command.hasPermissions(command, message.member, message.channel);
		if (hasPermissions === null) return;
		const isString = typeof hasPermissions === 'string';
		if (!hasPermissions || isString) {
			return send(isString ?
				hasPermissions : CommandErrors.INSUFFICIENT_PERMISSIONS()
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
			`\`\`\`js\n${error.message || error}\`\`\``
		]).catch(console.error);
		console.error(error);
	}
}) as (...args: ClientEvents['message']) => void;
