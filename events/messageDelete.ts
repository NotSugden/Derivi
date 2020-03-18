import { promises as fs } from 'fs';
import Message from '../structures/discord.js/Message';
import { EventResponses } from '../util/Constants';
import { PartialMessage } from '../util/Types';

export default async (message: Message | PartialMessage) => {
	const { client } = message;
	if (!message.guild) return;
	
	const webhook = client.webhooks.get('audit-logs');
	if (!webhook) return;

	/* 
	 * this is the best way i can think of, other than storing the message IDs,
	 * to get the file linked to the message, which i may plan on doing
	 */
	const files = (await fs.readdir(client.config.filesDir))
		.filter(file => file.startsWith(message.id));
	
	const previous = (await message.channel.messages.fetch({
		around: message.id,
		limit: 1
	})).first() as Message;

	const embed = EventResponses.MESSAGE_DELETE(message, {
		files,
		previous
	});

	webhook.send(embed)
		.catch(console.error);
};