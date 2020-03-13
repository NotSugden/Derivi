import { Client as DJSClient, ClientOptions, WebhookClient, Util as DJSUtil } from 'discord.js';
import CommandManager from './CommandManager';
import { Defaults } from './Constants';
import DatabaseManager from './DatabaseManager';
export interface ClientConfig {
  commandsDir?: string;
	prefix: string;
	database?: string;
	token: string;
	webhooks: {
		name: string;
		id: string;
		token: string;
	}[];
}

export default class Client extends DJSClient {
	public commands: CommandManager;
	public config: { database: string; prefix: string };
	public database: DatabaseManager;
	public token: string;
	public webhooks = new Map<string, WebhookClient>();

	constructor(config: ClientConfig, options: ClientOptions) {
		super(options);
		DJSUtil.mergeDefault(Defaults.CLIENT_CONFIG, config);

		this.commands = new CommandManager(this, config.commandsDir as string);
		this.database = new DatabaseManager(this);

		this.token = config.token;

		for (const webhook of config.webhooks) {
			this.webhooks.set(webhook.name, new WebhookClient(webhook.id, webhook.token, this.options));
		}

		this.config = {
			database: config.database as string,
			prefix: config.prefix,
		};
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
