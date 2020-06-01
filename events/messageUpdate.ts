import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

export default (async (oldMessage, newMessage) => {
	const { guild, client } = newMessage;
	const config = guild && client.config.guilds.get(guild?.id);
	if (
		!config ||
		newMessage.partial || oldMessage.content === newMessage.content ||
		newMessage.author.bot
	) return;

	// lazy edit handling
	client.emit('message', newMessage);

	// so logs aren't spammed with my eval edits
	if (newMessage.author.id === '381694604187009025' && newMessage.content.startsWith('+eval')) return;

	const webhook = config.webhooks.get('audit-logs');
	if (!webhook) return;

	const embed = EventResponses.MESSAGE_UPDATE(oldMessage, newMessage);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: Events['messageUpdate']) => void;