import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import moment = require('moment');

export default class Daily extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Points',
			cooldown: 5,
			name: 'daily',
			usages: []
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		const points = await this.client.database.points(message.author);
		if (points.lastDailyTimestamp > (Date.now() - 864e+5)) {
			throw new CommandError('DAILY_WAIT', moment(Date.now()).to(points.lastDailyTimestamp + 864e+5, true));
		}

		await points.set({
			daily: new Date(),
			points: points.amount + 250
		});

		return send(Responses.COLLECTED_DAILY(250));
	}
}