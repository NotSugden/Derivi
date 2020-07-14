import { promises as fs } from 'fs';
import { ClientEvents, SnowflakeUtil, Snowflake } from 'discord.js';
import * as moment from 'moment';
import { escape } from 'mysql';
import { EventResponses } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export default (async messages => {
	const { client, guild, channel } = messages.first()! as GuildMessage;

	const config = guild && client!.config.guilds.get(guild.id);
	if (!config) return;

	try {
		const ids = [];
		for (const message of messages.values()) {
			ids.push(`id = ${escape(message.id)}`);
			if (message.author) continue;
			const [data] = await client!.database.query<{ user_id: Snowflake }>(
				'SELECT user_id FROM messages WHERE id = ?',
				message.id
			);
			if (!data) continue;
			try {
				message.author = await client!.users.fetch(data.user_id);
			} catch { } // eslint-disable-line no-empty
		}
		await client!.database.query(
			`DELETE FROM messages WHERE ${ids.join(' OR ')}`
		);
	} catch (error) {
		console.error(error);
	}
	
	const webhook = config.webhooks.get('audit-logs');
	if (!webhook) return;

	const json = messages.map(message => ({
		attachments: client!.config.attachmentLogging ? [] as string[] : undefined,
		author: message.author ? {
			id: message.author.id,
			tag: message.author.tag
		} : 'Unknown User#0000',
		content: message.content ?
			message.cleanContent!.split('\n') : [typeof message.content === 'string' ?
				'No content.' : 'Message content was not cached.'],
		embed: message.embeds![0]?.toJSON(),
		id: message.id,
		mentions: {
			channels: message.mentions.channels.map(channel => ({
				id: channel.id,
				name: channel.name
			})),
			roles: message.mentions.roles.map(role => ({
				id: role.id,
				name: role.name
			})),
			users: message.mentions.users.map(user => ({
				id: user.id,
				tag: user.tag
			}))
		},
		sentAt: moment.utc(
			new Date(message.createdTimestamp || SnowflakeUtil.deconstruct(message.id).timestamp)
		).format('DD/MM/YYYY HH:mm A')
	}));
	if (client!.config.attachmentLogging && config.filePermissionsRole) {
		const directory = await fs.readdir(client!.config.filesDir);
		for (const { attachments, id } of json) {
			const files = directory.filter(file => file.startsWith(id));
			if (files.length) attachments!.push(...files.map(file => `${client!.config.attachmentsURL}/${file}`));
		}
	}
	
	const previous = (await channel!.messages.fetch({
		around: messages.last()!.id,
		limit: 1
	})).first();

	const response = EventResponses.MESSAGE_DELETE_BULK(channel, {
		amount: messages.size, json, previous
	});

	webhook.send(response)
		.catch(console.error);
}) as (...args: ClientEvents['messageDeleteBulk']) => void;