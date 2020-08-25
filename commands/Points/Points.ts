import { Permissions } from 'discord.js';
import Command, { CommandData, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Points extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['wallet', 'p'],
			category: CommandCategory.POINTS,
			cooldown: 5,
			examples: [
				'', '{author}', '{author.id}'
			],
			name: 'points'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const points = await this.client.database.points(user);
		
		if (message.member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)) {
			const { flags } = Util.extractFlags(args.join(' '), [{
				name: 'give',
				type: 'number'
			}, {
				name: 'remove',
				type: 'number'
			}, {
				name: 'set',
				type: 'number'
			}, {
				name: 'mode',
				type: 'string'
			}]);

			if (flags.mode && !['wallet', 'vault'].includes(flags.mode as string)) {
				throw new CommandError(
					'INVALID_FLAG_TYPE',
					'mode',
					'"vault" or "wallet"'
				);
			}

			const mode = flags.mode === 'vault' ? 'vault' : 'amount';

			// lazy casting here but it should be fine
			if (typeof flags.give === 'number') {
				if (flags.give < 1) {
					throw new CommandError('INVALID_NUMBER', { min: 1 });
				}
				await points.set({ [mode]: points.amount + flags.give });
				return send(Responses.POINTS_MODIFY(user, flags.give, 'add'));
			} else if (typeof flags.remove === 'number') {
				if (flags.remove < 1) {
					throw new CommandError('INVALID_NUMBER', { min: 1 });
				}
				await points.set({ [mode]: points.amount - flags.remove });
				return send(Responses.POINTS_MODIFY(user, flags.remove, 'remove'));
			} else if (typeof flags.set === 'number') {
				if (flags.set < 1) {
					throw new CommandError('INVALID_NUMBER', { min: 1 });
				}
				await points.set({ [mode]: flags.set });
				return send(Responses.POINTS_MODIFY(user, flags.set, 'set'));
			}
		}
		return send(Responses.POINTS(user, points.amount, user.id === message.author.id));
	}
}