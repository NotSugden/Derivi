import { Permissions } from 'discord.js';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandError from '../util/CommandError';
import CommandManager from '../util/CommandManager';
import { Responses, SNOWFLAKE_REGEX } from '../util/Constants';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

export enum GiveawayModes {
	START = 'start',
	REROLL = 'reroll',
	END = 'end',
	REQUIREMENT = 'requirement'
}

const keys = Object.values(GiveawayModes);

export default class Giveaway extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [
				...[GiveawayModes.START, GiveawayModes.REROLL, GiveawayModes.END].map(mode => ({
					name: `g${mode}`,
					prepend: [mode]
				})), {
					name: 'grequire',
					prepend: ['requirement']
				}
			],
			category: 'General',
			cooldown: 5,
			examples: [
				'start 5m Nitro!',
				'{alias:1} {channel} 1h Gift Code!',
				'{alias:4} messages 50'
			],
			name: 'giveaway',
			permissions: member => {
				const config = member.guild.config;
				if (!config) return null;
				const hasAccess = config.accessLevelRoles.slice(1).some(
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
		if (args[0] === GiveawayModes.START) {
			const [id] = args.regular[1].match(SNOWFLAKE_REGEX) || [];
			const length = Util.parseMS(args.regular[id ? 2 : 1]);
			if (length === -1 || length < 120e3) {
				throw new CommandError('INVALID_TIME');
			}
			const { string: prize, flags } = Util.extractFlags(args.regular.slice(id ? 3 : 2).join(' '), [{
				name: 'messageRequirement',
				type: 'number'
			}, {
				name: 'requirement',
				type: 'string'
			}]);
			const channel = id ? message.guild.channels.cache.get(id) : message.channel;
			if (!channel || !Util.isTextBasedChannel(channel)) {
				throw new CommandError('INVALID_CHANNEL');
			}
			if (!prize.length) {
				throw new CommandError('NO_GIVEAWAY_PRIZE');
			}
			if (prize.length > 120) {
				throw new CommandError('INVALID_STRING_LENGTH', 'prize', {
					big: true, length: 120
				});
			}
			const endDate = new Date(Date.now() + length);
			const giveawayMessage = await channel.send(Responses.GIVEAWAY_START(
				prize, {
					end: endDate,
					messageRequirement: flags.messageRequirement as number | undefined,
					requirement: flags.requirement as string | undefined
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
			return;
		}
		const fetchGiveaway = async (id: string, condition: boolean) => {
			const giveaway = await this.client.database.giveaway(id);
			if (!giveaway) {
				if (condition) {
					throw new CommandError('INVALID_MESSAGE_ID', 'Giveaway');
				}
				throw new CommandError('NO_GIVEAWAYS_IN_CHANNEL');
			}
			return giveaway;
		};
		const reroll = args[0] === GiveawayModes.REROLL;
		if (reroll || args[0] === GiveawayModes.END) {
			const giveaway = await fetchGiveaway(args[1] || message.channel.id, typeof args[1] === 'string');
			const ended = giveaway.ended;
			if ((!ended && reroll) || (ended && !reroll)) {
				throw new CommandError(reroll ? 'GIVEAWAY_NOT_FINISHED' : 'GIVEAWAY_FINISHED');
			}
			return giveaway.end();
		}
		if (args[0] === GiveawayModes.REQUIREMENT) {
			const argIsID = args[2] === 'messages';
			const giveaway = await fetchGiveaway(argIsID ? args[1] : message.channel.id, argIsID);
			if (argIsID || args[1] === 'messages') {
				const amount = parseInt(argIsID ? args[3] : args[2]);
				if (isNaN(amount) || amount < 1) {
					throw new CommandError('INVALID_NUMBER', { min: 1 });
				}
				await this.client.database.editGiveaway(giveaway.messageID, {
					messageRequirement: amount
				});
			} else {
				await this.client.database.editGiveaway(giveaway.messageID, {
					requirement: args.regular.slice(1).join(' ')
				});
			}
			const msg = await giveaway.fetchMessage();
			await msg.edit(Responses.GIVEAWAY_START(giveaway.prize, {
				end: giveaway.endAt,
				messageRequirement: giveaway.messageRequirement,
				requirement: giveaway.requirement
			}));
			return send(Responses.REQUIREMENT_ADDED);
		}
		throw new CommandError('INVALID_MODE', keys);
	}
}