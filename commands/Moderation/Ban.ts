import { Permissions, BanOptions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Ban extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['🔨', '🍌', '<:ASC_yeet:539506595239952409>'],
			category: 'Moderation',
			cooldown: 5,
			name: 'ban',
			permissions: member => {
				const config = member.client.config.guilds.get(member.guild.id);
				if (!config) return false;
				const hasAccess = config.accessLevelRoles.slice(1).some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
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

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { users, reason, flags, members } = await Util.reason(message, {
			fetchMembers: true, withFlags: [{
				name: 'days',
				type: 'number'
			}, {
				name: 'silent',
				type: 'boolean'
			}, {
				name: 'soft',
				type: 'boolean'
			}]
		});
			
		// have to non-null assert it
		const guild = message.guild!;

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!users.size) throw new CommandError('MENTION_USERS');

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'BAN', members.size > 1
		);

		const extras: { [key: string]: string } = { };

		const banOptions = {} as BanOptions;

		if (flags.soft) {
			banOptions.days = 7;
		}

		if (typeof flags.days === 'number') {
			const { days } = flags;
			if (days < 1 || days > 7) {
				throw new CommandError(
					'INVALID_FLAG_TYPE',
					'days', 'an integer bigger than 0 and lower than 8'
				);
			}
			banOptions.days = days;
			extras['Days of Messages Deleted'] = days.toString();
		}

		const alreadyBanned = users
			.filter(user => guild.bans.has(user.id))
			.map(user => guild.bans.get(user.id)!);
		if (alreadyBanned.length) {
			if (alreadyBanned.length === users.size) {
				throw new CommandError('ALREADY_REMOVED_USERS', users.size > 1, false);
			}
			extras.Note =
					`${alreadyBanned.length} Other user${
						alreadyBanned.length > 1 ? 's were' : ' was'
					} attempted to be banned, however they were already banned.`;
		}

		const filteredUsers = users.array().filter(user => !alreadyBanned.some(data => data.user.id === user.id));

		let context: GuildMessage<true> | undefined;

		if (!flags.silent) {
			context = await send(Responses.MEMBER_REMOVE_SUCCESSFUL({
				filteredUsers, users: users.array()
			}, false));
		}
		
		const { id: caseID } = await Util.sendLog({
			action: flags.soft ? 'SOFT_BAN' : 'BAN',
			context,
			extras,
			guild: message.guild!,
			moderator: message.author,
			reason,
			screenshots: [],
			users: filteredUsers
		});

		banOptions.reason = Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID, false);

		for (const user of filteredUsers) {
			guild.bans.set(user.id, {
				reason: banOptions.reason,
				user
			});
			await guild.members.ban(user, banOptions);
			if (flags.soft) {
				await guild.members.unban(user.id);
			}
		}

		return context;
	}
}