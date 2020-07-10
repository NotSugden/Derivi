import ms from '@naval-base/ms';
import { Snowflake } from 'discord.js';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandManager from '../util/CommandManager';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

export default class Messages extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['msgs'],
			category: 'General',
			cooldown: 5,
			examples: [
				'', '{author}', '{author.id} 7d'
			],
			name: 'messages'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const _args = (args[1] ? args.slice(1) : args).join(' ');
		let time = _args === 'alltime' ? 0 : Util.parseMS(_args);
		if (time === -1) time = 6048e5;

		const messages = await this.client.database.query<{ count: number; channelID: Snowflake }>(
			'SELECT COUNT(*) as count, channel_id as channelID FROM messages \
WHERE sent_timestamp > :after AND user_id = :userID AND guild_id = :guildID GROUP BY channel_id ORDER BY count DESC', {
				after: new Date(Date.now() - time),
				guildID: message.guild.id,
				userID: user.id
			}
		);
		return send(Responses.MESSAGES({
			channels: messages,
			total: messages.reduce((acc, next) => acc + next.count, 0)
		}, user, ms(time, true)));
	}
}