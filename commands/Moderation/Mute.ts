import ms from '@naval-base/ms';
import { Permissions, GuildMember, PermissionOverwriteOption } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandManager from '../../util/CommandManager';
import { Responses, Defaults } from '../../util/Constants';
import Util from '../../util/Util';

function parseMS<T extends { reason: string }>(data: T): T & { time: number } {
	const reason = data.reason.split(' ');
	const time = ms(reason.shift() || '');
	return Object.assign(data, { reason: reason.join(' '), time });
}

export default class Mute extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			name: 'mute',
			permissions: (member) => {
				if (member.guild.id !== member.client.config.defaultGuildID) return false;
				if (
					// Checking for the `Staff Team` role
					member.roles.cache.has('539355590301057025') ||
					member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
				return false;
			},
			usages: [{
				required: true,
				type: 'member'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		try {
			const { members, users, reason, time } = parseMS(await Util.reason(message, { fetchMembers: true }));

			if (!reason) return send(Responses.PROVIDE_REASON);
			if (!users.size) {
				return send(Responses.MENTION_USERS(false));
			}

			const extras: {
				[key: string]: unknown;
				reason: string;
			} = { reason };

			if (members.size !== users.size) {
				const left = users.filter(user => !members.has(user.id));
				extras.Note = `${left.size} Other user${left.size > 1 ?
					's were' : ' was'
				} attempted to be muted, however they have left.`;
			}

			const alreadyMuted = members.filter(member => this.client.mutes.has(member.id));
			if (alreadyMuted.size) {
				if (alreadyMuted.size === members.size) {
					return send(Responses.ALL_MUTED);
				}
				extras.Note = `${extras.Note ?
					`${extras.Note}\nNote: ` : ''
				}${alreadyMuted.size} Other member${alreadyMuted.size > 1 ?
					's were' : ' was'
				} attempted to be muted, but was already muted.`;
			}

			const start = new Date();
			const end = new Date(start.getTime() + time);

			extras['Mute Length'] = ms(end.getTime() - start.getTime(), true);

			const filtered = members.filter(member => !alreadyMuted.keyArray().includes(member.id));

			await Util.sendLog(
				message.author,
				filtered.map(({ user }) => user),
				'MUTE',
				extras
			);
			
			// have to non-null assert
			const guild = message.guild!;
			// Dynamic muted role
			let role = guild.roles.cache.find(role => role.name === 'Muted');
			if (!role) {
				role = await guild.roles.create({ data: Defaults.MUTE_ROLE_DATA });
				const permissionsObject = {
					SEND_MESSAGES: false,
					SPEAK: false
				} as PermissionOverwriteOption;

				for (const channel of guild.channels.cache.values()) {
					const permissions = channel.permissionsFor(role)!;
					if (channel.type !== 'category') {
						if (
							permissions.has(Permissions.FLAGS.SEND_MESSAGES) &&
							channel.permissionsLocked &&
							channel.parent
						) {
							await channel.parent.createOverwrite(role, permissionsObject);
							continue;
						}
					}

					if (!permissions.has(Permissions.FLAGS.SEND_MESSAGES)) {
						await channel.createOverwrite(role, permissionsObject);
					}
				}
			}

			for (const member of filtered.values()) {
				await member.roles.add(role);
				const mute = await this.client.database.newMute(member.user, start, end);
				this.client.mutes.set(member.id, mute);
			}

			return send(Responses.MUTE_SUCCESS(filtered.array() as GuildMember[], reason));
		} catch (error) {
			if (error.name === 'Error') return send(error.message);
			throw error;
		}
	}
}