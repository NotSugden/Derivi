import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class History extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['case-history', 'cases', 'punishments'],
			category: 'Moderation',
			cooldown: 5,
			examples: [
				'{randomuserid}',
				'{randomuserid} 1d',
				'{randomuserid} {randomuserid}',
				'{randomuserid} {randomuserid} 24h'
			],
			name: 'history',
			permissions: (member, channel) => {
				if (!channel.parentID) return 'You\'re not using this command in the correct category!';
				const config = [...member.client.config.guilds.values()].find(
					cfg => cfg.staffServerCategoryID === channel.parentID
				);
				if (!config) return 'You\'re not using this command in the correct category!';
				const channelID = config.staffCommandsChannelID;
				return channel.id === channelID || (channelID ?
					`This command can only be used in <#${channelID}>.` :
					'The Staff commands channel has not been configured.');
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const { users, reason: content } = await Util.reason(message);
		const time = Util.parseMS(content);

		if (!users.size) throw new CommandError('MENTION_USERS');
		if (users.size > 1) return send('Currently only 1 user is supported.');
		if (time < 432e5 && time !== -1) throw new CommandError('INVALID_TIME', {
			time: '12 hours'
		});
    
		const config = [...this.client.config.guilds.values()].find(
			cfg => cfg.staffServerCategoryID === message.channel.parentID
		)!;

		// until i think of a better way
		const data = await this.client.database.case(this.client.guilds.resolve(config.id)!, {
			after: time === -1 ? new Date(0) : new Date(Date.now() - time)
		}).then(cases => Responses.HISTORY(cases.array()
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