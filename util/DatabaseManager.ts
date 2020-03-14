import { UserResolvable } from 'discord.js';
import * as sqlite from 'sqlite';
import Client from './Client';
import { Errors } from './Constants';
import Levels, { RawLevels } from '../structures/Levels';
import Points, { RawPoints } from '../structures/Points';

export default class DatabaseManager {
	private client!: Client;
	private rawDatabase = (sqlite as unknown) as sqlite.Database;

	constructor(client: Client) {
		Object.defineProperty(this, 'client', { value: client });
	}

	/**
   * Warning: database file will need to be properly configured.
   */
	public open() {
		return sqlite.open(this.client.config.database, {
			cached: true,
		});
	}

	public async setPoints(
		user: UserResolvable,
		{ points, vault, daily }: { points?: number; vault: number; daily?: boolean | number },
	): Promise<Points>;
	public async setPoints(
		user: UserResolvable,
		{ points, vault, daily }: { points: number; vault?: number; daily?: boolean | number },
	): Promise<Points>;
	public async setPoints(
		user: UserResolvable,
		{ points, vault, daily }: { points?: number; vault?: number; daily?: boolean | number },
	) {
		const id = this.client.users.resolveID(user);
		const error = new Error(Errors.POINTS_RESOLVE_ID(false));
		if (!id) throw error;
		let existing: Points;
		try {
			existing = await this.points(id);
		} catch (err) {
			if (err.name === Errors.POINTS_RESOLVE_ID()) throw error;
			else throw err;
		}

		const set: [Exclude<keyof RawPoints, 'id'>, number][] = [];

		if (typeof points === 'number') {
			if (points < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('points'));
			set.push(['points', existing.amount = points]);
		}
		if (typeof vault === 'number') {
			if (vault < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('vault'));
			set.push(['vault', existing.vault = vault]);
		}
		if (typeof daily === 'number' || daily) {
			if (daily < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('daily'));
			set.push(['last_daily', existing.lastDailyTimestamp = typeof daily === 'number' ? daily : Date.now()]);
		}

		await this.rawDatabase.run(
			`UPDATE points SET ${set.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`,
			...set.map(([, value]) => value),
			id,
		);
		return existing;
	}

	public async points(user: UserResolvable): Promise<Points>;
	public async points(user: UserResolvable[]): Promise<Points[]>;
	public async points(user: UserResolvable | UserResolvable[]) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.points(u)));
		const id = this.client.users.resolveID(user);
		if (!id || !/^\d{17,19}$/.test(id)) throw new Error('Couldn\'t resolve the User ID to fetch points from.');
		let data: RawPoints = await this.rawDatabase.get('SELECT * FROM points WHERE id = ?', id);
		if (!data) {
			await this.rawDatabase.run(
				'INSERT INTO points (id, last_daily, points, vault) VALUES (?, ?, ?, ?)',
				id,
				0,
				1000,
				0,
			);
			data = {
				id,
				last_daily: 0,
				points: 1000,
				vault: 0,
			};
		}
		return new Points(this.client, data);
	}

	public async setLevels(user: UserResolvable, { level, xp }: { level?: number; xp: number }): Promise<Levels>;
	public async setLevels(user: UserResolvable, { level, xp }: { level: number; xp?: number }): Promise<Levels>;
	public async setLevels(user: UserResolvable, { level, xp }: { level?: number; xp?: number }) {
		const id = this.client.users.resolveID(user);
		const error = new Error(Errors.LEVELS_RESOLVE_ID(false));
		if (!id) throw error;
		let existing: Levels;
		try {
			existing = await this.levels(id);
		} catch (err) {
			if (err.name === Errors.LEVELS_RESOLVE_ID()) throw error;
			else throw err;
		}

		if (typeof xp === 'number') {
			level = 0;
			while (Levels.levelCalc(level) < xp) level++;
		} else if (typeof level === 'number') {
			xp = Levels.levelCalc(level) + 1;
		}

		if (typeof level !== 'number' || typeof xp !== 'number') {
			throw new TypeError(Errors.INVALID_TYPE('level\' or \'xp', 'number'));
		}
		if (level < 0 || xp < 0) {
			throw new RangeError(Errors.NEGATIVE_NUMBER(level < 0 ? 'level' : 'xp'));
		}

		await this.rawDatabase.run('UPDATE levels SET level = ?, xp = ? WHERE id = ?',
			existing.level = level,
			existing.xp = xp,
			id,
		);
		return existing;
	}

	public async levels(user: UserResolvable): Promise<Levels>;
	public async levels(user: UserResolvable[]): Promise<Levels[]>;
	public async levels(user: UserResolvable | UserResolvable[]) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.levels(u)));
		const id = this.client.users.resolveID(user);
		if (!id) throw new Error(Errors.LEVELS_RESOLVE_ID());
		let data: RawLevels = await this.rawDatabase.get('SELECT * FROM levels WHERE id = ?', id);
		if (!data) {
			await this.rawDatabase.run('INSERT INTO levels (id, level, xp) VALUES (?, ?, ?)', id, 0, 0);
			data = {
				id,
				level: 0,
				xp: 0,
			};
		}
		return new Levels(this.client, data);
	}
}
