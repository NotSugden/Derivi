import * as path from 'path';
import Command, { CommandData, CommandCategory } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandError from '../util/CommandError';
import CommandManager from '../util/CommandManager';
import { Responses, COMMAND_URL } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export enum SourceModes {
	COMMAND = 'command',
	STATS = 'stats'
}

const modeKeys = Object.values(SourceModes);

export default class BotInfo extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [{
				name: ['botstats', 'bot-stats'],
				prepend: [SourceModes.STATS]
			}, {
				name: ['source', 'command-source'],
				prepend: [SourceModes.COMMAND]
			}],
			category: CommandCategory.GENERAL,
			cooldown: 0,
			examples: [
				'', 'command rank'
			],
			name: 'botinfo',
			permissions: 0
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, {
		send
	}: CommandData) {
		if (!args[0]) {
			return send(Responses.BOT_SOURCE);
		}
		if (args[0] === SourceModes.STATS) {
			// Combining these into one query interestingly makes the query take alot longer
			const [{ totalPoints }] = await this.client.database.query<{ totalPoints: number }>(
				'SELECT SUM(amount) + SUM(vault) as totalPoints FROM points'
			);
			const [{ totalXP }] = await this.client.database.query<{ totalXP: number }>(
				'SELECT SUM(xp) as totalXP FROM levels'
			);
			return send(Responses.BOT_STATS(this.client, totalXP, totalPoints));
		}
		if (args[0] === SourceModes.COMMAND) {
			const command = this.client.commands.resolve(args[1]);
			if (!command) throw new CommandError('COMMAND_NOT_FOUND');
			const folders = command.path.split(path.sep);
			folders.splice(0, folders.indexOf('commands'));
			folders[folders.length-1] = folders[folders.length-1].replace(/\.js$/, '.ts');
			return send(`<${COMMAND_URL(folders)}>`);
		}
		throw new CommandError('INVALID_MODE', modeKeys);
	}
}
