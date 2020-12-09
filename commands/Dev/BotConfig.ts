import {
	Permissions, PermissionOverwrites,
	OverwriteResolvable, CategoryChannel,
	MessageMentions, Guild,
	GuildChannelManager, TextChannel,
	DataResolver, Role
} from 'discord.js';
import Command, { CommandData, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import { RawGuildConfig } from '../../structures/GuildConfig';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { SQLValues, QueryTypes } from '../../util/DatabaseManager';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

enum ConfigModes {
	SETUP = 'setup'
}

const keys = Object.values(ConfigModes);

export const CONFIG_ITEMS = [{
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
	description: 'The Staff Server ID.',
	key: 'staff-server',
	name: 'Staff Server ID',
	type: 'guild_id'
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
	key: 'starboard_channel_id',
	name: 'Starboard Channel',
	optional: true,
	type: 'channel'
}, {
	default: (guild: Guild) => guild.channels.cache.find(ch => ch.name === 'general'),
	description: 'The general channel.',
	key: 'general_channel',
	name: 'General Channel',
	type: 'channel'
}, {
	default: (guild: Guild) => guild.channels.cache.find(ch => ch.name === 'lockdown'),
	description: 'The channel everyone sees when the server is in lockdown.',
	key: 'lockdown_channel',
	name: 'Lockdown Channel',
	optional: true,
	type: 'channel'
}] as ConfigItem[];

const normalize = (str: string) =>
	str.replace(/_(.)/, (str, match) => match.toUpperCase());
for (const obj of CONFIG_ITEMS) {
	obj.normalizedKey = normalize(obj.key);
}
// <3 milk
export default class BotConfig extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: CommandCategory.DEV,
			cooldown: 0,
			examples: [
				'setup'
			],
			name: 'botconfig',
			permissions: member => member.client.config.ownerIDs.includes(member.id)
		}, __filename);
	}

	static async createChannels(message: GuildMessage<true>, guild: Guild) {
		const values = {} as {
			audit_logs_webhook: string;
			member_logs_webhook: string;
			invite_logs_webhook: string;
			staff_server_category: string;
			staff_commands_channel: string;
			punishment_channel: string;
		};
		const messages = [(await message.channel.send('Creating channels... please wait.')).id];
		let staffMember = guild.roles.cache.find(role => role.name.toLowerCase() === 'staff member');
		if (!staffMember) {
			staffMember = await guild.roles.create({ data: {
				name: 'Staff Member', permissions: 0
			}, reason: 'Staff Member Role' });
		}
		let serverRole = guild.roles.cache.find(
			role => role.name.toLowerCase() === guild.name.toLowerCase()
		);
		if (!serverRole) {
			serverRole = await guild.roles.create({ data: {
				name: message.guild.name, permissions: 0
			}, reason: `Server Role for ${message.guild.name}` });
		}
		const permissionOverwrites = ([{
			deny: Permissions.FLAGS.VIEW_CHANNEL,
			id: staffMember.id,
			type: 'role'
		}, {
			allow: Permissions.FLAGS.VIEW_CHANNEL,
			id: serverRole.id,
			type: 'role'
		}] as OverwriteResolvable[]).map(o => PermissionOverwrites.resolve(o, guild));
		const category = await guild.channels.create(message.guild.name, {
			permissionOverwrites, type: 'category'
		});
		// tfw GuildChannelCreateOptions isn't exported
		const options: Parameters<GuildChannelManager['create']>[1] = {
			parent: category,
			permissionOverwrites,
			reason: `Config setup by ${message.author.tag}`,
			type: 'text'
		};
		const [cases, commands, logsCategory] = await Promise.all([
			guild.channels.create('cases', options),
			guild.channels.create('commands', options),
			guild.channels.create(`${message.guild.name}-LOGS`, {
				permissionOverwrites, type: 'category'
			})
		]) as [TextChannel, TextChannel, CategoryChannel];
		options.parent = logsCategory;
		const logChannels = await Promise.all([
			guild.channels.create('audit-logs', options),
			guild.channels.create('member-logs', options),
			guild.channels.create('invite-logs', options)
		]) as [TextChannel, TextChannel, TextChannel];
		const webhookOptions: { avatar?: string } = {};
		if (message.guild.icon) {
			webhookOptions.avatar = await DataResolver.resolveImage(message.guild.iconURL()!);
		}
		for (let i = 0; i < logChannels.length; i++) {
			const logChannel = logChannels[i];
			const webhook = await logChannel.createWebhook(logChannel.name, webhookOptions);
			let hookName: 'audit_logs' | 'member_logs' | 'invite_logs';
			if (i === 0) hookName = 'audit_logs';
			else if (i === 1) hookName = 'member_logs';
			else hookName = 'invite_logs';
			values[`${hookName}_webhook` as keyof typeof values] = `${webhook.id}:${webhook.token}`;
		}
		values['staff_server_category'] = category.id;
		values['staff_commands_channel'] = commands.id;
		values['punishment_channel'] = cases.id;
		messages.push((await message.channel.send('Finished creating channels')).id);
		return { data: values, messages };
	}

	static async resolveValue(
		data: ConfigItem, response: GuildMessage<true>,
		options: { createChannels: true; string?: string }
	): Promise<string | { values: SQLValues; messages: string[] }>;
	static async resolveValue(
		data: ConfigItem, response: GuildMessage<true>,
		options: { createChannels?: false; string?: string }
	): Promise<string | { values: SQLValues; messages: null }>;
	static async resolveValue(
		data: ConfigItem, response: GuildMessage<true>,
		options: { createChannels?: boolean; string?: string } = {}
	) {
		const { createChannels = false, string = response.content } = options;
		const values: SQLValues = {};
		let messages: string[] | null = null;
		if (data.type === 'boolean') {
			values[data.key] = ['y', 'enabled', 'yes'].includes(string) ? 1 : 0;
		} else if (data.type === 'role') {
			const role = Util.resolveRole(response, string);
			if (!role) {
				return 'That is not a valid role, please try again';
			}
			values[data.key] = role.id;
		} else if (data.type === 'channel' || data.type === 'channel_id') {
			const channel = data.type === 'channel' ?
				Util.resolveChannel(response, string) :
				response.client.channels.cache.get(string);

			if (!channel) {
				return 'That is not a valid channel, please try again';
			}
			values[data.key] = channel.id;
			if (data.key === 'starboard_channel_id') {
				values['starboard_enabled'] = 1;
				if (!response.guild.config?.starboard.minimum) {
					values['starboard_minimum'] = 3;
				}
			}
		} else if (data.type === 'guild_id') {
			const guild = response.client.guilds.cache.get(string);

			if (!guild) {
				return 'That is not a valid guild ID, please try again';
			}
			if (data.key === 'staff-server' && createChannels) {
				const { data: _data, messages: _messages } = await this.createChannels(response, guild);
				Object.assign(values, _data);
				messages = _messages;
			}
		} else if (data.type.startsWith('roles-')) {
			const _roles = string.toLowerCase().split(/ *, * /g);
			let errorResponse = 'Please provide 4 roles seperated by a comma.';
			if (data.key === 'access_level_roles') {
				// eslint-disable-next-line max-len
				errorResponse += '\nin the order: Owner, Admin, Moderator, Trainee (the roles don\'t have to be named this, just the respective roles).';
			}
			if (_roles.length !== 4) {
				return errorResponse;
			}
			const roles = _roles.map(idOrName => {
				const [id] = idOrName.match(MessageMentions.ROLES_PATTERN) || [];
				return Util.resolveRole(response, id || idOrName);
			});
			if (roles.some(role => !(role instanceof Role))) {
				return errorResponse;
			}
			values[data.key] = JSON.stringify(roles.map(role => role!.id));
		}
		return { messages, values };
	}

	static resolveTypes(data: ConfigItem, foundDefault = false) {
		let type;
		let allowedResponses: string[] | '*' = ['y', 'n'];
		if (data.type === 'boolean') type = 'y/n';
		else allowedResponses = '*';
		if (data.type === 'role') type = 'role name/mention/id';
		else if (data.type === 'channel') type = 'channel mention/name/id';
		else if (data.type === 'guild_id') type = 'Guild ID';
		else if (data.type === 'channel_id') type = 'channel ID';
		else if (data.type.startsWith('roles-')) {
			type = `${data.type.split('-')[1]} roles seperated by a comma`;
		}
		let fullString = `What would you like the ${data.name} to be? (${type})\n${data.description}`;
		if (foundDefault) {
			fullString += '\nA default was not found.';
		}
		if (data.optional) fullString += '\nType `n` if you do not want this';
		return { allowedResponses, fullString, type };
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const mode = args[0];
		if (mode === ConfigModes.SETUP) {
			if (message.editedTimestamp) return send('This command does not support being edited.');
			const existing = await message.guild.fetchConfig();
			if (existing) {
				return message.channel.send(
					'Configuration is already setup for this guild'
				) as Promise<GuildMessage<true>>;
			}

			const values: SQLValues = {};

			const messages = [];
			for (let i = 0; i < CONFIG_ITEMS.length; i++) {
				const data = CONFIG_ITEMS[i];
				if (typeof data.default === 'function') {
					const def = data.default(message.guild);
					if (typeof def !== 'undefined' && def !== null) {
						values[data.key] = typeof def === 'string' ? def : def.id;
						if (data.key === 'starboard_channel_id') {
							values['starboard_enabled'] = 1;
							values['starboard_minimum'] = 3;
						}
						continue;
					}
				}
				const { allowedResponses, fullString } = BotConfig.resolveTypes(
					data, typeof data.default === 'function'
				);

				const question = await message.channel.send(fullString);

				const response = await Util.awaitResponse(
					message.channel,
					message.author,
					allowedResponses
				);
				if (!response) {
					await Util.bulkDelete(message.channel, messages, false);
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

				const result = await BotConfig.resolveValue(data, response, {
					createChannels: true
				});
				if (typeof result === 'string') {
					await tryAgain(result);
					continue;
				}
				Object.assign(values, result.values);
				if (result.messages !== null) messages.push(...result.messages);
			}

			await this.client.database.query(QueryTypes.INSERT, 'settings', values);
			
			await Util.bulkDelete(message.channel, messages, false);
			return send(`Added guild config for ${message.guild.name}`);
		}
		throw new CommandError('INVALID_MODE', keys);
	}
}


interface ConfigItem {
	default?: (guild: Guild) => (string | { id: string });
	description: string;
	key: keyof RawGuildConfig | 'staff-server';
	normalizedKey: string;
	name: string;
	optional?: boolean;
	type: string;
}