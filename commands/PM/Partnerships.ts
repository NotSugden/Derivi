import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

const lastMonday = (date: Date, updateOriginal = true) => {
	if (!updateOriginal) date = new Date(date);
	const day = date.getUTCDay();
	const _date = date.getUTCDate() + 1;
	date.setUTCDate(day === 0 ? _date - 7 : _date - day);
	return date;
};

const startOfMonth = () => {
	const date = new Date();
	date.setUTCDate(1);
	return date;
};

export default class Partnerships extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'PM',
			cooldown: 5,
			examples: ['', '{author}'],
			name: 'partnerships'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;
		const [thisWeek, thisMonth, alltime] = await Promise.all([
			this.client.database.partnershipCounts(user, { after: lastMonday(new Date()) }),
			this.client.database.partnershipCounts(user, { after: startOfMonth() }),
			this.client.database.partnershipCounts(user, { before: new Date() })
		]);
		const userToPass = user.id === message.author.id ? null : user;
		if (!thisWeek) {
			throw new CommandError('NO_PARTNERS', userToPass);
		}
		return send(Responses.PARTNERSHIPS(userToPass, thisWeek, thisMonth!, alltime!));
	}
}