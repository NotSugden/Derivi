import * as fs from 'fs';
import { promisify } from 'util';
import {
	Client as DJSClient,
	ClientOptions, Constants,
	Snowflake, Util as DJSUtil
} from 'discord.js';
import CommandManager from './CommandManager';
import { Defaults } from './Constants';
import DatabaseManager, { DatabaseOptions } from './DatabaseManager';
import EmojiStore from './EmojiStore';
import { Error, TypeError } from './Errors';
import WebsiteManager from './WebsiteManager';

export interface DeriviClientT {
	commands: CommandManager;
	readonly config: {
		attachmentLogging: boolean;
		attachmentsURL?: string;
		readonly encryptionPassword: string;
		emojis: EmojiStore;
		database: DatabaseOptions;
		filesDir: string;
		ownerIDs: Snowflake[];
		prefix: string[];
		reactionRoles: Map<Snowflake, {
			emojis: Map<string, Snowflake>;
			limit: number;
		}>;
		loginURL?: string;
		readonly PRODUCTION: boolean;
		xpMultiplier: number;
	};
	database: DatabaseManager;
	lockedPoints: Set<Snowflake>;
	recentlyKicked: Set<string>;
	website?: WebsiteManager;

	connect(token?: string): Promise<this>;
	disconnect(): Promise<void>;
}

export default class Client extends DJSClient {
	public commands: CommandManager;
	public readonly config!: DeriviClientT['config'];
	public database: DatabaseManager;
	public lockedPoints: Set<Snowflake>;
	public recentlyKicked: Set<string>;
	public website?: WebsiteManager;

	constructor(config: ClientConfig, options: ClientOptions) {
		super(options);
		DJSUtil.mergeDefault(Defaults.CLIENT_CONFIG, config);
		this.lockedPoints = new Set();
		this.recentlyKicked = new Set();

		this.commands = new CommandManager(this, config.commands_dir as string);

		this.token = config.token;

		Object.defineProperty(this, 'config', { value: {} });

		// this isn't validated due to the user possibly not being cached
		this.config.ownerIDs = config.owners;
		this.config.loginURL = config.login_url;
		this.config.attachmentLogging = config.attachment_logging as boolean;
		this.config.attachmentsURL = config.attachment_files_url;
		this.config.database = config.database;
		this.config.filesDir = config.files_dir as string;
		this.config.prefix = config.prefix;
		this.config.reactionRoles = new Map(config.reaction_roles.map(data => [
			data.message, {
				emojis: new Map(data.emojis.map(emojiData => [
					emojiData.id,
					emojiData.role
				])),
				limit: data.limit ?? -1
			}
		]));
		this.config.emojis = new EmojiStore(this);
		for (const { name, id } of config.emojis) {
			this.config.emojis.set(name, id);
		}

		Object.defineProperties(this.config, {
			PRODUCTION: { value: config.PRODUCTION ?? false },
			encryptionPassword: { value: config.encryption_password }
		});

		this.config.xpMultiplier = config.xp_mutliplier ?? 1;

		if (config.website?.enabled) {
			this.website = new WebsiteManager(this, config.website);
		}

		this.database = new DatabaseManager(this, config.database);
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
					await this.database.mute(true);
					await this.database.giveaway(true);
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
			this.login(token!).catch(error => {
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
		if (config.attachmentLogging) {
			const exists = await promisify(fs.exists)(this.config.filesDir);
			if (!exists) throw new Error('INVALID_CLIENT_OPTION', 'files_dir', 'directory');
		}
		for (const [name, emoji] of this.config.emojis) {
			if (emoji) continue;
			throw new TypeError('INVALID_CLIENT_OPTION', `emojis[${name}]`, 'GuildEmoji');
		}
	}
}

export interface ClientConfig {
	attachment_files_url?: string;
	attachment_logging: boolean;
	commands_dir?: string;
	encryption_password: string;
	emojis: {
		name: string;
		id: Snowflake;
	}[];
	database: DatabaseOptions;
	files_dir?: string;
	owners: Snowflake[];
	prefix: string[];
	reaction_roles: {
		limit?: number;
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
	login_url?: string;
	PRODUCTION?: boolean;
	xp_mutliplier?: number;
}