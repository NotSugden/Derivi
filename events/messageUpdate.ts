import { ClientEvents } from 'discord.js';
import messageEvent from './message';
import { EventResponses } from '../util/Constants';

export default (async (oldMessage, newMessage) => {
	const { guild, client } = newMessage;
	const config = guild && await guild.fetchConfig();
	if (
		!config ||
		newMessage.partial || oldMessage.content === newMessage.content ||
		newMessage.author.bot
	) return;

	messageEvent(newMessage);

	// so logs aren't spammed with eval edits
	if (
		client.config.ownerIDs.includes(newMessage.author.id) &&
		/^.eval/.test(newMessage.content)
	) return;

	const webhook = config.webhooks.auditLogs;
	if (!webhook) return;

	const embed = EventResponses.MESSAGE_UPDATE(oldMessage, newMessage);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: ClientEvents['messageUpdate']) => void;