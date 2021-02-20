import { APIInteractionResponseType, MessageFlags } from 'discord-api-types/v8';
import { Snowflake } from 'discord.js';
import Command, { CommandData, CommandCategory, InteractionResponse } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Interaction from '../../structures/Interaction';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Level extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['rank'],
			category: CommandCategory.LEVELS,
			cooldown: 5,
			examples: ['', '{author}', '{author.id}'],
			name: 'level'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const { level, xp } = await this.client.database.levels(user);

		return send(Responses.LEVEL(user, level, xp));
	}

	public async interaction(interaction: Interaction): Promise<InteractionResponse> {
		const id = <Snowflake> interaction.options?.[0]?.value ?? interaction.member.id;
		const apiUser = interaction.resolved?.users![id];
		const user = apiUser ? this.client.users.add(apiUser, true) : interaction.member.user;
		const { level, xp } = await this.client.database.levels(user);
		return { data: {
			content: Responses.LEVEL(user, level, xp).join('\n'),
			flags: MessageFlags.EPHEMERAL
		}, type: APIInteractionResponseType.Acknowledge };
	}
}