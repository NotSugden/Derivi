import { Snowflake } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import User from '../../structures/discord.js/User';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

const lastMonday = (date: Date, updateOriginal = true) => {
	if (!updateOriginal) date = new Date(date);
	const day = date.getUTCDay();
	const _date = date.getUTCDate() + 1;
	date.setUTCDate(day === 0 ? _date - 7 : _date - day);
	return date;
};

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
			lastMonday(date);
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
				obj.user = await this.client.users.fetch(obj.userID) as User;
			} catch { obj.user = null; } // eslint-disable-line no-empty
		}
		return send(Responses.PARTNER_TOP(
			partnerships,
			args[0] ? Dates[args[0].toUpperCase() as keyof typeof Dates] || 'month' : 'month'
		));
	}
}