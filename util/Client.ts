import { Client as DJSClient, ClientOptions, WebhookClient, Util as DJSUtil, Snowflake } from 'discord.js';
import CommandManager from './CommandManager';
import { Defaults } from './Constants';
import DatabaseManager from './DatabaseManager';
import Guild from '../structures/discord.js/Guild';

export interface ClientConfig {
	attachment_logging: boolean;
	commands_dir?: string;
	encryption_password: string;
	database?: string;
	default_guild: Snowflake;
	files_dir?: string;
	prefix: string;
	token: string;
	webhooks: {
		name: string;
		id: Snowflake;
		token: string;
	}[];
}

export default class Client extends DJSClient {
	public commands: CommandManager;
	public config!: {
		attachmentLogging: boolean;
		encryptionPassword: string;
		database: string;
		defaultGuild: Guild;
		defaultGuildID: Snowflake;
		filesDir: string;
		prefix: string;
	};
	public database: DatabaseManager;
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
				return commandManager.client.guilds.cache.get(this.defaultGuildID) as Guild | null;
			},
			defaultGuildID: config.default_guild,
			filesDir: config.files_dir as string,
			prefix: config.prefix,
		} });
		Object.defineProperty(this.config, 'encryptionPassword', {
			value: config.encryption_password,
		});
	}

	public connect(token = this.token) {
		return new Promise<this>((resolve, reject) =>
			this.database.open().then(() =>
				this.commands.loadAll().then(() => {
					const handler = () => resolve(this);
					this.once('ready', handler);
					this.login(token).catch(error => {
						this.off('ready', handler);
						reject(error);
					});
				}),
			).catch(reject),
		);
	}
}
