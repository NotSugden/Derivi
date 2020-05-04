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
	/**
	 * The configured channels here could be null, however they aren't supposed to be
	 */
	public readonly config!: {
		allowedLevelingChannels: Snowflake[];
		attachmentLogging: boolean;
		attachmentsURL?: string;
		readonly encryptionPassword: string;
		database: string;
		readonly defaultGuild: Guild;
		defaultGuildID: Snowflake;
		filesDir: string;
		partnershipChannels: Map<Snowflake, {
			minimum: number;
			maximum: number;
			points: number;
		}>;
		prefix: string[];
		reactionRoles: Map<Snowflake, Map<string, Snowflake>>;
		reportsRegex: RegExp[];
		shopItems: ShopItems;
		readonly partnerRewardsChannel: TextChannel;
		partnerRewardsChannelID: Snowflake;
		readonly punishmentChannel: TextChannel;
		punishmentChannelID: Snowflake;
		readonly reportsChannel: TextChannel;
		reportsChannelID: Snowflake;
		readonly rulesChannel: TextChannel;
		rulesChannelID: Snowflake;
		readonly staffCommandsChannel: TextChannel;
		staffCommandsChannelID: Snowflake;
	};
	public database: DatabaseManager;
	public lockedPoints = new Set<Snowflake>();
	public mutes = new Collection<Snowflake, Mute>();
	public token: string;
	public webhooks = new Map<string, WebhookClient>();
	public website?: WebsiteManager;

	constructor(config: ClientConfig, options: ClientOptions) {
		super(options);
		DJSUtil.mergeDefault(Defaults.CLIENT_CONFIG, config);

		const commandManager = this.commands = new CommandManager(this, config.commands_dir as string);
		this.database = new DatabaseManager(this, config.database);

		this.token = config.token;

		for (const webhook of config.webhooks) {
			this.webhooks.set(webhook.name, new WebhookClient(webhook.id, webhook.token, this.options));
		}

		Object.defineProperty(this, 'config', { value: {
			allowedLevelingChannels: config.allowed_level_channels,
			attachmentLogging: config.attachment_logging as boolean,
			attachmentsURL: config.attachment_files_url,
			database: config.database as string,
			get defaultGuild() {
				return commandManager.client.guilds.resolve(this.defaultGuildID);
			},
			defaultGuildID: config.default_guild,
			filesDir: config.files_dir as string,
			get partnerRewardsChannel() {
				return commandManager.client.channels.resolve(this.partnerRewardsChannelID);
			},
			partnerRewardsChannelID: config.partner_rewards_channel,
			partnershipChannels: new Map(config.partnership_channels.map(data => [
				data.id, {
					maximum: data.maximum ?? Infinity,
					minimum: data.minimum,
					points: data.points
				}
			])),
			prefix: config.prefix,
			get punishmentChannel() {
				return commandManager.client.channels.resolve(this.punishmentChannelID);
			},
			punishmentChannelID: config.punishment_channel,
			reactionRoles: new Map(config.reaction_roles.map(data => [
				data.message,
				new Map(data.emojis.map(emojiData => [
					emojiData.id,
					emojiData.role
				]))
			])),
			get reportsChannel() {
				return commandManager.client.channels.resolve(this.reportsChannelID);
			},
			reportsChannelID: config.reports_channel,
			reportsRegex: config.report_regex.map(str => new RegExp(str, 'i')),
			get rulesChannel() {
				return commandManager.client.channels.resolve(this.rulesChannelID);
			},
			rulesChannelID: config.rules_channel,
			shopItems: config.shop_items,
			get staffCommandsChannel() {
				return commandManager.client.channels.resolve(this.staffCommandsChannelID);
			},
			staffCommandsChannelID: config.staff_commands_channel
		} as Client['config'] });
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
			this.login(token)
				.then(() => {
					if (!this.website) return;
					return this.website.spawn();
				}).catch(error => {
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
					`allowed_level_channels[${channelID}]`,
					'TextChannel'
				));
			}
		}
		if (config.attachmentLogging) {
			const exists = await promisify(fs.exists)(this.config.filesDir);
			if (!exists) throw new Error(Errors.INVALID_CLIENT_OPTION('files_dir', 'directory'));
		}
		if (!(config.defaultGuild instanceof Guild)) {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('default_guild', 'Guild'));
		}
		if (config.punishmentChannel?.type !== 'text') {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('punishment_channel', 'TextChannel'));
		}
		if (config.rulesChannel?.type !== 'text') {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('rules_channel', 'TextChannel'));
		}
		if (config.staffCommandsChannel?.type !== 'text') {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('staff_commands_channel', 'TextChannel'));
		}
		if (config.reportsChannel?.type !== 'text') {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('reports_channel', 'TextChannel'));
		}
		if (config.partnerRewardsChannel?.type !== 'text') {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('partner_rewards_channel', 'TextChannel'));
		}

		for (const channelID of this.config.partnershipChannels.keys()) {
			const channel = this.channels.resolve(channelID);
			if (channel?.type !== 'text') {
				throw new TypeError(Errors.INVALID_CLIENT_OPTION(`partnership_channels[${channelID}]`, 'TextChannel'));
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
	database: mysql.ConnectionConfig;
	default_guild: Snowflake;
	files_dir?: string;
	prefix: string[];
	partner_rewards_channel: Snowflake;
	partnership_channels: {
		id: Snowflake;
		minimum: number;
		maximum: number | null;
		points: number;
	}[];
	punishment_channel: Snowflake;
	reaction_roles: {
		message: Snowflake;
		emojis: {
			id: Snowflake;
			role: Snowflake;
		}[];
	}[];
	reports_channel: Snowflake;
	report_regex: string[];
	rules_channel: Snowflake;
	staff_commands_channel: Snowflake;
	shop_items: ShopItems;
	token: string;
	webhooks: {
		name: string;
		id: Snowflake;
		token: string;
	}[];
	website?: {
		enabled: boolean;
		filename: string;
		directory: string;
	};
}

export type ShopItems = {
	action: 'give_role';
	cost: number;
	role_id: Snowflake;
}[]
// at some point later on more actions would be added to this