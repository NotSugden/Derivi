import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

export default class Top extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Levels',
			cooldown: 5,
			name: 'top',
			usages: []
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const top10 = await this.client.database.levels(10);

		for (const levels of top10.values()) {
			if (!levels.user) {
				await this.client.users.fetch(levels.userID)
					.catch(console.error);
			}
		}

		return send(Responses.TOP(top10.array(), message.guild!));
	}
}