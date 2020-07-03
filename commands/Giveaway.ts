import ms from '@naval-base/ms';
import { Permissions } from 'discord.js';
import Command from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandError from '../util/CommandError';
import CommandManager from '../util/CommandManager';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

enum GiveawayModes {
	START = 'start',
	REROLL = 'reroll',
	END = 'end'
}

export default class Giveaway extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'General',
			cooldown: 5,
			name: 'giveaway',
			permissions: member => {
				const config = member.client.config.guilds.get(member.guild.id);
				if (!config) return false;
				const hasAccess = config.accessLevelRoles.slice(1).some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;

				return false;
			},
			usages: [{
				extras: ['end', 'reroll'],
				required: true,
				type: 'start'
			}]
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments) {
		if (args[0] === GiveawayModes.START) {
			let length: number;
			try {
				length = ms(args[1] || '');
			} catch {
				length = -1;
			}
			if (length === -1 || length < 120e3) {
				throw new CommandError('INVALID_TIME');
			}
			const { string: prize, flags } = Util.extractFlags(args.regular.slice(2).join(' '), [{
				name: 'messageRequirement',
				type: 'number'
			}]);
			if (!prize.length) {
				throw new CommandError('NO_GIVEAWAY_PRIZE');
			}
			if (prize.length > 120) {
				throw new CommandError('INVALID_STRING_LENGTH', 'prize', {
					big: true, length: 120
				});
			}
			const endDate = new Date(Date.now() + length);
			const giveawayMessage = await message.channel.send(Responses.GIVEAWAY(
				prize, {
					end: endDate,
					messageRequirement: flags.messageRequirement as number | undefined
				}
			)) as GuildMessage<true>;
			await giveawayMessage.react('🎁');
			await this.client.database.createGiveaway({
				createdBy: message.author,
				endAt: endDate,
				message: giveawayMessage,
				messageRequirement: flags.messageRequirement as number | undefined,
				prize: prize
			});
		}
	}
}