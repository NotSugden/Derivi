import { promises as fs } from 'fs';
import { join } from 'path';
import { MessageMentions } from 'discord.js';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import Guild from '../structures/discord.js/Guild';
import TextChannel from '../structures/discord.js/TextChannel';
import { RawGuildConfig, ClientConfig, resolveGuildConfig } from '../util/Client';
import CommandManager from '../util/CommandManager';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

enum ConfigModes {
	SETUP = 'setup'
}

const CONFIG_ITEMS = [{
	description: 'Requires two factor authentication be enabled to use moderation commands.',
	key: 'mfa_moderation',
	name: '2FA Moderation',
	type: 'boolean'
}, {
	description: 'Owner, Admin, Moderator, and Trainee roles.',
	key: 'access_level_roles',
	name: 'Access Level Roles',
	type: 'roles-4'
}, {
	description: 'The category in the staff server.',
	key: 'staff_server_category',
	name: 'Staff Server Category',
	type: 'channel_id'
}, {
	description: 'The channel moderation cases are sent to.',
	key: 'punishment_channel',
	name: 'Case Logging Channel',
	type: 'channel_id'
}, {
	description: 'The channel staff commands should be used in.',
	key: 'staff_commands_channel',
	name: 'Staff Commands Channel',
	type: 'channel_id'
}, {
	description: 'The channel auto reports are sent to.',
	key: 'reports_channel',
	name: 'Auto Reports Channel.',
	type: 'channel_id'
}, {
	default: (guild: Guild) => guild.id,
	description: 'The ID of the guild',
	key: 'id',
	name: 'Guild ID',
	type: 'guild_id'
}, {
	description: 'The role that file (mostly image) permissions are locked to.',
	key: 'file_permissions_role',
	name: 'File Permissions Role',
	type: 'role'
}, {
	default: (guild: Guild) => guild.roles.cache.find(role => role.name === 'Welcome'),
	description: 'The welcome role that is pinged when members join.',
	key: 'welcome_role',
	name: 'Welcome Role',
	optional: true,
	type: 'role'
}, {
	default: (guild: Guild) => guild.channels.cache.find(ch => ch.name === 'partner-rewards'),
	description: 'The partnership rewards channel.',
	key: 'partner_rewards_channel',
	name: 'Partnership Rewards Channel',
	type: 'channel'
}, {
	default: (guild: Guild) => guild.channels.cache.find(ch => ch.name === 'rules'),
	description: 'The rules channel.',
	key: 'rules_channel',
	name: 'Rules Channel',
	type: 'channel'
}, {
	default: (guild: Guild) => guild.channels.cache.find(ch => ch.name === 'starboard'),
	description: 'The starboard channel.',
	key: 'starboard.channel_id',
	name: 'Starboard Channel',
	optional: true,
	type: 'channel'
}, {
	default: (guild: Guild) => guild.channels.cache.find(ch => ch.name === 'general'),
	description: 'The general channel.',
	key: 'general_channel',
	name: 'General Channel',
	type: 'channel'
}];
// <3 milk
export default class BotConfig extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Dev',
			cooldown: 0,
			name: 'botconfig',
			permissions: member => member.client.config.ownerIDs.includes(member.id),
			usages: [{
				type: 'setup'
			}]
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const mode = args[0];
		if (mode === ConfigModes.SETUP) {
			if (message.editedTimestamp) return send('This command does not support being edited.');
			if (this.client.config.guilds.has(message.guild.id)) {
				return message.channel.send(
					'Configuration is already setup for this guild'
				) as Promise<GuildMessage<true>>;
			}

			const configData = {
				// this needs to be done manually
				partnership_channels: [] as RawGuildConfig['partnership_channels'],
				report_regex: [] as string[],
				shop_items: [] as RawGuildConfig['shop_items'],
				starboard: {
					enabled: false,
					minimum: 3,
					reaction_only: true
				},
				webhooks: [] as RawGuildConfig['webhooks']
			} as RawGuildConfig;

			const setProp = (str: string, value: string | boolean | string[]) => {
				const keys = str.split('.') as (keyof RawGuildConfig)[];
				// im lazy and couldn't think of a better way to do this
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				keys.reduce((acc, next, index) => {
					const item = acc[next];
					// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
					// @ts-ignore
					if (index === keys.length - 1) acc[next] = value;
					return item;
				}, configData);
			};

			const messages = [];

			const resolveRole = (msg: GuildMessage<true>) => {
				return msg.mentions.roles.first()
					|| msg.guild.roles.cache.get(msg.content)
					|| msg.guild.roles.cache.find(role => role.name === msg.content.toLowerCase());
			};

			const resolveChannel = (msg: GuildMessage<true>) => {
				return msg.mentions.channels.first()
					|| msg.guild.channels.cache.get(msg.content)
					|| msg.guild.channels.cache.find(ch => ch.name === msg.content.toLowerCase());
			};

			for (let i = 0;i < CONFIG_ITEMS.length;i++) {
				const data = CONFIG_ITEMS[i];
				if (typeof data.default === 'function') {
					const def = data.default(message.guild);
					if (typeof def !== 'undefined' && def !== null) {
						setProp(data.key, typeof def === 'string' ? def : def.id);
						continue;
					}
				}
				let type;
				let allowedResponses: string[] | '*' = ['y', 'n'];
				if (data.type === 'boolean') type = 'y/n';
				else allowedResponses = '*';
				if (data.type === 'role') type = 'role name/mention/id';
				else if (data.type === 'channel') type = 'channel mention/name/id';
				else if (data.type === 'channel_id') type = 'channel ID';
				else if (data.type.startsWith('roles-')) {
					type = `${data.type.split('-')[1]} roles seperated by a comma`;
				}
				let str = `What would you like the ${data.name} to be? (${type})\n${data.description}`;
				if (typeof data.default === 'function') {
					str += '\nA default was not found.';
				}
				if (data.optional) str += '\nType `n` if you do not want this';

				const question = await message.channel.send(str);

				const response = await Util.awaitResponse(
					message.channel as TextChannel,
					message.author,
					allowedResponses
				);
				if (!response) {
					await message.channel.bulkDelete(messages);
					return message.channel.send(
						'3 Minute response timeout, cancelling command'
					) as Promise<GuildMessage<true>>;
				}
				messages.push(question.id, response.id);

				if (data.optional && response.content.toLowerCase() === 'n') continue;

				const tryAgain = async (resp: string | string[]) => {
					const errorMessage = await message.channel.send(resp);
					messages.push(errorMessage.id);
					i--;
				};

				if (data.type === 'boolean') {
					setProp(data.key, response.content === 'y');
				} else if (data.type === 'role') {
					const role = resolveRole(response);
					if (!role) {
						await tryAgain('That is not a valid role, please try again');
						continue;
					}
					setProp(data.key, role.id);
				} else if (data.type === 'channel' || data.type === 'channel_id') {
					const channel = data.type === 'channel' ?
						resolveChannel(response) :
						this.client.channels.cache.get(response.content);
					
					if (!channel) {
						await tryAgain('That is not a valid channel, please try again');
						continue;
					}
					setProp(data.key, channel.id);
					if (data.key === 'starboard.channel_id') setProp('starboard.enabled', true);
				} else if (data.type.startsWith('roles-')) {
					const _roles = response.content.split(/ *, */g);
					const errorResponse = [
						'Please provide 4 roles seperated by a comma.',
						// eslint-disable-next-line max-len
						'in the order: Owner, Admin, Moderator, Trainee (the roles don\'t have to be named this, just the respective roles).'
					];
					if (_roles.length !== 4) {
						await tryAgain(errorResponse);
						continue;
					}
					const roles = _roles.map(idOrName => {
						const [id] = idOrName.match(MessageMentions.ROLES_PATTERN) || [];
						return message.guild.roles.cache.get(id || idOrName) || message.guild.roles.cache.find(
							role => role.name === idOrName.toLowerCase()
						);
					});
					if (roles.some(role => typeof role === 'undefined')) {
						await tryAgain(errorResponse);
						continue;
					}
					setProp(data.key, roles.map(role => role!.id));
				}
			}

			const directory = join(__dirname, '..', 'config.json');

			delete require.cache[require.resolve(directory)];
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const rawConfig: ClientConfig = require(directory);
			rawConfig.guilds.push(configData);
			await fs.writeFile(directory, JSON.stringify(rawConfig, null, 2));
			this.client.config.guilds.set(configData.id, resolveGuildConfig(this.client, configData));
			if (messages.length > 100) {
				while (messages.length > 100) {
					const msgs = messages.splice(0, 100);
					await message.channel.bulkDelete(msgs);
				}
			} else await message.channel.bulkDelete(messages);
			return send(`Added guild config for ${message.guild.name}`);
		}
	}
}
