import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Warnings extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['warns'],
			category: 'Moderation',
			cooldown: 5,
			name: 'warnings',
			permissions: (member, channel) => {
				const channelID = member.client.config.staffCommandsChannelID;
				return channel.id === channelID || (channelID ?
					`This command can only be used in <#${channelID}>.` :
					'The Staff commands channel has not been configured.');
			},
			usages: [{
				required: true,
				type: 'user'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		const { users } = await Util.reason(message);
		
		if (!users.size) throw new CommandError('MENTION_USERS', true);

		const warnings = Object.entries(await this.client.database.warns(users.map(user => user.id)))
			.flatMap(([userID, warns]) => {
				const arr = [`${users.get(userID)!.tag}:`];
				if (warns) arr.push(...Responses.WARNINGS(warns));
				else arr.push('No warnings');
				return arr;
			});
		
		return send(warnings, { code: true });
	}
}