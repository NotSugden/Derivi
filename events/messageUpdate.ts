import Message from '../structures/discord.js/Message';
import { EventResponses } from '../util/Constants';
import { PartialMessage } from '../util/Types';

export default async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
	const { guild, client } = newMessage;
	if (
		!guild || guild.id !== client.config.defaultGuildID ||
		newMessage.partial || oldMessage.content === newMessage.content ||
		newMessage.author.bot
	) return;

	// lazy edit handling
	client.emit('message', newMessage);

	// so logs aren't spammed with my eval edits
	if (newMessage.author.id === '381694604187009025' && newMessage.content.startsWith('+eval')) return;

	const webhook = client.webhooks.get('audit-logs');
	if (!webhook) return;

	const embed = EventResponses.MESSAGE_UPDATE(oldMessage, newMessage);
	webhook.send(embed)
		.catch(console.error);
};