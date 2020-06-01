import {
	User, GuildMember, VoiceChannel,
	CategoryChannel, GuildChannel,
	NewsChannel, StoreChannel,
	Message, Role
} from 'discord.js';
import DMChannel from '../../structures/discord.js/DMChannel';
import TextChannel from '../../structures/discord.js/TextChannel';
import Client from '../Client';
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
		// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
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
	NewsChannel | StoreChannel | GuildChannel |
	TextChannel | VoiceChannel | DMChannel |
	CategoryChannel | null
): { [key: string]: unknown } | null => {
	if (!channel) return null;
	const baseObj = {
		id: channel.id,
		type: channel.type
	} as { [key: string]: unknown };
	if (['text', 'news', 'store'].includes(channel.type)) {
		if (channel.type !== 'store') {
			baseObj.messages = (channel as TextChannel).messages.cache.map(serializeMessage);
			baseObj.topic = (channel as NewsChannel).topic;
		}
		baseObj.nsfw = (channel as TextChannel).nsfw;
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
			children: (channel as CategoryChannel).children.map(serializeChannel)
		};
	} else if (channel.type === 'voice') {
		return {
			...baseObj,
			bitrate: (channel as VoiceChannel).bitrate,
			userLimit: (channel as VoiceChannel).userLimit
		};
	} else if (channel.type === 'text') {
		return {
			...baseObj,
			slowmode: (channel as TextChannel).rateLimitPerUser
		};
	}
	return baseObj;
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
	const channel = client.channels.resolve(data.channelID) as TextChannel | null;
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
	return { channels: guild.channels.cache.map(serializeChannel) };
});

handlers.set('DATABASE_QUERY', async (client, data) => {
	const results = await client.database.query(data.sql, ...data.args.map(
		({ type, value }) => type === 'date' ? new Date(value) : value)
	);
	return { results };
});

handlers.set('GET_CHANNEL_MESSAGES', async (client, data) => {
	const channel = client.channels.resolve(data.channelID);
	if (!channel) {
		throw 'UNKNOWN_CHANNEL_ID';
	} else if (channel.type !== 'text') {
		throw 'INVALID_CHANNEL_TYPE';
	}

	if (data.id) {
		const message = await (channel as TextChannel).messages.fetch(data.id);
		return { message: serializeMessage(message) };
	}
  
	const messages = await (channel as TextChannel).messages.fetch({
		after: data.after,
		around: data.around,
		before: data.before,
		limit: data.limit
	});
  
	return { messages: messages.map(serializeMessage) };
});