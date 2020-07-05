import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Level extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['rank'],
			arguments: [{
				type: 'user'
			}],
			category: 'Levels',
			cooldown: 5,
			name: 'level'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const { level, xp } = await this.client.database.levels(user);

		return send(Responses.LEVEL(user, level, xp));
	}
}