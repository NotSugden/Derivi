import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Points extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['wallet'],
			category: 'Points',
			cooldown: 5,
			name: 'points',
			usages: [{
				type: 'user'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const { amount } = await this.client.database.points(user);

		return send(Responses.POINTS(user, amount, user.id === message.author.id));
	}
}