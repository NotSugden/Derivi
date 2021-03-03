import { APIInteractionResponseType, MessageFlags } from 'discord-api-types/v8';
import { Snowflake, Permissions } from 'discord.js';
import Command, { CommandData, CommandCategory, InteractionResponse } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Interaction from '../../structures/Interaction';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { CommandErrors, Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Kick extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['👢'],
			category: CommandCategory.MODERATION,
			cooldown: 5,
			examples: [
				'{author} Being too cool!',
				'{author.id} Being too fancy!',
				'{author} {randommemberid} Trollers!'
			],
			name: 'kick',
			permissions: member => {
				const config = member.guild.config;
				if (!config) return null;
				const hasAccess = config.accessLevelRoles.some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;

				return false;
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { members, users, reason, flags: { silent } } = await Util.reason(message, {
			argsOverload: args.regular, fetchMembers: true, withFlags: [{
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

		const extras: { [key: string]: string } = {};

		if (members.size !== users.size) {
			const left = users.filter(user => !members.has(user.id));
			extras.Note = `${left.size} Other users were attempted to be kicked, however they had already left`;
		}

		let context: GuildMessage<true> | undefined;

		if (!silent) {
			context = await send(Responses.MEMBER_REMOVE_SUCCESSFUL({
				members: members.array(), users: users.array()
			}, true));
		}

		const { id: caseID } = await Util.sendLog({
			action: 'KICK',
			context,
			extras,
			guild: message.guild,
			moderator: message.author,
			reason,
			screenshots: [],
			users: members.map(({ user }) => user)
		});

		for (const member of members.values()) {
			try {
				await member.send(Responses.DM_PUNISHMENT_ACTION(message.guild, 'KICK', reason));
			} catch { } // eslint-disable-line no-empty
			await member.kick(Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID));
			const key = `${message.guild.id}:${member.id}`;
			this.client.recentlyKicked.add(key);
			setTimeout(() => this.client.recentlyKicked.delete(key), 12e5);
		}

		return context;
	}

	public async interaction(interaction: Interaction): Promise<InteractionResponse> {
		const userID = <Snowflake> interaction.options!.find(opt => opt.name === 'user')!.value;
		const member = interaction.resolved!.members!.get(userID)!;
		const { guild } = interaction;

		if (!Util.manageable(member, interaction.member)) {
			return { data: {
				content: CommandErrors.CANNOT_ACTION_USER('BAN', false),
				flags: MessageFlags.EPHEMERAL
			}, type: APIInteractionResponseType.Acknowledge };
		}

		const { id: caseID, reason } = await Util.sendLog({
			action: 'KICK',
			extras: {},
			guild,
			moderator: interaction.member.user,
			reason: <string> interaction.options!.find(opt => opt.name === 'reason')!.value,
			screenshots: [],
			users: [member.user]
		});

		await member.kick(Responses.AUDIT_LOG_MEMBER_REMOVE(interaction.member.user, caseID, true));

		return { data: {
			content: `Kicked ${member.user.tag} for reason ${reason}.`,
			flags: MessageFlags.EPHEMERAL
		}, type: APIInteractionResponseType.Acknowledge };
	}
}