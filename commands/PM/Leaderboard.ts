import { Snowflake, User } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

enum Dates {
	WEEK = 'week',
	MONTH = 'month',
	ALLTIME = 'alltime'
}

export default class Leaderboard extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['plb'],
			category: 'PM',
			cooldown: 5,
			examples: ['', 'month', 'week', 'alltime'],
			name: 'pleaderboard'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		let date = new Date();
		if (args[0] === Dates.WEEK) {
			Util.lastMonday(date);
		} else if (args[0] === Dates.ALLTIME) {
			date = new Date(0);
		} else {
			date.setUTCDate(1);
		}
		const partnerships = await this.client.database.partnershipCounts({
			after: date,
			limit: 15
		}) as {
			count: number;
			user: User | null;
			userID: Snowflake;
		}[];
		for (const obj of partnerships) {
			try {
				obj.user = await this.client.users.fetch(obj.userID);
			} catch { obj.user = null; } // eslint-disable-line no-empty
		}
		return send(Responses.PARTNER_TOP(
			partnerships,
			args[0] ? Dates[args[0].toUpperCase() as keyof typeof Dates] || 'month' : 'month'
		));
	}
}