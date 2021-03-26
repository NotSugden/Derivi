import { APIInteractionResponseType, MessageFlags } from 'discord-api-types/v8';
import Command, { CommandData, CommandCategory, InteractionResponse } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Interaction from '../../structures/Interaction';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';

enum VaultModes {
	DEPOSIT = 'deposit',
	WITHDRAW = 'withdraw'
}

enum VaultAliasModes {
	dep = VaultModes.DEPOSIT,
	d = VaultModes.DEPOSIT,
	w = VaultModes.WITHDRAW
}

const keys = Object.values(VaultModes);

export default class Vault extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['bank', 'v', {
				name: 'dep',
				prepend: ['deposit']
			}, {
				name: 'w',
				prepend: ['withdraw']
			}],
			category: CommandCategory.POINTS,
			cooldown: 5,
			examples: [
				'{alias:3} 500',
				'{alias:4} 500'
			],
			name: 'vault'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const points = await this.client.database.points(message.author);

		const mode = keys.includes(args[0] as VaultModes)
			? args[0]
			// eslint-disable-next-line max-len
			// I think this is a bug because the enum `VaultAliasModes` compiles to a string-keyed object not a number-keyed object
			: VaultAliasModes[args[0] as unknown as number] || args[0];

		if (!mode) return send(Responses.VAULT_CHECK(message.author, points.vault));

		if (this.client.lockedPoints.has(message.author.id)) {
			throw new CommandError('LOCKED_POINTS');
		}

		if (mode === VaultModes.DEPOSIT) {
			const amount = args[1] === 'all' ? points.amount : parseInt(args[1]);
			if (points.amount === 0) {
				throw new CommandError('NO_POINTS');
			} else if (isNaN(amount) || amount < 1) {
				throw new CommandError('INVALID_NUMBER', { min: 1 });
			} else if (points.amount < amount) {
				throw new CommandError('NOT_ENOUGH_POINTS', amount);
			}

			await points.set({
				amount: points.amount - amount,
				vault: points.vault + amount
			});

			return send(Responses.DEPOSIT_SUCCESS(amount));
		} else if (mode === VaultModes.WITHDRAW) {
			const amount = args[1] === 'all' ? points.vault : parseInt(args[1]);
			if (points.vault === 0) {
				throw new CommandError('NO_POINTS', true);
			} else if (isNaN(amount) || amount < 1) {
				throw new CommandError('INVALID_NUMBER', { min: 1 });
			} else if (points.vault < amount) {
				throw new CommandError('NOT_ENOUGH_POINTS', amount);
			}

			await points.set({
				amount: points.amount + amount,
				vault: points.vault - amount
			});

			return send(Responses.WITHDRAW_SUCCESS(amount));
		}
		throw new CommandError('INVALID_MODE', keys);
	}

	public async interaction(interaction: Interaction): Promise<InteractionResponse> {
		const { user } = interaction.member;
		const { vault } = await this.client.database.points(user);
		return { data: {
			content: Responses.VAULT_CHECK(user, vault),
			flags: MessageFlags.EPHEMERAL
		}, type: APIInteractionResponseType.ChannelMessageWithSource };
	}
}