import { promises as fs } from 'fs';
import { Snowflake } from 'discord.js';
import Message from '../structures/discord.js/Message';
import User from '../structures/discord.js/User';
import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

export default (async message => {
	const { client, guild } = message;
  
	const config = guild && client.config.guilds.get(guild.id);
	if (
		!config || message.author?.bot
	) return;

	if (!message.author) {
		const [data] = await client.database.query<{ user_id: Snowflake }>(
			'SELECT user_id FROM messages WHERE id = ?',
			message.id
		);
		if (data) {
			try {
				message.author = await client.users.fetch(data.user_id) as User;
			} catch { } // eslint-disable-line no-empty
		}
	}

	try {
		await client.database.query(
			'DELETE FROM messages WHERE id = ?',
			message.id
		);
	} catch (error) {
		console.error(error);
	}
	
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