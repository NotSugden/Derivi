import {
	PermissionResolvable, GuildMember,
	TextChannel, Snowflake, MessageAdditions,
	MessageOptions, StringResolvable, MessageEditOptions
} from 'discord.js';
import CommandArguments from './CommandArguments';
import Message from './discord.js/Message';
import Client from '../util/Client';
import CommandManager from '../util/CommandManager';

export default class Command {
	public category: string;
	public client!: Client;
	public cooldown: Exclude<CommandOptions['cooldown'], undefined>;
	public cooldowns = new Map<Snowflake, NodeJS.Timeout>();
	public manager!: CommandManager;
	public name: CommandOptions['name'];
	public permissions: Exclude<CommandOptions['permissions'], undefined>;
	public path: string;

	private _usages: CommandOptions['usages'];

	constructor(manager: CommandManager, options: CommandOptions, path: string) {
		Object.defineProperties(this, {
			client: { value: manager.client },
			manager: { value: manager }
		});
		this.category = options.category;
		this.cooldown = options.cooldown || 3;
		this.name = options.name;
		this.permissions = options.permissions || 0;
		this.path = path;

		this._usages = options.usages;
	}

	public get usages() {
		return this._usages.map(
			usage =>
				(usage.required ? '[' : '<') +
				(usage.extras ? [usage.type, ...usage.extras].join(' | ') : usage.type) +
				(usage.required ? ']' : '>')
		);
	}

	public reload() {
		if (!this.path) return Promise.reject(new Error('This command doesn\'t have a valid path'));
		delete require.cache[this.path];
		return this.manager.load(this);
	}

	public run(message: Message, args: CommandArguments, {
		send,
		edited = false
	}: CommandData): Promise<Message | void> {
		if (edited) return Promise.resolve();
		return send('No implementation for command');
	}
}

export interface CommandData<> {
	edited?: boolean;
	send(
		options: MessageAdditions | MessageEditOptions | MessageOptions
	): Promise<Message>;
	send(
		content: StringResolvable,
		options?: MessageAdditions | MessageOptions | MessageEditOptions
	): Promise<Message>;
}

export interface CommandOptions {
	aliases: string[];
	category: string;
	cooldown?: number;
	name: string;
	permissions?: PermissionResolvable | PermissionsFunction;
	usages: CommandUsage[];
}

export type CommandUsage = {
	required?: boolean;
	type: string;
	extras?: string[];
};

type PermissionsFunction = (
	member: GuildMember & { client: Client },
	channel: TextChannel & { client: Client },
) => boolean | Promise<boolean>;
