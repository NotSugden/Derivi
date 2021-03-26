import { APIInteractionResponseType, MessageFlags } from 'discord-api-types/v8';
import {
	CategoryChannel, Client,
	Collection, DMChannel,
	Guild, GuildMember, Message,
	NewsChannel, Role,
	Snowflake, StoreChannel,
	TextChannel, User,
	VoiceChannel
} from 'discord.js';
import Command from '../../structures/Command';
import Interaction from '../../structures/Interaction';
import { CommandErrors } from '../Constants';
import { GuildChannels } from '../Types';
import Util from '../Util';
import { ProcessActionObject } from '../WebsiteManager';

type HandlerFunction<T> = ((client: Client, data: T extends never ? 
	ProcessActionObject :
	Arguments<T>) => Promise<{ [key: string]: unknown }>);

class Handlers extends Map<
  ProcessActionObject['type'],
	(client: Client, data: ProcessActionObject) => Promise<{ [key: string]: unknown }>
> {
	public get<T extends ProcessActionObject['type']>(key: T): undefined | HandlerFunction<T> {
		return super.get(key);
	}

	public set<T extends ProcessActionObject['type']>(key: T, fn: HandlerFunction<T>) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		return super.set(key, fn);
	}
}

const handlers = new Handlers();

export default handlers;

export type Arguments<T> = Extract<ProcessActionObject, { type: T }>;

const serializeUser = (user: User | null) => {
	if (!user) return null;
	return {
		avatarURL: user.displayAvatarURL({ dynamic: true }),
		bot: user.bot,
		flags: user.flags ? user.flags.toArray() : [],
		id: user.id,
		tag: user.tag
	};
};

const serializeRole = (role: Role | null) => {
	if (!role) return null;
	return {
		color: role.hexColor,
		hoist: role.hoist,
		id: role.id,
		managed: role.managed,
		mentionable: role.mentionable,
		name: role.name,
		permissions: role.permissions.toArray(),
		position: role.rawPosition
	};
};

const serializeMember = (member: GuildMember | null) => {
	if (!member) return null;
	return {
		displayColor: member.displayHexColor,
		joinedAt: member.joinedAt?.toISOString(),
		nickname: member.nickname,
		permissions: member.permissions.toArray(),
		roles: member.roles.cache.map(serializeRole),
		user: serializeUser(member.user as User)
	};
};

const serializeMessage = (message: Message | null) => {
	if (!message) return null;
	return {
		attachments: message.attachments.map(attachment => ({
			proxyURL: attachment.proxyURL,
			url: attachment.url
		})),
		authorID: message.author?.id,
		channelID: message.channel.id,
		cleanContent: message.cleanContent,
		content: message.content,
		editedAt: message.editedAt ? message.editedAt.toISOString() : null,
		embeds: message.embeds.map(embed => embed.toJSON()),
		flags: message.flags.toArray(),
		guildID: message.guild ? message.guild.id : null,
		id: message.id,
		mentions: {
			everyone: message.mentions.everyone,
			roles: message.mentions.roles.map(serializeRole),
			users: message.mentions.users.map(serializeUser)
		},
		pinned: message.pinned,
		tts: message.tts,
		type: message.type
	};
};

const serializeChannel = (channel:
	TextChannel | NewsChannel | StoreChannel |
	VoiceChannel | DMChannel |
	CategoryChannel | null
): { [key: string]: unknown } | null => {
	if (!channel) return null;
	const baseObj = {
		id: channel.id,
		type: channel.type
	} as { [key: string]: unknown };
	if (Util.isTextBasedChannel(channel)) {
		baseObj.messages = channel.messages.cache.map(serializeMessage);
		if (channel.type !== 'dm') {
			baseObj.topic = channel.topic;
			baseObj.nsfw = channel.nsfw;
		}
	}
	if (channel.type === 'store') {
		return {
			...baseObj
		};
	}
	if (channel.type === 'dm') {
		return {
			...baseObj,
			recipientID: channel.recipient.id
		};
	} else baseObj.name = channel.name;
	baseObj.parentID = channel.parentID;
	baseObj.position = channel.calculatedPosition;
	if (channel.type === 'category') {
		return {
			...baseObj,
			children: (channel.children as Collection<Snowflake, Exclude<GuildChannels, CategoryChannel>>)
				.map(serializeChannel)
		};
	} else if (channel.type === 'voice') {
		return {
			...baseObj,
			bitrate: channel.bitrate,
			userLimit: channel.userLimit
		};
	} else if (channel.type === 'text') {
		return {
			...baseObj,
			slowmode: channel.rateLimitPerUser
		};
	}
	return baseObj;
};

const serializeGuild = (guild: Guild | null) => {
	if (!guild) return null;
	return {
		afkChannelID: guild.afkChannelID,
		afkTimeout: guild.afkTimeout,
		bannerURL: guild.bannerURL({ format: 'png' }),
		channels: guild.channels.cache.keyArray(),
		iconURL: guild.iconURL({ dynamic: true }),
		id: guild.id,
		memberCount: guild.memberCount,
		name: guild.name,
		splashURL: guild.splashURL({ format: 'png' }),
		vanityCode: guild.vanityURLCode
	};
};

