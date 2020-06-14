import * as fs from 'fs';
import { promisify } from 'util';
import {
	Client as DJSClient,
	ClientOptions,
	Constants,
	Util as DJSUtil,
	Snowflake,
	WebhookClient,
	Collection,
	ClientEvents,
	MessageReaction
} from 'discord.js';
import * as mysql from 'mysql';
import CommandManager from './CommandManager';
import { Defaults, Errors } from './Constants';
import DatabaseManager from './DatabaseManager';
import EmojiStore from './EmojiStore';
import { Invite, PartialMessage } from './Types';
import WebsiteManager from './WebsiteManager';
import Mute from '../structures/Mute';
import DMChannel from '../structures/discord.js/DMChannel';
import Guild from '../structures/discord.js/Guild';
import GuildMember from '../structures/discord.js/GuildMember';
import ASCMessage from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import User from '../structures/discord.js/User';

type Message = ASCMessage & {
	channel: Exclude<ASCMessage['channel'], DMChannel>;
	guild: Guild;
	member: GuildMember;
} | ASCMessage & {
	channel: DMChannel;
	guild: null;
	member: null;
}

export interface Events extends ClientEvents {
	guildBanAdd: [Guild, User];
	guildBanRemove: [Guild, User];
	guildMemberAdd: [GuildMember];
	guildMemberRemove: [GuildMember];
	guildMemberUpdate: [GuildMember, GuildMember];
	inviteCreate: [Invite];
	inviteDelete: [Invite];
	message: [Message];
	messageDelete: [Message | PartialMessage];
	messageReactionRemoveAll: [Message | PartialMessage];
	messageReactionRemoveEmoji: [MessageReaction & { message: Message }];
	messageDeleteBulk: [Collection<Snowflake, Message | PartialMessage>];
	messageReactionAdd: [MessageReaction & { message: Message }, User];
	messageReactionRemove: [MessageReaction & { message: Message }, User];
	messageUpdate: [Message | PartialMessage, Message | PartialMessage];
}

export default class Client extends DJSClient {
	public commands: CommandManager;
	public readonly config!: {
		allowedLevelingChannels: Snowflake[];
		attachmentLogging: boolean;
		attachmentsURL?: string;
    readonly encryptionPassword: string;
    emojis: EmojiStore;
		database: mysql.ConnectionConfig;
		filesDir: string;
		prefix: string[];
    reactionRoles: Map<Snowflake, Map<string, Snowflake>>;
    guilds: Map<Snowflake, GuildConfig>;
    loginURL?: string;
    mfaModeration: boolean;
	};
	public database: DatabaseManager;
	public lockedPoints = new Set<Snowflake>();
	public mutes = new Collection<Snowflake, Mute>();
	public token: string;
	public website?: WebsiteManager;

	constructor(config: ClientConfig, options: ClientOptions) {
		super(options);
		DJSUtil.mergeDefault(Defaults.CLIENT_CONFIG, config);

		this.commands = new CommandManager(this, config.commands_dir as string);
		this.database = new DatabaseManager(this, config.database);

		this.token = config.token;
    
		Object.defineProperty(this, 'config', { value: {} });

		this.config.loginURL = config.login_url;
		this.config.mfaModeration = config.mfa_moderation ?? false;
		this.config.allowedLevelingChannels = config.allowed_level_channels,
		this.config.attachmentLogging = config.attachment_logging as boolean,
		this.config.attachmentsURL = config.attachment_files_url,
		this.config.database = config.database,
		this.config.filesDir = config.files_dir as string,
		this.config.prefix = config.prefix,
		this.config.reactionRoles = new Map(config.reaction_roles.map(data => [
			data.message,
			new Map(data.emojis.map(emojiData => [
				emojiData.id,
				emojiData.role
			]))
		]));
		this.config.emojis = new EmojiStore(this);
		for (const { name, id } of config.emojis) {
			this.config.emojis.set(name, id);
		}
		this.config.guilds = new Map();
		for (const rawConfig of config.guilds) {
			const guildConfig: GuildConfig = {
				accessLevelRoles: rawConfig.access_level_roles,
				casesChannelID: rawConfig.punishment_channel,
				filePermissionsRole: rawConfig.file_permissions_role || null,
				generalChannelID: rawConfig.general_channel,
				id: rawConfig.id,
				levelRoles: rawConfig.level_roles || null,
				partnerships: {
					channels: new Map(rawConfig.partnership_channels.map(data => [
						data.id, {
							id: data.id,
							maximum: data.maximum ?? Infinity,
							minimum: data.minimum,
							points: data.points
						}
					])), rewardsChannelID: rawConfig.partner_rewards_channel
				},
				reportsChannelID: rawConfig.reports_channel,
				reportsRegex: rawConfig.report_regex.map(string => new RegExp(string, 'i')),
				rulesChannelID: rawConfig.rules_channel,
				rulesMessageID: rawConfig.rules_message || null,
				shopItems: rawConfig.shop_items,
				staffCommandsChannelID: rawConfig.staff_commands_channel,
				staffServerCategoryID: rawConfig.staff_server_category,
				starboard: rawConfig.starboard?.enabled ? {
					channelID: rawConfig.starboard.channel_id,
					minimum: rawConfig.starboard.minimum,
					reactionOnly: rawConfig.starboard.reaction_only
				} : null,
				webhooks: new Map(rawConfig.webhooks.map(hook => [
					hook.name, new WebhookClient(hook.id, hook.token, options)
				])),
				welcomeRoleID: rawConfig.welcome_role || null
			};
			
			this.config.guilds.set(rawConfig.id, guildConfig);
		}
    
		Object.defineProperty(this.config, 'encryptionPassword', {
			value: config.encryption_password
		});

		if (config.website?.enabled) {
			this.website = new WebsiteManager(this, config.website);
		}
	}

