import { APIInteractionResponseType, MessageFlags } from 'discord-api-types/v8';
import { Permissions, Snowflake } from 'discord.js';
import Command, { CommandData, CommandCategory, InteractionResponse } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Interaction from '../../structures/Interaction';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses, CommandErrors } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Warn extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: CommandCategory.MODERATION,
			cooldown: 5,
			examples: [
				'{author} Being too cool!',
				'{author.id} Being too fancy!',
				'{author} {randomuserid} Trolling!'
			],
			name: 'warn',
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
		const { users, reason, members, flags: { silent } } = await Util.reason(message, {
			argsOverload: args.regular, fetchMembers: true, withFlags: [{
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

		let context: GuildMessage<true> | undefined;

		if (!silent) context = await send(Responses.WARN_SUCCESS(users.array(), reason));

		const { id: caseID } = await Util.sendLog({
			action: 'WARN',
			context,
			extras: {},
			guild: message.guild,
			moderator: message.author,
			reason,
			screenshots: [],
			users: users.array()
		});

		await Promise.all(
			users.map(async user => {
				try {
					await user.send(Responses.DM_PUNISHMENT_ACTION(message.guild, 'WARN', reason));
				} catch { } // eslint-disable-line no-empty
				return this.client.database.createWarn({
					case: caseID,
					guild: message.guild,
					moderator: message.author,
					reason,
					timestamp,
					user
				});
			})
		);

		return context;
	}

	public async interaction(interaction: Interaction): Promise<InteractionResponse> {
		const userID = <Snowflake> interaction.options!.find(opt => opt.name === 'user')!.value;
		const { users, members } = interaction.resolved!;
		const user = this.client.users.add(users![userID]);
		const { guild } = interaction;
		const member = members && userID in members
			? guild.members.add(Object.assign({ user: users![userID] }, members![userID]))
			: null;

		if (member && !Util.manageable(member, interaction.member)) {
			return { data: {
				content: CommandErrors.CANNOT_ACTION_USER('WARN', false),
				flags: MessageFlags.EPHEMERAL
			}, type: APIInteractionResponseType.Acknowledge };
		}

		const { id: caseID, reason } = await Util.sendLog({
			action: 'WARN',
			extras: {},
			guild,
			moderator: interaction.member.user,
			reason: <string> interaction.options!.find(opt => opt.name === 'reason')!.value,
			screenshots: [],
			users: [user]
		});

		try {
			await user.send(Responses.DM_PUNISHMENT_ACTION(guild, 'WARN', reason));
		} catch { } // eslint-disable-line no-empty

		await this.client.database.createWarn({
			case: caseID,
			guild: guild,
			moderator: interaction.member.user,
			reason,
			timestamp: new Date(),
			user
		});

		return { data: {
			content: `Warned ${user.tag} for reason ${reason}.`,
			flags: MessageFlags.EPHEMERAL
		}, type: APIInteractionResponseType.Acknowledge };
	}
}