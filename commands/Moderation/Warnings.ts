import { Permissions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Warnings extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['warns'],
			category: 'Moderation',
			cooldown: 5,
			examples: [
				'{author}',
				'{author.id}',
				'{randomuser} {author.id}'
			],
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
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const users = await Util.users(message);
		
		if (!users.size) throw new CommandError('MENTION_USERS');


		const warnings = (await this.client.database.warns(message.guild!, users.map(user => user.id)))
			.reduce<string[]>((array, warns, userID) => {
				array.push(`${users.get(userID)!.tag}:`);
				if (warns.length) array.push(...Responses.WARNINGS(warns));
				else array.push('No warnings');
				return array;
			}, []);
		
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