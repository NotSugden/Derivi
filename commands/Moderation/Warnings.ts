import { Permissions } from 'discord.js';
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
			permissions: member => {
				const config = member.client.config.guilds.get(member.guild.id);
				if (!config) return false;
				const hasAccess = config.accessLevelRoles.some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
        
				return false;
			},
			usages: [{
				required: true,
				type: 'user'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		const users = await Util.users(message);
		
		if (!users.size) throw new CommandError('MENTION_USERS');

		const warnings = Object.entries(await this.client.database.warns(message.guild!, users.map(user => user.id)))
			.flatMap(([userID, warns]) => {
				const arr = [`${users.get(userID)!.tag}:`];
				if (warns) arr.push(...Responses.WARNINGS(warns));
				else arr.push('No warnings');
				return arr;
			});
		
		return send([
			'All times are in UTC+0',
			'```',
			...warnings,
			'```'
		], { split: {
			append: '\n```',
			char: '\n',
			maxLength: 1900,
			prepend: '```\n'
		} });
	}
}