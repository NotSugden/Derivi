import { promises as fs } from 'fs';
import { join } from 'path';
import { Collection } from 'discord.js';
import Client from './Client';
import { Errors } from './Constants';
import Command from '../structures/Command';

export default class CommandManager extends Collection<string, Command> {
	public readonly client!: Client;

	private readonly _directory!: string;

	constructor(client: Client, directory: string) {
		super();
		Object.defineProperties(this, {
			_directory: { value: directory },
			client: { value: client },
		});
	}

	public reload(command: CommandResolvable) {
		const resolved = this.resolve(command);
		if (!resolved) throw new Error(Errors.RESOLVE_COMMAND);
		this.delete(resolved.name);
		delete require.cache[resolved.path];
		return this.load(command);
	}

	public resolve(command: CommandResolvable) {
		if (typeof command === 'string') {
			const existing = this.get(command) || this.find(cmd => cmd.path === command);
			return existing;
		}
		if (command instanceof Command) {
			return command;
		}
		return undefined;
	}

	public load(command: CommandResolvable): Command;
	public load(command: CommandResolvable[]): Command[]
	public load(command: CommandResolvable | CommandResolvable[]) {
		if (Array.isArray(command)) return command.map(cmd => this.load(cmd));
		const resolved = this.resolve(command);
		if (!resolved) throw new Error(Errors.RESOLVE_COMMAND);
		try {
			const cmd = new (require(resolved.path) as (new (manager: CommandManager) => Command))(this);
			this.set(cmd.name, cmd);
			return cmd;
		} catch {
			throw new Error(Errors.COMMAND_LOAD_FAILED(resolved.name));
		}
	}

	public async loadAll(directory = this._directory) {
		const filesOrFolders = await fs.readdir(directory);
		const promises: Promise<Command | Command[]>[] = [];

		for (let fileOrFolder of filesOrFolders) {
			fileOrFolder = join(directory, fileOrFolder);
			promises.push(fs.stat(fileOrFolder).then((stats): Promise<Command | Command[]> => {
				if (stats.isDirectory()) {
					return this.loadAll(fileOrFolder);
				}
				const resolved = this.resolve(fileOrFolder);
				if (resolved) delete require.cache[fileOrFolder];

				const command = new (require(fileOrFolder).default as new(manager: CommandManager) => Command)(this);
				this.set(command.name, command);
				return Promise.resolve(command);
			}));
		}

		return Promise.all(promises).then(items => items.flat(2) as Command[]) as Promise<Command[]>;
	}
}

type CommandResolvable = string | Command;
