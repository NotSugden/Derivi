import { Permissions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Warn extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			name: 'warn',
			permissions: member => {
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
				type: 'user'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { users, reason, members, flags: { silent } } = await Util.reason(message, {
			fetchMembers: true, withFlags: [{
				name: 'silent',
				type: 'boolean'
			}]
		});

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!users.size) throw new CommandError('MENTION_USERS');

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'WARN', members.size > 1
		);

		const timestamp = new Date();

		const { id: caseID } = await Util.sendLog(
			message.author,
			users.array(),
			'WARN',
			{ reason }
		);

		await Promise.all(
			users.map(user => this.client.database.newWarn(
				user, message.author, { caseID, reason, timestamp }
			))
		);

		if (!silent) return send(Responses.WARN_SUCCESS(users.array(), reason));
	}
}