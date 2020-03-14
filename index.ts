/* eslint-disable @typescript-eslint/no-var-requires */
import { promises as fs } from 'fs';
import { join } from 'path';
import { Extendable, Structures } from 'discord.js';
import Client from './util/Client';
const extended: (keyof Extendable)[] = ['Message', 'Guild'];
for (const className of extended) {
	Structures.extend(className, () => require(join(__dirname, 'structures', 'discord.js', className)).default);
}
const config = require(join(__dirname, 'config.json'));
const client = new Client(config, {
	partials: ['REACTION', 'MESSAGE'],
	presence: {
		activity: {
			name: `${config.prefix}help`
		}
	}
});
client.on('error', console.error);
client.on('warn', console.warn);
client.connect();

/**
 * `events` should be a folder in the root directory of bot
 * this may become configurable at a later date
 */
fs.readdir(join(__dirname, 'events')).then(files => {
	for (const file of files) {
		const fn: (...args: unknown[]) => void = require(
			join(__dirname, 'events', file)
		).default;
		client.on(file.split('.')[0], fn);
	}
}, err => {
	console.error(err);
	process.exit(1);
});