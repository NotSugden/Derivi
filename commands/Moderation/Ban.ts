import { Permissions, BanOptions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Ban extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['🔨', '🍌', '<:ASC_yeet:539506595239952409>'],
			category: 'Moderation',
			cooldown: 5,
			name: 'ban',
			permissions: (member) => {
				if (member.guild.id !== member.client.config.defaultGuildID) return false;
				if (
					// Checking for the `Chat Moderator` role
					member.roles.cache.has('539355587839000588') ||
					member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
				return false;
			},
			usages: [{
				required: true,
				type: 'user'
			}, {
				type: '--days=7'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		try {
			const { users, reason: _reason } = await Util.reason(message);
			const { flags, string: reason } = Util.extractFlags(_reason);
			
			// have to non-null assert it
			const guild = message.guild!;

			if (!reason) return send(Responses.PROVIDE_REASON);
			if (!users.size) return send(Responses.MENTION_USERS());

			const extras: {
				[key: string]: unknown;
				reason: string;
			} = { reason };

			const banOptions = {} as BanOptions;

			if (flags.days) {
				const days = parseInt(flags.days);
				if (isNaN(days) || days < 1 || days > 7 ) {
					return send(Responses.INVALID_FLAG_TYPE('days', 'an integer bigger than 0 and lower than 8'));
				}
				banOptions.days = days;
				extras['Days of Messages Deleted'] = days.toString();
			}
			const flagKeys = Object.keys(flags);
			if (flagKeys.some(key => key !== 'days')) {
				return send(Responses.INVALID_FLAG(flagKeys.find(key => key !== 'days') as string, ['days']));
			}

			const alreadyBanned = users
				.filter(user => guild.bans.has(user.id))
				.map(user => guild.bans.get(user.id)!);
			if (alreadyBanned.length) {
				if (alreadyBanned.length === users.size) {
					return send(Responses.ALREADY_REMOVED_USERS(users.size > 1, false));
				}
				extras.Note =
					`${alreadyBanned.length} Other user${
						alreadyBanned.length > 1 ? 's were' : ' was'
					} attempted to be banned, however they were already banned.`;
			}

			const filteredUsers = users.array().filter(user => !alreadyBanned.some(data => data.user.id === user.id));

			const { id: caseID } = await Util.sendLog(
				message.author,
				filteredUsers,
				'BAN',
				extras
			);

			banOptions.reason = Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID, false);

			for (const user of filteredUsers) {
				guild.bans.set(user.id, {
					reason: banOptions.reason,
					user
				});
				await guild.members.ban(user, banOptions);
			}

			return send(Responses.MEMBER_REMOVE_SUCCESSFUL({ filteredUsers, users: users.array() }, false));

		} catch (error) {
			if (error.name === 'Error') return send(error.message);
			throw error;
		}
	}
}