import ms from '@naval-base/ms';
import Case, { RawCase } from '../../structures/Case';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

const parseMS = (string: string) => {
	const time = ms(string || '');
	return time;
};

export default class History extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['case-history', 'cases', 'punishments'],
			category: 'Moderation',
			cooldown: 5,
			name: 'history',
			permissions: (member, channel) => {
				const channelID = member.client.config.staffCommandsChannelID;
				return channel.id === channelID || (channelID ?
					`This command can only be used in <#${channelID}>.` :
					'The Staff commands channel has not been configured.');
			},
			usages: [{
				required: true,
				type: 'user'
			}, {
				type: 'time'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		const { users, reason: content } = await Util.reason(message);
		const time = content ? parseMS(content) : -1;

		if (!users.size) throw new CommandError('MENTION_USERS');
		if (users.size > 1) return send('Currently only 1 user is supported.');
		if (time < 432e5 && time !== -1) throw new CommandError('INVALID_TIME', '12 hours');

		// until i think of a better way
		const data = await this.client.database.rawQuery<RawCase>(
			'SELECT * FROM cases WHERE timestamp > ?',
			time === -1 ? 0 : (Date.now() - time)
		).then(cases => Responses.HISTORY(cases
			.map(caseData => new Case(this.client, caseData))
			.filter(caseData => caseData.userIDs.some(userID => users.has(userID))))
		);
		
		return send([
			'All times are in UTC+0',
			'```',
			...(data.length ? data : ['No punishments']),
			'```'
		], { split: {
			append: '\n```',
			char: '\n',
			maxLength: 1900,
			prepend: '```\n'
		} });
	}
}