handlers.set('EVAL', async (client, data) => {
	let result;
	try {
		result = await eval(data.script);
	} catch (error) {
		result = error;
	}
	return { result };
});

handlers.set('SEND_MESSAGE', async (client, data) => {
	const channel = client.channels.resolve(data.channelID) as GuildChannels | DMChannel | null;
	if (channel?.type !== 'text') {
		throw channel ? 'INVALID_CHANNEL_TYPE' : 'INVALID_CHANNEL';
	}
	const msg = await channel.send(data.options);
	return { messageID: msg.id };
});

handlers.set('GET_GUILD_MEMBERS', async (client, data) => {
	const guild = client.guilds.resolve(data.guildID);
	if (!guild) {
		throw 'UNKNOWN_GUILD_ID';
	}
	if (data.ids) {
		const members = [];
		for (const id of data.ids) {
			try {
				members.push(await guild.members.fetch(id));
			} catch {
				members.push(null);
			}
		}
		return { members: members.map(serializeMember) };
	}
	const members = await guild.members.fetch({
		query: data.query
	});
	return { members: members.array().map(serializeMember)};
});

handlers.set('GET_GUILD_CHANNELS', async (client, data) => {
	const guild = client.guilds.resolve(data.guildID);
	if (!guild) {
		throw 'UNKNOWN_GUILD_ID';
	}
	return {
		channels: (guild.channels.cache as Collection<Snowflake, GuildChannels>)
			.map(serializeChannel)
	};
});

handlers.set('DATABASE_QUERY', async (client, data) => {
	const results = await client.database.query(data.sql, ...data.args.map(
		({ type, value }) => type === 'date' ? new Date(value) : value)
	);
	return { results };
});

handlers.set('GET_CHANNEL_MESSAGES', async (client, data) => {
	const channel = client.channels.resolve(data.channelID) as GuildChannels | DMChannel | null;
	if (channel?.type !== 'text') {
		throw channel ? 'INVALID_CHANNEL_TYPE' : 'INVALID_CHANNEL';
	}

	if (data.id) {
		const message = await channel.messages.fetch(data.id);
		return { message: serializeMessage(message) };
	}
  
	const messages = await channel.messages.fetch({
		after: data.after,
		around: data.around,
		before: data.before,
		limit: data.limit
	});
  
	return { messages: messages.map(serializeMessage) };
});

handlers.set('GET_GUILD', async (client, data) => {
	if (!data.id) {
		const guilds = client.guilds.cache.map(serializeGuild);
		if (data.withChannels) {
			for (const guild of guilds) {
				// this is dumb but whatever
				(guild as unknown as { channels: { [key: string]: unknown }[] })
					.channels = guild!.channels.map(
						id => serializeChannel(client.channels.resolve(id) as TextChannel)!
					);
			}
		}
		return { guilds };
	}
	const guild = serializeGuild(client.guilds.resolve(data.id));
	if (!guild) {
		throw 'UNKNOWN_GUILD_ID';
	}
  
	if (data.withChannels) {
		(guild as unknown as { channels: { [key: string]: unknown }[]})
			.channels = guild!.channels.map(
				id => serializeChannel(client.channels.resolve(id) as GuildChannels)!
			);
	}
  
	return { guild };
});

handlers.set('RUN_INTERACTION', async (client, { data }) => {
	const command = client.commands.resolve(data.data!.name);
	if (!command) return { response: {
		data: {
			content: 'Unknown command',
			flags: MessageFlags.EPHEMERAL
		},
		type: APIInteractionResponseType.ChannelMessageWithSource
	} };
	try {
		const interaction = new Interaction(client, data);
		const hasPermissions = await Command.hasPermissions(command, interaction.member, interaction.channel);
		if (hasPermissions === null) return { response: {
			data: {
				content: CommandErrors.INSUFFICIENT_PERMISSIONS(),
				flags: MessageFlags.EPHEMERAL
			},
			type: APIInteractionResponseType.ChannelMessageWithSource
		} };
		const isString = typeof hasPermissions === 'string';
		if (!hasPermissions || isString) {
			return { response: {
				data: {
					content: isString ? hasPermissions : CommandErrors.INSUFFICIENT_PERMISSIONS(),
					flags: MessageFlags.EPHEMERAL
				},
				type: APIInteractionResponseType.ChannelMessageWithSource
			} };
		}
		const response = await command.interaction(interaction);
		return { response };
	} catch (error) {
		console.error('Interaction error:', error);
		return { response: {
			data: {
				content: 'An error occoured executing this command, try again later.',
				flags: MessageFlags.EPHEMERAL
			},
			type: APIInteractionResponseType.ChannelMessageWithSource
		} };
	}
});