	public on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
		return super.on(event, listener as (...args: ClientEvents[K]) => void);
	}

	public async connect(token = this.token) {
		try {
			await this.database.open();
			await this.commands.loadAll();
		} catch (error) {
			console.error(error);
			await this.database.close().catch(console.error);
			throw error;
		}
		return new Promise<this>((resolve, reject) => {
			const handler = async () => {
				try {
					await DJSUtil.delayFor(2500);
					await this._validateConfig();
					if (this.website && !this.website.process) await this.website.spawn();
					const mutes = await this.database.mute(true);
					for (const mute of mutes) {
						this.mutes.set(mute.userID, mute);
					}
					resolve(this);
				} catch (error) {
					this.disconnect()
						.then(() => reject(error))
						.catch(err => {
							console.error(err);
							reject(error);
						});
				}
			};
			this.once(Constants.Events.CLIENT_READY, handler);
			this.login(token).catch(error => {
				this.off(Constants.Events.CLIENT_READY, handler);
				this.disconnect()
					.then(() => reject(error))
					.catch(err => {
						console.error(err);
						reject(error);
					});
			});
		});
	}

	public async disconnect() {
		await this.database.close();
		this.commands.clear();
		return this.destroy();
	}

	private async _validateConfig() {
		if (this.ws.status !== Constants.Status.READY) {
			this.emit(
				'warn',
				'Unable to validate configuration as \'_validateConfig\' was called before the client was ready'
			);
			return;
		}
		const { config } = this;
		for (const channelID of config.allowedLevelingChannels) {
			const ch = this.channels.resolve(channelID);
			if (ch?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`allowed_level_channels[${channelID}]`, 'TextChannel'
				));
			}
		}
		if (config.attachmentLogging) {
			const exists = await promisify(fs.exists)(this.config.filesDir);
			if (!exists) throw new Error(Errors.INVALID_CLIENT_OPTION('files_dir', 'directory'));
		}
		for (const [name, emoji] of this.config.emojis) {
			if (emoji) continue;
			throw new TypeError(Errors.INVALID_CLIENT_OPTION(
				`emojis[${name}]`, 'GuildEmoji'
			));
		}
		const resolve = (id: Snowflake) => this.channels.resolve(id);
		for (const guildConfig of config.guilds.values()) {
			const guild = this.guilds.resolve(guildConfig.id);
			if (!guild) {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].id`, 'Guild'
				));
			}
			for (const roleID of guildConfig.accessLevelRoles) {
				if (!guild.roles.cache.has(roleID)) {
					throw new TypeError(Errors.INVALID_CLIENT_OPTION(
						`guilds[${guildConfig.id}].access_level_roles[${roleID}]`, 'Role'
					));
				}
			}
			if (resolve(guildConfig.casesChannelID)?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].punishment_channel`, 'TextChannel'
				));
			}
			if (guildConfig.filePermissionsRole && !guild.roles.cache.has(guildConfig.filePermissionsRole)) {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].filePermissionsRole`, 'Role'
				));
			}
			if (resolve(guildConfig.generalChannelID)?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].general_channel`, 'TextChannel'
				));
			}
			for (const { id } of guildConfig.levelRoles || []) {
				if (!guild.roles.cache.has(id)) {
					throw new TypeError(Errors.INVALID_CLIENT_OPTION(
						`guilds[${guildConfig.id}].level_roles[${id}]`, 'Role'
					));
				}
			}
			if (resolve(guildConfig.partnerships.rewardsChannelID)?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].partner_rewards_channel`, 'TextChannel'
				));
			}
			for (const channelID of guildConfig.partnerships.channels.keys()) {
				if (resolve(channelID)?.type !== 'text') {
					throw new TypeError(Errors.INVALID_CLIENT_OPTION(
						`guilds[${guildConfig.id}]partnership_channels[${channelID}]`, 'TextChannel'
					));
				}
			}
			if (resolve(guildConfig.reportsChannelID)?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].reports_channel`, 'TextChannel'
				));
			}
			const rulesChannel = resolve(guildConfig.rulesChannelID) as TextChannel | null;
			if (rulesChannel?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].rules_channel`, 'TextChannel'
				));
			}
			if (guildConfig.rulesMessageID) {
				try {
					await rulesChannel.messages.fetch(guildConfig.rulesMessageID, false);
				} catch {
					throw new TypeError(Errors.INVALID_CLIENT_OPTION(
						`guilds[${guildConfig.id}].rules_message`, 'Message'
					));
				}
			}
			if (resolve(guildConfig.staffCommandsChannelID)?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].staff_commands_channel`, 'TextChannel'
				));
			}
			if (resolve(guildConfig.staffServerCategoryID)?.type !== 'category') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].staff_server_category`, 'CategoryChannel'
				));
			}
			if (guildConfig.starboard) {
				if (resolve(guildConfig.starboard.channelID)?.type !== 'text') {
					throw new TypeError(Errors.INVALID_CLIENT_OPTION(
						`guilds[${guildConfig.id}].starboard.channel`, 'TextChannel'
					));
				}
			}
			if (guildConfig.welcomeRoleID && !guild.roles.cache.has(guildConfig.welcomeRoleID)) {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(
					`guilds[${guildConfig.id}].welcome_role`, 'Role'
				));
			}
		}
	}
}

export interface ClientConfig {
	allowed_level_channels: Snowflake[];
	attachment_files_url?: string;
	attachment_logging: boolean;
	commands_dir?: string;
  encryption_password: string;
  emojis: {
    name: string;
    id: Snowflake;
  }[];
	database: mysql.ConnectionConfig;
	files_dir?: string;
	prefix: string[];
	reaction_roles: {
		message: Snowflake;
		emojis: {
			id: Snowflake;
			role: Snowflake;
		}[];
	}[];
	token: string;
	website?: {
		enabled: boolean;
		filename: string;
		directory: string;
	};
  guilds: RawGuildConfig[];
  login_url?: string;
  mfa_moderation?: boolean;
}

export type GuildConfig = {
  accessLevelRoles: [
    Snowflake,
    Snowflake,
    Snowflake,
    Snowflake
  ];
  id: Snowflake;
  partnerships: {
    rewardsChannelID: Snowflake;
    channels: Map<string, {
      id: Snowflake;
      minimum: number;
      maximum: number;
      points: number;
    }>;
  };
  staffServerCategoryID: Snowflake;
  generalChannelID: Snowflake;
  filePermissionsRole: Snowflake | null;
  welcomeRoleID: Snowflake | null;
  casesChannelID: Snowflake;
  reportsChannelID: Snowflake;
  rulesChannelID: Snowflake;
  rulesMessageID: Snowflake | null;
  staffCommandsChannelID: Snowflake;
  reportsRegex: RegExp[];
  shopItems: ShopItem[];
  levelRoles: {
    level: number;
    id: Snowflake;
  }[] | null;
  webhooks: Map<string, WebhookClient>;
  starboard: {
    channelID: Snowflake;
    minimum: number;
    reactionOnly: boolean;
  } | null;
}

export type RawGuildConfig = {
  general_channel: Snowflake;
  access_level_roles: [
    Snowflake,
    Snowflake,
    Snowflake,
    Snowflake
  ];
  staff_server_category: Snowflake;
  id: Snowflake;
  welcome_role?: Snowflake;
  file_permissions_role?: Snowflake;
  partner_rewards_channel: Snowflake;
  partnership_channels: {
    id: Snowflake;
    minimum: number;
    maximum: number | null;
    points: number;
  }[];
  punishment_channel: Snowflake;
  reports_channel: Snowflake;
  report_regex: string[];
  rules_channel: Snowflake;
  rules_message?: Snowflake;
  staff_commands_channel: Snowflake;
  shop_items: ShopItem[];
  level_roles?: {
    level: number;
    id: Snowflake;
  }[];
  webhooks: {
    name: string;
    id: Snowflake;
    token: string;
  }[];
  starboard?: {
    enabled: boolean;
    channel_id: Snowflake;
    minimum: number;
    reaction_only: boolean;
  };
}

export type ShopItem = {
	action: 'give_role';
	cost: number;
	role_id: Snowflake;
};
// at some point later on more actions would be added to this