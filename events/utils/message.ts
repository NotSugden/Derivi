import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { Snowflake } from 'discord.js';
import { SnowflakeUtil } from 'discord.js';
import { Permissions } from 'discord.js';
import { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import GuildConfig from '../../structures/GuildConfig';
import Levels from '../../structures/Levels';
import CommandError from '../../util/CommandError';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export const XP_COOLDOWN = new Set<Snowflake>();
export const random = (min: number, max: number): number => {
	const ran = Math.floor(Math.random() * max);
	if (ran < min) return random(min, max);
	return ran;
};


export async function logAttachments(message: GuildMessage<true>) {
	const urls = message.attachments.map(({ proxyURL }) => proxyURL);
	for (let i = 0; i < urls.length; i++) {
		const url = urls[i];
		const extension = extname(url);
		const name = join(
			message.client.config.filesDir,
			`${message.id}-${i}${extension}`
		);
		const buffer = await fetch(url)
			.then(response => response.buffer())
			.then(data => Util.encrypt(data, message.client.config.encryptionPassword));
		await fs.writeFile(name, buffer);
	}
}

export async function runPartnership(message: GuildMessage<true>, config: GuildConfig) {
	const [partnerChannel] = await message.client.database.query<{
		min_members: number;
		max_members: number | null;
		points: number;
	}>(
		'SELECT min_members, max_members, points FROM partnership_channels WHERE channel_id = :channelID',
		{ channelID: message.channel.id }
	);
	if (!partnerChannel) return false;
	const hasInvite = message.invites.length > 0;
	if (!hasInvite || message.invites.length > 1) {
		await message.delete();
		throw new CommandError(
			hasInvite ? 'TOO_MANY_INVITES' : 'NO_INVITE'
		).dm();
	}

	try {
		const invite = await message.client.fetchInvite(message.invites[0]);
		if (!invite.guild || invite.guild.id === message.guild.id) {
			throw new CommandError(
				invite.guild ? 'UNKNOWN_INVITE' : 'GROUP_INVITE'
			).dm();
		}

		if (
			invite.memberCount < partnerChannel.min_members ||
				(partnerChannel.max_members && invite.memberCount > partnerChannel.max_members)
		) {
			throw new CommandError(
				'PARTNER_MEMBER_COUNT', invite.memberCount < partnerChannel.min_members
			).dm();
		}

		if (!message.client.config.PRODUCTION) {
			await config.partnerRewardsChannel.send(Responses.PARTNER_REWARD(
				message.author, message.channel, partnerChannel.points
			));
		}

		const points = await message.client.database.points(message.author);
		await points.set({ amount: points.amount + partnerChannel.points });
		await message.client.database.createPartnership({
			guild: { id: invite.guild.id, invite: invite.code },
			timestamp: new Date(),
			user: message.author
		});
	} catch (error) {
		await message.delete();
		const unknownInvite = error.message === 'Unknown Invite';
		if (unknownInvite || error.message === 'The user is banned from this guild.') {
			if (message.client.config.PRODUCTION) throw 'PRODUCTION_ERROR';
			if (unknownInvite) {
				throw new CommandError('UNKNOWN_INVITE', message.invites[0]).dm();
			}
			throw new CommandError('CLIENT_BANNED_INVITE').dm();
		}
		throw error;
	}
	return true;
}

export async function runLevels(message: GuildMessage<true>, config: GuildConfig) {
	const levels = await message.client.database.levels(message.author.id);

	const newData: { xp: number; level?: number } = {
		xp: levels.xp + random(12, 37)
	};
	if (newData.xp > Levels.levelCalc(levels.level)) {
		const newLevel = newData.level = levels.level + 1;
		const options = { guildID: config.guildID, level: newLevel };
		const [data] = await message.client.database.query<{ role_id: Snowflake }>(
			'SELECT role_id FROM level_roles WHERE guild_id = :guildID AND level = :level',
			options
		);
		if (data && !message.client.config.PRODUCTION) {
			// only start removing roles after level 5 to reduce spam on new members
			let roles = message.member.roles.cache.keyArray();
			if (newLevel > 5) {
				const previousRoles = (await message.client.database.query<{ role_id: Snowflake }>(
					'SELECT role_id FROM level_roles WHERE guild_id = :guildID AND level < :level',
					options
				)).map(({ role_id }) => role_id);
				if (
					previousRoles.length && previousRoles.some(roleID => roles.includes(roleID))
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

	if (typeof newData.level === 'number' && !message.client.config.PRODUCTION) {
		await message.channel.send(Responses.LEVEL_UP(message.author, newData.level)); 
	}
}

const VIEW_CHANNEL_PERMISSIONS = new Permissions([
	'VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'
]).bitfield;

export async function messageLink(
	message: GuildMessage<true>,
	[, guildID, channelID, messageID]: string[]
) {
	if (message.client.config.PRODUCTION) return;
	const guild = message.client.guilds.cache.get(guildID);
	if (!guild) return;
	const channel = guild.channels.cache.get(channelID);
	if (
		!channel
		|| !(channel instanceof TextChannel)
		|| !channel.permissionsFor(message.client.user!)?.has(VIEW_CHANNEL_PERMISSIONS)
		|| !channel.permissionsFor(message.author)?.has(VIEW_CHANNEL_PERMISSIONS)
	) return;
	const messageSnowflake = SnowflakeUtil.deconstruct(messageID);
	if (messageSnowflake.timestamp < channel.createdTimestamp) return;

	try {
		const foundMessage = await channel.messages.fetch(messageID, false) as GuildMessage;
		await message.channel.send(Responses.MESSAGE_LINKED(message.author, foundMessage));
	} catch (error) {
		if (error.message === 'Unknown Message') return;
		throw error;
	}
}