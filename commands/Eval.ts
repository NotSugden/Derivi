/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import Message from '../structures/discord.js/Message';
import CommandManager from '../util/CommandManager';
import { URLs } from '../util/Constants';

const util: typeof import('util') = require('util');
const djs: typeof import('discord.js') = require('discord.js');
const fetch: typeof import('node-fetch').default = require('node-fetch');

export default class Eval extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['ev'],
			category: 'Dev',
			cooldown: 0,
			name: 'eval',
			permissions(member) {
				return member.id === '381694604187009025';
			},
			usages: [{
				type: 'code',
			}],
		}, __dirname);
	}

	public async run(message: Message, args: CommandArguments, {
		send,
	}: CommandData): Promise<Message | void> {
		const finish = async (result: unknown) => {
			const inspected = util.inspect(result);
			if (inspected.length > 1250) {
				const { key } = await fetch(URLs.HASTEBIN('documents'), {
					body: inspected,
					headers: {
						'Content-Type': 'application/json',
					},
					method: 'POST',

				}).then(response => response.json());
				return send(key ? `Output was too long, posted to ${URLs.HASTEBIN(key)}` : 'Output was too long for hastebin.');
			}
			return send(inspected, {
				code: 'js', disableMentions: 'everyone',
			});
		};
		try {
			let result = await eval(args.regular.join(' '));
			if (Array.isArray(result) && result.every(element => element && typeof element.then === 'function')) {
				result = await Promise.all(result);
			}
			return finish(result);
		} catch (error) {
			return finish(error.stack);
		}
	}
}