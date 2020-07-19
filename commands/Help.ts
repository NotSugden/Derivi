import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandError from '../util/CommandError';
import CommandManager, { CommandResolvable } from '../util/CommandManager';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

export default class Help extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'General',
			cooldown: 5,
			examples: [
				'', 'points', 'level'
			],
			name: 'help'
		}, __filename);
	}

	public async commandHelp(send: CommandData['send'], message: GuildMessage<true>, cmd: CommandResolvable) {
		const command = this.client.commands.resolve(cmd);
		if (!command) {
			throw new CommandError('COMMAND_NOT_FOUND');
		}
		const hasPermissions = await Command.hasPermissions(command, message.member, message.channel);
		if (hasPermissions === null || typeof hasPermissions === 'string') {
			throw new CommandError('COMMAND_NOT_FOUND');
		}
		if (!hasPermissions) {
			throw new CommandError('INSUFFICIENT_PERMISSIONS', true);
		}
		return send(Responses.COMMAND_HELP(command, message));
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		if (args[0]) return this.commandHelp(send, message, args[0]);

		const categories: { category: string; commands: Command [] }[] = [];
		for (const command of this.client.commands.values()) {
			const hasPermissions = await Command.hasPermissions(command, message.member, message.channel);
			if (hasPermissions !== true) continue;
			const existing = categories.find(({ category }) => category === command.category);
			if (existing) {
				existing.commands.push(command);
				continue;
			}
			categories.push({ category: command.category, commands: [command] });
		}

		await send(Responses.HELP_PROMPT(categories, this.client));
		let category: { category: string; commands: Command[] } | undefined;
		const categoryResponse = await Util.awaitResponse(message.channel, message.author, resp => {
			const content = resp.content.toLowerCase();
			if (content === 'cancel') return true;
			const foundCategory = categories.find(({ category }, index) => {
				return (index + 1).toString() === content || category.toLowerCase().startsWith(content);
			});
			if (!foundCategory) return false;
			category = foundCategory;
			return true;
		}, 3e4);
		if (!categoryResponse) {
			throw new CommandError('RESPONSE_TIMEOUT', '30 Seconds');
		}
		if (!category) return;

		await send(Responses.CATEGORY_HELP(category, this.client));

		let command: Command | undefined;
		const commandResponse = await Util.awaitResponse(message.channel, message.author, resp => {
			const content = resp.content.toLowerCase();
			if (content === 'cancel') return true;
			const foundCommand = category!.commands.find((command, index) => {
				return (index + 1).toString() === content || command.name.startsWith(content);
			});
			if (!foundCommand) return false;
			command = foundCommand;
			return true;
		}, 3e4);
		if (!commandResponse || !command) return;
		return this.commandHelp(send, message, command);
	}
}