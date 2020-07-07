import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

export default class Shop extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['buy'],
			category: 'Points',
			cooldown: 5,
			examples: [
				'{alias:1} Cool Role'
			],
			name: 'shop'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const config = message.guild && this.client.config.guilds.get(message.guild.id);
  
		if (!config) return;
		if (this.client.lockedPoints.has(message.author.id)) {
			throw new CommandError('LOCKED_POINTS');
		}
		if (!args[0]) {
			return send(Responses.SHOP_LAYOUT(config.shopItems, message.guild!));
		}

		const NAMES = config.shopItems.map(item => {
			if (item.action === 'give_role') {
				const role = message.guild.roles.cache.get(item.role_id)!;
				return {
					action: 'give_role',
					cost: item.cost,
					name: role.name.toLowerCase(),
					roleID: role.id
				};
			}
			else throw new Error('Configured shop item has invalid action.');
		});

		const name = args.join(' ');
		const item = NAMES.find(item => item.name === name);

		if (!item) {
			throw new CommandError('UNKNOWN_SHOP_ITEM', name);
		}

		if (item.action === 'give_role') {
			if (message.member.roles.cache.has(item.roleID)) {
				throw new CommandError('ALREADY_PURCHASED');
			}
		}

		if (item.cost > 0) {
			const points = await this.client.database.points(message.author);
			if (points.amount < item.cost) {
				throw new CommandError('NOT_ENOUGH_POINTS', item.cost);
			}
			await points.set({
				amount: points.amount - item.cost
			});
		}

		if (item.action === 'give_role') {
			await message.member.roles.add(item.roleID);
		}

		return send(Responses.SUCCESSFUL_PURCHASE(item.name));
	}
}