import { promises as fs } from 'fs';
import Message from '../structures/discord.js/Message';
import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

export default (async message => {
	const { client, guild } = message;
  
	const config = guild && client.config.guilds.get(guild.id);
	if (
		!config || message.author?.bot
	) return;
	
	const webhook = config.webhooks.get('audit-logs');
	if (!webhook) return;

	let files;
	if (client.config.attachmentLogging && config.filePermissionsRole) {
	/* 
	 * this is the best way i can think of, other than storing the message IDs,
	 * to get the file linked to the message, which i may plan on doing
	 */
		files = (await fs.readdir(client.config.filesDir))
			.filter(file => file.startsWith(message.id));
	}
	
	const previous = (await message.channel.messages.fetch({
		around: message.id,
		limit: 1
	})).first() as Message | undefined;

	const embed = EventResponses.MESSAGE_DELETE(message, {
		files,
		previous
	});

	webhook.send(embed)
		.catch(console.error);
}) as (...args: Events['messageDelete']) => void;