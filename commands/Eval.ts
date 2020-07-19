/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/order */
import { WebhookClient, MessageOptions } from 'discord.js';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandManager from '../util/CommandManager';
import { URLs } from '../util/Constants';
import Util from '../util/Util';
import { GuildMessage } from '../util/Types';

const util: typeof import('util') = require('util');
const djs: typeof import('discord.js') = require('discord.js');
const fetch: typeof import('node-fetch').default = require('node-fetch');

let EvalUtil;

try {
	// this can be a custom file, exported should be a class with static utility functions
	const mod = require('../EvalUtil.js');
	EvalUtil = mod.default || mod;
} catch { } // eslint-disable-line no-empty

export default class Eval extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['ev', {
				name: 'evala',
				prepend: ['--async=true']
			}],
			category: 'Dev',
			cooldown: 0,
			examples: [
				'message.channel.send("Hello!")'
			],
			name: 'eval',
			permissions: member => member.client.config.ownerIDs.includes(member.id)
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, {
		send
	}: CommandData): Promise<void> {
		const { string: _code, flags } = Util.extractFlags(
			args.regular.join(' '), [{
				name: 'silent',
				type: 'boolean'
			}, {
				name: 'async',
				type: 'boolean'
			}, {
				name: 'hastebin',
				type: 'boolean'
			}]
		);
		const code = _code.match(/```(?:(?<lang>\S+)\n)?\s?(?<code>[^]+?)\s?```/)?.groups?.code ?? _code;
		const reverse = (string: string) => string.split('').reverse().join('');
		const finish = async (result: unknown) => {
			let inspected = (typeof result === 'string' ? result : util.inspect(result)).replace(
				new RegExp(`${this.client.token}|${reverse(this.client.token!)}`, 'gi'),
				'[TOKEN]'
			);
			const { config } = message.guild;
			const webhooks = config && Object.values(config.webhooks)
				.filter(value => typeof value !== 'undefined');
			if (webhooks && webhooks.length) {
				inspected = inspected.replace(new RegExp(
					webhooks.map(hook => `${hook!.token}|${reverse(hook!.token)}`).join('|'),
					'gi'
				), '[WEBHOOK TOKEN]');
			}
			if (this.client.config.encryptionPassword) {
				inspected = inspected.replace(
					new RegExp(
						`${this.client.config.encryptionPassword}|${reverse(this.client.config.encryptionPassword)}`,
						'gi'
					),
					'[ENCRYPTION PASSWORD]'
				);
			}
			const respond = (content: unknown, options?: MessageOptions) => flags.silent ?
				message.author.send(content, options) :
				send(content, options);
			if (inspected.length > 1250 || flags.hastebin) {
				const json = await fetch(URLs.HASTEBIN('documents'), {
					body: inspected,
					headers: {
						'Content-Type': 'application/json'
					},
					method: 'POST'

				}).then(response => response.json());
				if (!json.key) return send('Output was too long for hastebin');
				const url = URLs.HASTEBIN(json.key);
				return respond(
					flags.hastebin ? url : `Output was too long, posted to ${url}`
				);
			}
			return respond(inspected, {
				code: 'js'
			});
		};
		try {
			let result = await eval(flags.async ? `(async() => {${code}})()` : code);
			if (Array.isArray(result) && result.every(element => typeof element?.then === 'function')) {
				result = await Promise.all(result);
			}
			await finish(result);
		} catch (error) {
			await finish(error.stack);
		}
	}
}
