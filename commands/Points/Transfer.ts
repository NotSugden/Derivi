import Command, { CommandData, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Transfer extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: CommandCategory.POINTS,
			cooldown: 5,
			examples: [
				'{author} 500',
				'{author.id} 500'
			],
			name: 'transfer'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
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

		const points = await this.client.database.points([message.author, user]);
		const authorPoints = points.get(message.author.id)!;
		const userPoints = points.get(user.id)!;

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