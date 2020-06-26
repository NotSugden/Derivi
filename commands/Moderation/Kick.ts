import { Permissions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
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
			permissions: member => {
				const config = member.client.config.guilds.get(member.guild.id);
				if (!config) return false;
				const hasAccess = config.accessLevelRoles.some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
        
				return false;
			},
			usages: [{
				required: true,
				type: 'member'
			}, {
				type: '--silent=true'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { members, users, reason, flags: { silent } } = await Util.reason(message, {
			fetchMembers: true, withFlags: [{
				name: 'silent',
				type: 'boolean'
			}]
		});

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!members.size) {
			if (!users.size) throw new CommandError('MENTION_USERS', false);
			throw new CommandError('ALREADY_REMOVED_USERS', users.size > 1, true);
		}

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'KICK', members.size > 1
		);

		const extras: { [key: string]: string } = { };

		if (members.size !== users.size) {
			const left = users.filter(user => !members.has(user.id));
			extras.Note = `${left.size} Other users were attempted to be kicked, however they had already left`;
		}

		let context: Message | undefined;

		if (!silent) {
			context = await send(Responses.MEMBER_REMOVE_SUCCESSFUL({
				members: members.array(), users: users.array()
			}, true));
		}

		const { id: caseID } = await Util.sendLog({
			action: 'KICK',
			context,
			extras,
			guild: message.guild!,
			moderator: message.author,
			reason,
			screenshots: [],
			users: members.map(({ user }) => user)
		});

		for (const member of members.values()) {
			await member.kick(Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID));
		}

		return context;
	}
}