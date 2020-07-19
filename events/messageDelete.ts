import { promises as fs } from 'fs';
import { ClientEvents, Snowflake } from 'discord.js';
import { EventResponses } from '../util/Constants';

export default (async message => {
	const { client, guild } = message;
  
	const config = guild && await guild.fetchConfig();
	if (!config) return;
	if (!message.author || message.author.id === client.user!.id) {
		await client.database.query(
			'DELETE FROM giveaways WHERE message_id = :messageID',
			{ messageID: message.id }
		);
		const cache = client.database.cache.giveaways;
		if (cache.has(message.id)) {
			cache.clearTimeout(message.id);
			cache.delete(message.id);
		}
	}

	if (!message.author) {
		const [data] = await client.database.query<{ user_id: Snowflake }>(
			'SELECT user_id FROM messages WHERE id = ?',
			message.id
		);
		if (data) {
			try {
				message.author = await client.users.fetch(data.user_id);
			} catch (error) {
				client.emit('error', error);
			}
		}
	}

	try {
		await client.database.query(
			'DELETE FROM messages WHERE id = ?',
			message.id
		);
	} catch (error) {
		client.emit('error', error);
	}
	
	const webhook = config.webhooks.auditLogs;
	if (!webhook) return;

	let files;
	if (client.config.attachmentLogging) {
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
	})).first();

	const embed = EventResponses.MESSAGE_DELETE(message, {
		files,
		previous
	});

	webhook.send(embed)
		.catch(console.error);
}) as (...args: ClientEvents['messageDelete']) => void;