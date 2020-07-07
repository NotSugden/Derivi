import { Snowflake } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Partnership from '../../structures/Partnership';
import User from '../../structures/discord.js/User';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

export default class Leaderboard extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['lb'],
			category: 'PM',
			cooldown: 5,
			examples: [''],
			name: 'leaderboard'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const month = new Date(`2020-${new Date().getUTCMonth()}-01`);
		const partnerships = await this.client.database.partnerships({
			after: month
		});
		const mapped = partnerships.reduce<{
			user: User | null;
			userID: Snowflake;
			partners: Partnership[];
		}[]>((acc, next) => {
			const existingElement = acc.find(obj => obj.userID === next.userID);
			if (!existingElement) {
				acc.push({ partners: [next], user: next.user, userID: next.userID });
			} else {
				existingElement.partners.push(next);
			}
			return acc;
		}, []).sort((a, b) => a.partners.length - b.partners.length).slice(0, 20);
		for (const obj of mapped) {
			if (obj.user) continue;
			try {
				obj.user = await this.client.users.fetch(obj.userID) as User;
			} catch { } // eslint-disable-line no-empty
		}
		return send(Responses.PARTNER_TOP(mapped, 'month'));
	}
}