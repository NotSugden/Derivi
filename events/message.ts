/* eslint-disable consistent-return */
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { MessageOptions, MessageEditOptions, StringResolvable, MessageAdditions, Snowflake } from 'discord.js';
import fetch from 'node-fetch';
import { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import Message from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import { Events } from '../util/Client';
import CommandError from '../util/CommandError';
import { CommandErrors, Responses } from '../util/Constants';
import Util from '../util/Util';

const XP_COOLDOWN = new Set<Snowflake>();
const random = (min: number, max: number): number => {
	const ran = Math.floor(Math.random() * max);
	if (ran < min) return random(min, max);
	return ran;
};

export default (async message => {
	try {
		const { client } = message;
		const edited = Boolean(message.editedTimestamp);
		if (
			message.author.bot ||
			message.channel.type === 'dm'
		) return;
		if (message.guild!.id === client.config.defaultGuildID) {
			if (client.config.attachmentLogging && !edited && message.attachments.size) {
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

			if (client.config.reportsRegex.length && client.config.reportsChannel) {
				const content = message.content.replace(/( |\n)*/g, '');
				if (client.config.reportsRegex.some(regex => regex.test(content))) {
					client.config.reportsChannel.send(Responses.AUTO_REPORT_EMBED(message));
				}
			}
		}

		const partnerChannel = client.config.partnershipChannels.get(message.channel.id);
		if (partnerChannel && client.config.partnerRewardsChannel) {
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
				else if (invite.guild.id === client.config.defaultGuildID) {
					await message.delete();
					throw new CommandError('UNKNOWN_INVITE', invite.code).dm();
				}

				if (invite.memberCount < partnerChannel.minimum || invite.memberCount > partnerChannel.maximum) {
					await message.delete();
					throw new CommandError('PARTNER_MEMBER_COUNT', invite.memberCount < partnerChannel.minimum).dm();
				}

				await client.config.partnerRewardsChannel.send(Responses.PARTNER_REWARD(
					message.author, message.channel as TextChannel, partnerChannel.points
				));

				const points = await client.database.points(message.author);
				await points.set({ points: points.amount + partnerChannel.points });

				return;
			} catch (error) {
				if (message.deletable) await message.delete();
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
			const { level, xp } = await client.database.levels(message.author.id);

			const newData = {
				xp: xp + random(12, 37)
			} as { xp: number; level?: number };
			if (newData.xp > Util.levelCalc(level)) {
				newData.level = level + 1;
			}

			await client.database.setLevels(message.author.id, newData);

			XP_COOLDOWN.add(message.author.id);
			setTimeout(() => XP_COOLDOWN.delete(message.author.id));

			if (typeof newData.level === 'number') {
				await message.channel.send(Responses.LEVEL_UP(message.author, newData.level)); 
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


		let hasPermissions: boolean | string;
		if (typeof permissions === 'function') {
			hasPermissions = await permissions(message.member!, message.channel as TextChannel);
		} else {
			hasPermissions = message.member!.hasPermission(permissions);
		}
		if (!hasPermissions || typeof hasPermissions === 'string') {
			return send(typeof hasPermissions === 'string' ?
				hasPermissions : CommandErrors.INSUFFICIENT_PERMISSIONS
			);
		}

		await command.run(message, args, {
			edited,
			send
		});
	} catch (error) {
		if (error instanceof CommandError) {
			return error.dmError ?
				message.author.send(error.message) :
				message.channel.send(error.message);
		}
		await message.channel.send([
			`An unexpected error has occoured: \`${error.name}\``,
			`\`\`\`js\n${error.message}\`\`\``
		]).catch(console.error);
		console.error(error);
	}
}) as (...args: Events['message']) => void;
