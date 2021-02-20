import { ChildProcess, fork } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import { APIInteraction } from 'discord-api-types/v8';
import { Client, MessageEmbedOptions, Snowflake, Util as DJSUtil } from 'discord.js';
import handlers from './handlers';

export default class WebsiteManager extends EventEmitter {
	public client!: Client;
	public filename: string;
	public directory: string;
	public process?: ChildProcess;
	constructor(client: Client, options: { filename: string; directory: string }) {
		super();
		Object.defineProperty(this, 'client', { value: client });
		this.filename = options.filename;
		this.directory = options.directory;
	}

	spawn() {
		if (this.process) this.process.kill();
		const childProcess = this.process = fork(
			path.resolve(path.join(this.directory, this.filename)), [], {
				cwd: path.resolve(this.directory), env: Object.assign(
					{}, process.env, {
						CLIENT_CONFIG: this.client.config,
						CLIENT_TOKEN: this.client.token
					}
				)
			}
		).on('message', async message => {
			try {
				await this._handleMessage(message as ProcessMessage);
			} catch (error) {
				childProcess.send({
					_error: typeof error === 'string' ? error : DJSUtil.makePlainError(error),
					_responseID: (message as ProcessMessage)._responseID
				});
			}
		});
		return new Promise<this>((resolve, reject) => {
			// using clearTimeout just brings up issues with eslint
			let resolved = false;
			const onReady = () => {
				resolved = true;
				resolve(this);
			};
			this.once('ready', onReady);
			setTimeout(() => {
				if (resolved) return;
				try {
					childProcess.kill();
				} catch { } // eslint-disable-line no-empty
				this.off('ready', onReady);
				reject(new Error('Website spawn timeout exceeded'));
			}, 20000);
		});
	}

	private async _handleMessage(message?: ProcessMessage) {
		if (message?._ready) return this.emit('ready');
		if (!message?._action?.type) return;
		const handler = handlers.get(message._action.type);
		if (!handler) return;
		const _data = await handler(this.client, message._action);
		return new Promise<void>((resolve, reject) => this.process!.send({
			_data,
			_responseID: message._responseID
		}, error => {
			if (error) reject(error);
			else resolve();
		}));
	}
}

export type ProcessActionObject = {
	type: 'SEND_MESSAGE';
	channelID: Snowflake;
	options: {
		content?: string;
		embed: MessageEmbedOptions;
	};
} | {
	type: 'EVAL';
	script: string;
} | {
	type: 'GET_GUILD_MEMBERS';
	ids?: Snowflake[];
	query?: string;
	guildID: Snowflake;
} | {
	type: 'GET_GUILD_CHANNELS';
	withMessages?: boolean;
	guildID: Snowflake;
} | {
  type: 'DATABASE_QUERY';
  sql: string;
  args: {
    type?: 'string' | 'date';
    value: string;
  }[];
} | {
  type: 'GET_CHANNEL_MESSAGES';
  id?: Snowflake;
  before?: Snowflake;
  after?: Snowflake;
  around?: Snowflake;
  limit?: number;
  channelID: Snowflake;
} | {
  type: 'GET_GUILD';
  id?: Snowflake;
  withChannels?: boolean;
} | ({
	type: 'RUN_INTERACTION';
	data: APIInteraction
});

export type ProcessMessage = {
	_responseID: string;
	_ready?: true;
	_action?: ProcessActionObject;
};