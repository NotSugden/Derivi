import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

const OPTIONS = [
	'deposit',
	'withdraw'
];

export default class Vault extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['bank'],
			category: 'Points',
			cooldown: 5,
			name: 'vault',
			usages: [{
				extras: ['"withdraw"'],
				type: '"deposit"'
			}, {
				type: 'amount'
			}]
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const points = await this.client.database.points(message.author);

		const option = args[0];

		if (!option) return send(Responses.VAULT_CHECK(message.author, points.vault));

		if (!OPTIONS.includes(option)) {
			throw new CommandError('INVALID_OPTION', OPTIONS);
		}

		if (this.client.lockedPoints.has(message.author.id)) {
			throw new CommandError('LOCKED_POINTS');
		}

		if (option === 'deposit') {
			const amount = args[1] === 'all' ? points.amount : parseInt(args[1]);
			if (points.amount === 0) {
				throw new CommandError('NO_POINTS');
			} else if (isNaN(amount) || amount < 1) {
				throw new CommandError('INVALID_NUMBER', { min: 1 });
			} else if (points.amount < amount) {
				throw new CommandError('NOT_ENOUGH_POINTS', amount);
			}

			await points.set({
				amount: points.amount - amount,
				vault: points.vault + amount
			});

			return send(Responses.DEPOSIT_SUCCESS(amount));
		} else if (option === 'withdraw') {
			const amount = args[1] === 'all' ? points.vault : parseInt(args[1]);
			if (points.vault === 0) {
				throw new CommandError('NO_POINTS', true);
			} else if (isNaN(amount) || amount < 1) {
				throw new CommandError('INVALID_NUMBER', { min: 1 });
			} else if (points.vault < amount) {
				throw new CommandError('NOT_ENOUGH_POINTS', amount);
			}

			await points.set({
				amount: points.amount + amount,
				vault: points.vault - amount
			});

			return send(Responses.WITHDRAW_SUCCESS(amount));
		}
	}
}