import { fork, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import { Snowflake, MessageEmbedOptions, GuildMember, Util as DJSUtil } from 'discord.js';
import Client from './Client';
import TextChannel from '../structures/discord.js/TextChannel';

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
		)
			.on('message', async message => {
				try {
					await this._handleMessage(message as ProcessMessage);
				} catch (error) {
					childProcess.send({
						_error: DJSUtil.makePlainError(error),
						_responseID: (message as ProcessMessage)._responseID
					});
				}
			});
		return new Promise<this>((resolve, reject) => {
			// using clearTimeout just brings up issues with eslints
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
		if (!message) return;
		const errorCB = (error: Error | null) => {
			if (!error) return;
			this.process!.send({
				_error: DJSUtil.makePlainError(error),
				_responseID: message._responseID
			});
		};
		if (message._ready) {
			this.emit('ready');
		} else if (message._action) {
			const action = message._action;
			if (action.type === 'SEND_MESSAGE') {
				const channel = this.client.channels.resolve(action.channelID) as TextChannel | null;
				if (channel?.type !== 'text') {
					throw channel ? 'INVALID_CHANNEL_TYPE' : 'INVALID_CHANNEL';
				}
				await channel.send(action.options)
					.then(msg => this.process!.send({
						_data: {
							messageID: msg.id
						},
						_responseID: message._responseID
					}, errorCB));
			} else if (action.type === 'EVAL') {
				let result;
				try {
					result = await eval(action.script);
				} catch (error) {
					result = error;
				}
				this.process!.send({
					_data: { result },
					_responseID: message._responseID
				}, errorCB);
			} else if (action.type === 'GET_GUILD_MEMBERS') {
				const membersMap = (member: GuildMember | null) => {
					if (!member) return null;
					return {
						displayColor: member.displayHexColor,
						joinedAt: member.joinedAt?.toISOString(),
						nickname: member.nickname,
						permissions: member.permissions.toArray(),
						roles: member.roles.cache.map(role => ({
							color: role.hexColor,
							id: role.id,
							name: role.name,
							permissions: role.permissions.toArray(),
							position: role.rawPosition
						})),
						user: {
							avatarURL: member.user.displayAvatarURL({ dynamic: true }),
							bot: member.user.bot,
							flags: member.user.flags.toArray(),
							tag: member.user.tag
						}
					};
				};
				if (action.ids) {
					const members = [];
					for (const id of action.ids) {
						try {
							members.push(await this.client.config.defaultGuild.members.fetch(id));
						} catch {
							members.push(null);
						}
					}
					return this.process!.send({
						_data: {
							members: members.map(membersMap)
						},
						_responseID: message._responseID
					});
				} else if (action.query) {
					const members = await this.client.config.defaultGuild.members.fetch({
						query: action.query
					});
					return this.process!.send({
						_data: {
							members: members.array().map(membersMap)
						},
						_responseID: message._responseID
					});
				}
			}
		}
	}
}

type ProcessMessage = {
	_responseID: string;
	_ready?: true;
	_action?: {
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
		ids?: string[];
		query?: string;
	};
};