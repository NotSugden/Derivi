import * as fs from 'fs';
import { promisify } from 'util';
import {
	Client as DJSClient,
	ClientOptions,
	Constants,
	Util as DJSUtil,
	Snowflake,
	TextChannel,
	WebhookClient,
	Collection
} from 'discord.js';
import CommandManager from './CommandManager';
import { Defaults, Errors } from './Constants';
import DatabaseManager from './DatabaseManager';
import Mute from '../structures/Mute';
import Guild from '../structures/discord.js/Guild';

export default class Client extends DJSClient {
	public commands: CommandManager;
	public readonly config!: {
		attachmentLogging: boolean;
		readonly encryptionPassword: string;
		database: string;
		/**
		 * This *could* be null if the client is kicked out of the guild,
		 * however im not documenting that as the client isn't meant to be kicked.
		 */
		readonly defaultGuild: Guild;
		defaultGuildID: Snowflake;
		filesDir: string;
		prefix: string;
		/**
		 * This *could* be null if the client is kicked out of the guild,
		 * however im not documenting that as the client isn't meant to be kicked.
		 */
		readonly punishmentChannel: TextChannel;
		punishmentChannelID: Snowflake;
	};
	public database: DatabaseManager;
	public mutes = new Collection<Snowflake, Mute>();
	public token: string;
	public webhooks = new Map<string, WebhookClient>();

	constructor(config: ClientConfig, options: ClientOptions) {
		super(options);
		DJSUtil.mergeDefault(Defaults.CLIENT_CONFIG, config);

		const commandManager = new CommandManager(this, config.commands_dir as string);
		this.commands = commandManager;
		this.database = new DatabaseManager(this);

		this.token = config.token;

		for (const webhook of config.webhooks) {
			this.webhooks.set(webhook.name, new WebhookClient(webhook.id, webhook.token, this.options));
		}

		Object.defineProperty(this, 'config', { value: {
			attachmentLogging: config.attachment_logging as boolean,
			database: config.database as string,
			get defaultGuild() {
				return commandManager.client.guilds.resolve(this.defaultGuildID);
			},
			defaultGuildID: config.default_guild,
			filesDir: config.files_dir as string,
			prefix: config.prefix,
			get punishmentChannel() {
				return commandManager.client.channels.resolve(this.punishmentChannelID);
			},
			punishmentChannelID: config.punishment_channel
		} });
		Object.defineProperty(this.config, 'encryptionPassword', {
			value: config.encryption_password
		});
	}

	public async connect(token = this.token) {
		try {
			await this.database.open();
			await this.commands.loadAll();
			const mutes = await this.database.mute(true);
			for (const mute of mutes) {
				this.mutes.set(mute.userID, mute);
			}
		} catch (error) {
			await this.database.close().catch(console.error);
		}
		return new Promise<this>((resolve, reject) => {
			const handler = async () => {
				try {
					await this._validateConfig();
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
				.then(() => resolve(this))
				.catch(error => {
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
			if (!exists) throw new Error(Errors.INVALID_CLIENT_OPTION('files_dir', 'directory'));
		}
		if (!(config.defaultGuild instanceof Guild)) {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('default_guild', 'Guild'));
		}
		if (config.punishmentChannel && config.punishmentChannel.type !== 'text') {
			throw new TypeError(Errors.INVALID_CLIENT_OPTION('punishment_channel', 'TextChannel'));
		}
	}
}

export interface ClientConfig {
	attachment_logging: boolean;
	commands_dir?: string;
	encryption_password: string;
	database?: string;
	default_guild: Snowflake;
	files_dir?: string;
	prefix: string;
	punishment_channel: Snowflake;
	token: string;
	webhooks: {
		name: string;
		id: Snowflake;
		token: string;
	}[];
}