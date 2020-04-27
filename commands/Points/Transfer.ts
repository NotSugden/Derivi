import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Transfer extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Points',
			cooldown: 5,
			name: 'transfer',
			usages: []
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		if (this.client.lockedPoints.has(message.author.id)) {
			throw new CommandError('LOCKED_POINTS');
		}
		const user = await Util.users(message, 1);
		if (!user) {
			throw new CommandError('MENTION_USER');
		}
		if (this.client.lockedPoints.has(user.id)) {
			throw new CommandError('LOCKED_POINTS', false);
		}

		const transferAmount = parseInt(args[1]);
		if (isNaN(transferAmount) || transferAmount < 1) {
			throw new CommandError('INVALID_NUMBER', { min: 1 });
		}

		const [
			authorPoints,
			userPoints
		] = await this.client.database.points([message.author, user]);

		if (authorPoints.vault < transferAmount) {
			throw new CommandError('NOT_ENOUGH_POINTS', transferAmount, false);
		}

		await authorPoints.set({
			vault: authorPoints.vault - transferAmount
		});
		await userPoints.set({
			vault: userPoints.vault + transferAmount
		});

		return send(Responses.TRANSFER_SUCCESS(user, transferAmount));
	}
}