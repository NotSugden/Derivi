import Command, { CommandData, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import BotConfig, { CONFIG_ITEMS } from '../Dev/BotConfig';

export enum ServerConfigModes {
	VIEW = 'view',
	EDIT = 'edit'
}

export default class ServerConfig extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['sconfig', 'server-config', {
				name: 'edit-config',
				prepend: ['edit']
			}],
			category: CommandCategory.ADMIN,
			cooldown: 5,
			examples: [''],
			name: 'serverconfig',
			permissions: (member) => {
				const config = member.guild.config;
				if (!config) return null;
				return member.roles.cache.has(config.accessLevelRoles[0])
					|| member.client.config.ownerIDs.includes(member.id);
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const config = message.guild.config!;
		if (!args[0] || args[0] === ServerConfigModes.VIEW) {
			return send(Responses.VIEW_SERVER_CONFIG(config));
		}
		if (args[0] === ServerConfigModes.EDIT) {
			const item = args[1] && CONFIG_ITEMS.find(
				item => (item.key === args[1]) || (item.normalizedKey === args[1])
			);
			if (!item) throw new CommandError('INVALID_SETTING', CONFIG_ITEMS.map(item => item.normalizedKey));
			const newValue = BotConfig.resolveValue(item, message, {
				createChannels: false, string: args.regular.slice(2).join(' ')
			});
			await this.client.database;
		}
		throw new CommandError('INVALID_MODE', Object.values(ServerConfigModes));
	}
}