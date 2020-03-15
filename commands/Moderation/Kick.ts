import { Permissions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Kick extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['👢'],
			category: 'Moderation',
			cooldown: 5,
			name: 'kick',
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
				type: 'member'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		try {
			const { members, users, reason } = await Util.reason(message, true);

			if (!reason) return send(Responses.PROVIDE_REASON);
			if (!members.size) {
				if (!users.size) return send(Responses.MENTION_USERS(false));
				return send(Responses.ALREADY_REMOVED_USERS(users.size > 1, true));
			}

			const extras: {
				[key: string]: unknown;
				reason: string;
			} = { reason };

			if (members.size !== users.size) {
				const left = users.filter(user => !members.has(user.id));
				extras.Note = `${left.size} Other users were attempted to be kicked, however they had already left`;
			}

			const { id: caseID } = await Util.sendLog(
				message.author,
				members.map(({ user }) => user),
				'KICK',
				extras
			);

			for (const member of members.values()) {
				await member.kick(Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID));
			}

			return send(Responses.MEMBER_REMOVE_SUCCESSFUL({ members: members.array(), users: users.array() }, true));

		} catch (error) {
			if (error.name === 'Error') return send(error.message);
			throw error;
		}
	}
}