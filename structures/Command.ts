import {
	Client, DMChannel, GuildMember,
	MessageAdditions, MessageEditOptions,
	MessageOptions, PermissionResolvable,
	Snowflake, StringResolvable,
	TextChannel, User
} from 'discord.js';
import { NewsChannel } from 'discord.js';
import CommandArguments from './CommandArguments';
import CommandManager from '../util/CommandManager';
import { GuildMessage, TextBasedChannels } from '../util/Types';

export enum CommandCategory {
	DEV = 'Dev',
	GENERAL = 'General',
	LEVELS = 'Levels',
	MODERATION = 'Moderation',
	PM = 'PM',
	POINTS = 'Points',
	ADMIN = 'Admin'
}

export type CommandAlias = string | {
	append?: string[];
	name: string | string[];
	prepend?: string[];
};

export default class Command {
	public aliases: CommandOptions['aliases'];
	public category: CommandOptions['category'];
	public client!: Client;
	public cooldown: Exclude<CommandOptions['cooldown'], undefined>;
	public cooldowns = new Map<Snowflake, NodeJS.Timeout>();
	public manager!: CommandManager;
	public name: CommandOptions['name'];
	public permissions: Exclude<CommandOptions['permissions'], undefined>;
	public path: string;

	private _examples: CommandOptions['examples'];

	constructor(manager: CommandManager, options: CommandOptions, path: string) {
		Object.defineProperties(this, {
			client: { value: manager.client },
			manager: { value: manager }
		});

		this.aliases = options.aliases;
		this.category = options.category;
		this.cooldown = options.cooldown ?? 3;
		this.name = options.name;
		this.permissions = options.permissions ?? 0;
		this.path = path;

		this._examples = options.examples;
	}

	static async hasPermissions(command: Command, member: GuildMember, channel: TextChannel | NewsChannel) {
		if (typeof command.permissions === 'function') {
			const perms = await command.permissions(member, channel);
			return perms;
		}
		return member.hasPermission(command.permissions);
	}

	public formatExamples(message: GuildMessage<true>, limit: 1): string;
	public formatExamples(message: GuildMessage<true>, limit?: number): string[];
	public formatExamples(message: GuildMessage<true>, limit = Infinity) {
		const array = this._examples.slice(0, limit).map(example => {
			const [, id, id2] = example.match(/{alias:(\d+)(?::(\d+))?}/i) || [];
			let alias = id ? this.aliases[parseInt(id)-1] : null;
			if (alias && typeof alias === 'object') {
				if (typeof alias.name === 'string') alias = alias.name;
				else {
					alias = id2
						? alias.name[parseInt(id2)-1]
						: alias.name[Math.floor(Math.random() * alias.name.length)];
				}
			}
			const name = `${this.client.config.prefix[0]}${alias || this.name}`;
			if (id) example = example.split(' ').slice(1).join(' ');
			if (!example.length) return name;
			return `${name} ${example.replace(/{author\.?([a-z]+)?}/gi, (str, prop?: keyof User) => {
				if (!prop) return message.author.toString();
				else if (prop === 'username') return message.author.username;
				else if (prop === 'tag') return message.author.tag;
				else if (prop === 'id') return message.author.id;
				else if (prop === 'discriminator') return message.author.discriminator;
				else return str;
			}).replace(/{random(member|user|userID)}/gi, (str, match: 'member' | 'user' | 'userid') => {
				if (match === 'member') return message.guild.members.cache.random()!.toString();
				else if (match === 'user') return this.client.users.cache.random()!.toString();
				else if (match === 'userid') return this.client.users.cache.randomKey()!;
				else return str;
			}).replace(/{member}/gi, () => message.member.toString()).replace(
				/{channel\.?([a-z]+)?}/gi,
				(str, prop?: keyof TextChannel) => {
					if (!prop) return message.channel.toString();
					else if (prop === 'id') return message.channel.id;
					else if (prop === 'name') return message.channel.name;
					else return str;
				}
			)}`;
		});
		return limit === 1 ? array[0] : array;
	}

	public reload() {
		if (!this.path) return Promise.reject(new Error('This command doesn\'t have a valid path'));
		delete require.cache[this.path];
		return this.manager.load(this);
	}

	public run(message: GuildMessage<true>, args: CommandArguments, {
		send,
		edited = false
	}: CommandData): Promise<GuildMessage<true> | void> {
		if (edited) return Promise.resolve();
		return send('No implementation for command');
	}
}

export interface CommandData {
	edited?: boolean;
	send(
		options: MessageAdditions | MessageEditOptions | MessageOptions
	): Promise<GuildMessage<true>>;
	send(
		content: StringResolvable,
		options?: MessageAdditions | MessageOptions | MessageEditOptions
	): Promise<GuildMessage<true>>;
}

export interface CommandOptions {
	aliases: CommandAlias[];
	category: CommandCategory;
	cooldown?: number;
	examples: string[];
	name: string;
	permissions?: PermissionResolvable | PermissionsFunction;
}

export type CommandArgument = {
	required?: boolean;
	type: string;
	extras?: string[];
};

type PermissionsReturn = boolean | string | null;

export type PermissionsFunction = (
	member: GuildMember,
	channel: Exclude<TextBasedChannels, DMChannel>,
) => PermissionsReturn | Promise<PermissionsReturn>;
