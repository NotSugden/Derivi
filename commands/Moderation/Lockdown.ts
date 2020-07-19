import { Permissions, TextChannel, OverwriteData } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

export default class Lockdown extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			examples: [''],
			name: 'lockdown',
			permissions: member => {
				const config = member.guild.config;
				if (!config) return null;
				const hasAccess = config.accessLevelRoles.slice(1).some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) {
					if (!config.lockdownChannelID) {
						return 'There is no lockdown channel to show members!';
					}
					return true;
				}

				return false;
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const { everyone } = message.guild.roles;
		const newPermissions = everyone.permissions.toArray();
		const isntLockedDown = newPermissions.includes('VIEW_CHANNEL');
		const options: OverwriteData = {
			id: everyone.id,
			type: 'role'
		};
		if (isntLockedDown) {
			newPermissions.splice(newPermissions.findIndex(
				perm => perm === 'VIEW_CHANNEL'
			), 1);
			options.allow = ['VIEW_CHANNEL'];
			options.deny = ['SEND_MESSAGES'];
		}
		else {
			newPermissions.push('VIEW_CHANNEL');
			options.deny = ['VIEW_CHANNEL'];
		}
		const config = message.guild.config!;
		const lockdownChannel = message.guild.channels.cache.get(config.lockdownChannelID!) as TextChannel;
		await lockdownChannel.overwritePermissions([options], `Lockdown by ${message.author.tag}`);
		await everyone.setPermissions(newPermissions, `Lockdown by ${message.author.tag}`);
		return send(Responses.LOCKDOWN(
			isntLockedDown, lockdownChannel!.id)
		);
	}
}