/* eslint-disable @typescript-eslint/no-var-requires */
import { promises as fs } from 'fs';
import { join } from 'path';
import {
	Constants,
	Extendable,
	Structures,
	User as DJSUser,
	// Intents,
	Guild as DJSGuild,
	PartialUser,
	ClientEvents
} from 'discord.js';
import Guild from './structures/discord.js/Guild';
import User from './structures/discord.js/User';
import Client from './util/Client';
const extended: (keyof Extendable)[] = [
	'Message', 'Guild', 'GuildMember', 'User',
	'DMChannel', 'TextChannel'
];
for (const className of extended) {
	Structures.extend(className, () => require(join(__dirname, 'structures', 'discord.js', className)).default);
}
const config = require(join(__dirname, 'config.json'));
const client = new Client(config, {
	disableMentions: 'everyone',
	partials: ['REACTION', 'MESSAGE'],
	presence: {
		activity: {
			name: `${config.prefix}help`
		}
	},
	ws: {
		// Intents are borked? idk not recieving GUILD_MEMBER_UPDATE events
		/*intents: [
			Intents.FLAGS.DIRECT_MESSAGES,
			Intents.FLAGS.GUILDS,
			Intents.FLAGS.GUILD_INVITES,
			// The below intent must be enabled in your application settings
			Intents.FLAGS.GUILD_MEMBERS,
			Intents.FLAGS.GUILD_MESSAGES,
			Intents.FLAGS.GUILD_MESSAGE_REACTIONS
		]*/
	}
});
client.on('error', console.error);
client.on('warn', console.warn);
/** 
 * These events should be put in place to handle the `Guild#invites` and `Guild#bans`
 * properties added in the custom extended Guild structure
 * `user` shouldn't be a partial, so it is typed as such
 */
client.on(Constants.Events.GUILD_BAN_ADD, (async (guild: Guild, user: User) => {
	if (guild.bans.has(user.id)) return;
	try {
		const ban = await guild.fetchBan(user) as {
			user: User;
			reason: string | null;
		};
		guild.bans.set(user.id, ban);
	} catch {
		client.emit('warn', 'Recieved an error fetching a ban in the \'guildBanAdd\' event, this should not happen');
	}
}) as (guild: DJSGuild, user: DJSUser | PartialUser) => Promise<void>);

client.on(Constants.Events.GUILD_BAN_REMOVE, (async (guild: Guild, user: User) => {
	guild.bans.delete(user.id);
}) as (guild: DJSGuild, user: DJSUser | PartialUser) => Promise<void>);

client.connect();

/**
 * `events` should be a folder in the root directory of bot
 * this may become configurable at a later date
 */
fs.readdir(join(__dirname, 'events')).then(files => {
	for (const file of files) {
		const fn: (...args: unknown[]) => void = require(
			join(__dirname, 'events', file)
		).default;
		client.on(file.split('.')[0] as keyof ClientEvents, fn);
	}
}, err => {
	console.error(err);
	process.exit(1);
});

client.on('ready', () => console.log('Ready'));