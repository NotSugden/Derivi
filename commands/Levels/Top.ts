import Command, { CommandData, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

const NUMBERS = [5, 10, 15, 20];

export default class Top extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['top'].flatMap(alias => [
				alias,
				...NUMBERS.map(num => ({
					name: `${alias}${num}`,
					prepend: [num.toString()]
				}))
			]),
			category: CommandCategory.LEVELS,
			cooldown: 5,
			examples: ['', '5', '10'],
			name: 'top'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const amount = args[0] ? parseInt(args[0]) : 10;
		if (isNaN(amount) || amount > 20 || amount < 5) {
			throw new CommandError('INVALID_NUMBER', { max: 20, min: 5 });
		}
		const topUsers = await this.client.database.levels(amount);

		for (const levels of topUsers.values()) {
			if (!levels.user) {
				await this.client.users.fetch(levels.userID)
					.catch(console.error);
			}
		}

		return send(Responses.TOP(topUsers.array(), message.guild!));
	}
}