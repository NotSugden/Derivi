/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/order */
import { WebhookClient, MessageOptions } from 'discord.js';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandManager from '../util/CommandManager';
import { URLs } from '../util/Constants';
import Util from '../util/Util';
import { GuildMessage, Message, DMMessage } from '../util/Types';

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
			permissions: member => member.client.config.ownerIDs.includes(member.id),
			usages: [{
				type: 'code'
			}]
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, {
		send
	}: CommandData): Promise<Message | void> {
		const { string: code, flags } = Util.extractFlags(
			args.regular.join(' '), [{
				name: 'silent',
				type: 'boolean'
			}, {
				name: 'async',
				type: 'boolean'
			}]
		);
		const reverse = (string: string) => string.split('').reverse().join('');
		const finish = async (result: unknown) => {
			let inspected = (typeof result === 'string' ? result : util.inspect(result)).replace(
				new RegExp(`${this.client.token}|${reverse(this.client.token)}`, 'gi'),
				'[TOKEN]'
			);
			const webhooks = [...this.client.config.guilds.values()].reduce((acc, next) => {
				acc.push(...next.webhooks.values());
				return acc;
			}, [] as WebhookClient[]);
			if (webhooks.length) {
				inspected = inspected.replace(new RegExp(
					webhooks.map(hook => `${hook.token}|${reverse(hook.token)}`).join('|'),
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
        message.author.send(content, options) as Promise<DMMessage> :
				send(content, options);
			if (inspected.length > 1250) {
				const json = await fetch(URLs.HASTEBIN('documents'), {
					body: inspected,
					headers: {
						'Content-Type': 'application/json'
					},
					method: 'POST'

				}).then(response => response.json());
				return respond(
					json.key ?
						`Output was too long, posted to ${URLs.HASTEBIN(json.key)}` :
						'Output was too long for hastebin.'
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
			return finish(result);
		} catch (error) {
			return finish(error.stack);
		}
	}
}
