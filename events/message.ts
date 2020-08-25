/* eslint-disable consistent-return */
import {
	ClientEvents, MessageAdditions,
	MessageEditOptions, MessageOptions,
	StringResolvable
} from 'discord.js';
import { logAttachments, runPartnership, runLevels, XP_COOLDOWN, messageLink } from './utils/message';
import Command, { CommandData, CommandCategory } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandError from '../util/CommandError';
import { CommandErrors, MESSAGE_URL_REGEX } from '../util/Constants';
import { QueryTypes } from '../util/DatabaseManager';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';



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
				await logAttachments(message);
			}

			const madePartnership = await runPartnership(message, config);

			if (madePartnership) return;

			if (
				config.generalChannelID === message.channel.id &&
				!XP_COOLDOWN.has(message.author.id) && !edited
			) {
				await runLevels(message, config);
			}
		}

		if (!client.config.prefix.some(pfx => message.content.startsWith(pfx))) {
			const urlMatch = [...message.content.matchAll(MESSAGE_URL_REGEX)];

			// maybe support more at a later date
			if (urlMatch.length === 1) {
				await messageLink(message, urlMatch[0]);
			}
			return;
		}
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

		const isModerationCommand = command.category === CommandCategory.MODERATION;

		if (
			!['attach', 'history', 'warnings', 'case', 'purge'].includes(command.name)
			&& isModerationCommand && !config
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
    
		if (command.name !== 'attach' && isModerationCommand && config?.mfaModeration) {
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
		if (error === 'PRODUCTION_ERROR') return;
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
