import { MessageMentions, Guild } from 'discord.js';
import { GuildChannelManager } from 'discord.js';
import { TextChannel } from 'discord.js';
import { DataResolver } from 'discord.js';
import { Role } from 'discord.js';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandError from '../util/CommandError';
import CommandManager from '../util/CommandManager';
import { SQLValues, QueryTypes } from '../util/DatabaseManager';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

enum ConfigModes {
	SETUP = 'setup'
}

const keys = Object.values(ConfigModes);

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
}];
// <3 milk
export default class BotConfig extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Dev',
			cooldown: 0,
			examples: [
				'setup'
			],
			name: 'botconfig',
			permissions: member => member.client.config.ownerIDs.includes(member.id)
		}, __filename);
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

			const resolveRole = (msg: GuildMessage<true>) => {
				return msg.mentions.roles.first()
					|| msg.guild.roles.cache.get(msg.content)
					|| msg.guild.roles.cache.find(role => role.name.toLowerCase() === msg.content.toLowerCase());
			};

			const resolveChannel = (msg: GuildMessage<true>) => {
				return msg.mentions.channels.first()
					|| msg.guild.channels.cache.get(msg.content)
					|| msg.guild.channels.cache.find(ch => ch.name.toLowerCase() === msg.content.toLowerCase());
			};
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
				let str = `What would you like the ${data.name} to be? (${type})\n${data.description}`;
				if (typeof data.default === 'function') {
					str += '\nA default was not found.';
				}
				if (data.optional) str += '\nType `n` if you do not want this';

				const question = await message.channel.send(str);

				const response = await Util.awaitResponse(
					message.channel,
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
					values[data.key] = response.content === 'y' ? 1 : 0;
				} else if (data.type === 'role') {
					const role = resolveRole(response);
					if (!role) {
						await tryAgain('That is not a valid role, please try again');
						continue;
					}
					values[data.key] = role.id;
				} else if (data.type === 'channel' || data.type === 'channel_id') {
					const channel = data.type === 'channel' ?
						resolveChannel(response) :
						this.client.channels.cache.get(response.content);

					if (!channel) {
						await tryAgain('That is not a valid channel, please try again');
						continue;
					}
					values[data.key] = channel.id;
					if (data.key === 'starboard_channel_id') {
						values['starboard_enabled'] = 1;
						values['starboard_minimum'] = 3;
					}
				} else if (data.type === 'guild_id') {
					const guild = this.client.guilds.cache.get(response.content);

					if (!guild) {
						await tryAgain('That is not a valid guild ID, please try again');
						continue;
					}
					if (data.key === 'staff-server') {
						messages.push((await message.channel.send('Creating channels... please wait.')).id);
						const category = await guild.channels.create(message.guild.id, {
							type: 'category'
						});
						// tfw GuildChannelCreateOptions isn't exported
						const options: Parameters<GuildChannelManager['create']>[1] = {
							parent: category,
							type: 'text'
						};
						const cases = await guild.channels.create('cases', options);
						const commands = await guild.channels.create('commands', options);
						const logsCategory = await guild.channels.create(`${message.guild.id}-LOGS`, {
							type: 'category'
						});
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
							values[`${hookName}_webhook`] = `${webhook.id}:${webhook.token}`;
						}
						values['staff_server_category'] = category.id;
						values['staff_commands_channel'] = commands.id;
						values['punishment_channel'] = cases.id;
						messages.push((await message.channel.send('Finished creating channels')).id);
					}
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
							role => role.name.toLowerCase() === idOrName.toLowerCase()
						);
					});
					if (roles.some(role => !(role instanceof Role))) {
						await tryAgain(errorResponse);
						continue;
					}
					values[data.key] = JSON.stringify(roles.map(role => role!.id));
				}
			}

			await this.client.database.query(QueryTypes.INSERT, 'settings', values);
			
			if (messages.length > 100) {
				while (messages.length > 100) {
					const msgs = messages.splice(0, 100);
					await message.channel.bulkDelete(msgs);
				}
			} else await message.channel.bulkDelete(messages);
			return send(`Added guild config for ${message.guild.name}`);
		}
		throw new CommandError('INVALID_MODE', keys);
	}
}
