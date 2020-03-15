import { UserResolvable, User } from 'discord.js';
import * as sqlite from 'sqlite';
import Client from './Client';
import { Errors, ModerationActionTypes } from './Constants';
import Case, { RawCase } from '../structures/Case';
import Levels, { RawLevels } from '../structures/Levels';
import Points, { RawPoints } from '../structures/Points';
import Warn, { RawWarn } from '../structures/Warn';
import Message from '../structures/discord.js/Message';

const stringify = (json: object) => {
	try {
		return JSON.stringify(json);
	} catch {
		return '{}';
	}
};

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
			cached: true
		});
	}

	public async setPoints(
		user: UserResolvable,
		options: { points?: number; vault: number; daily?: boolean | number },
	): Promise<Points>;
	public async setPoints(
		user: UserResolvable,
		options: { points: number; vault?: number; daily?: boolean | number },
	): Promise<Points>;
	public async setPoints(
		user: UserResolvable,
		{ points, vault, daily }: { points?: number; vault?: number; daily?: boolean | number }
	) {
		const id = this.client.users.resolveID(user);
		const error = new Error(Errors.POINTS_RESOLVE_ID(false));
		if (!id || !/^\d{17,19}$/.test(id)) throw error;
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
			id
		);
		return existing;
	}

	public async points(user: UserResolvable): Promise<Points>;
	public async points(user: UserResolvable[]): Promise<Points[]>;
	public async points(user: UserResolvable | UserResolvable[]) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.points(u)));
		const id = this.client.users.resolveID(user);
		if (!id || !/^\d{17,19}$/.test(id)) throw new Error(Errors.POINTS_RESOLVE_ID(true));
		
		let data = await this.rawDatabase.get<RawPoints>('SELECT * FROM points WHERE id = ?', id);
		if (!data) {
			await this.rawDatabase.run(
				'INSERT INTO points (id, last_daily, points, vault) VALUES (?, ?, ?, ?)',
				id,
				0,
				1000,
				0
			);
			data = {
				id,
				last_daily: 0,
				points: 1000,
				vault: 0
			};
		}
		return new Points(this.client, data);
	}

	public async setLevels(user: UserResolvable, options: { level?: number; xp: number }): Promise<Levels>;
	public async setLevels(user: UserResolvable, options: { level: number; xp?: number }): Promise<Levels>;
	public async setLevels(user: UserResolvable, { level, xp }: { level?: number; xp?: number }) {
		const id = this.client.users.resolveID(user);
		const error = new Error(Errors.LEVELS_RESOLVE_ID(false));
		if (!id || !/^\d{17,19}$/.test(id)) throw error;

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
			id
		);
		return existing;
	}

	public async levels(user: UserResolvable): Promise<Levels>;
	public async levels(user: UserResolvable[]): Promise<Levels[]>;
	public async levels(user: UserResolvable | UserResolvable[]) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.levels(u)));
		const id = this.client.users.resolveID(user);
		if (!id || !/^\d{17,19}$/.test(id)) throw new Error(Errors.LEVELS_RESOLVE_ID());

		let data = await this.rawDatabase.get<RawLevels>('SELECT * FROM levels WHERE id = ?', id);
		if (!data) {
			await this.rawDatabase.run('INSERT INTO levels (id, level, xp) VALUES (?, ?, ?)', id, 0, 0);
			data = {
				id,
				level: 0,
				xp: 0
			};
		}
		return new Levels(this.client, data);
	}

	public async case(id: number): Promise<Case | null>;
	public async case(id: number[]): Promise<(Case | null)[]>;
	public async case(id: number | number[]) {
		if (Array.isArray(id)) return Promise.all(id.map(i => this.case(i)));
		const data = await this.rawDatabase.get<RawCase>('SELECT * FROM cases WHERE id = ?', id);
		if (!data) return null;
		return new Case(this.client, data);
	}

	public async newCase({
		action,
		extras,
		message,
		moderator,
		reason,
		screenshots = [],
		users
	}: {
		action: keyof typeof ModerationActionTypes;
		extras?: object;
		message: Message;
		moderator: UserResolvable;
		reason: string;
		screenshots?: string[];
		users: UserResolvable[];
	}) {
		const data = { reason } as RawCase;
		const error = new Error(Errors.RESOLVE_PROVIDED('moderator'));
		try {
			const id = this.client.users.resolveID(moderator);
			if (!id || !/^\d{17,19}$/.test(id)) {
				throw error;
			}
			const user = await this.client.users.fetch(id);
			data.moderator_id = user.id;
		} catch {
			throw error;
		}
		// same as above
		const _users = [];
		for (const idOrUser of users) {
			if (idOrUser instanceof User) {
				_users.push(idOrUser.id);
				continue;
			}
			try {
				const id = this.client.users.resolveID(idOrUser);
				if (!id) throw null;
				const user = await this.client.users.fetch(
					id
				);
				_users.push(user.id);
			} catch {
				throw new Error(Errors.CASE_RESOLVE_USER(users.indexOf(idOrUser)));
			}
		}

		await this.rawDatabase.run(
			// cases table should have an auto-incrementing unique key, id
			`INSERT INTO cases (action, extras, message_id, moderator_id, reason, screenshots, user_ids)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			data.action = action,
			data.extras = extras ? stringify(extras) : '{}',
			data.message_id = message.id,
			// this was converted into a `string`
			data.moderator_id,
			data.reason,
			data.screenshot_urls = JSON.stringify(screenshots),
			data.user_ids = JSON.stringify(_users)
		);

		const { seq: caseID } = await this.rawDatabase.get<{ name: 'cases'; seq: number }>(
			'SELECT seq FROM sqlite_sequence WHERE name = ?',
			'cases'
		);
		data.id = caseID;
		return new Case(this.client, data);
	}

	public async warns(caseID: number): Promise<Warn[] | null>;
	public async warns(caseIDs: number[]): Promise<{ [key: number]: Warn[] | null }>;
	public async warns(user: UserResolvable[]): Promise<{ [key: string]: Warn[] | null }>;
	public async warns(user: UserResolvable): Promise<Warn[]>;
	public async warns(caseOrUser: UserResolvable | number | UserResolvable[] | number[]): Promise<
		Warn[] |
		{ [key: number]: Warn[] | null } |
		{ [key: string]: Warn[] | null } | null
	> {
		if (Array.isArray(caseOrUser)) {
			/**
			 * HOLY SHIT, This is some real spaghetti code right here
			 * i'm not sure if all the types are correct internally in that mess
			 * but it should return them properly which is what matters
			 */
			const objects = await Promise.all((caseOrUser as (number | UserResolvable)[])
				.map((id: number | UserResolvable) => this.warns(id as number)
					.then(data => ({
						[id as string | number]: data
					}))));
			const object = Object.assign(objects[0], ...objects.slice(1)) as { [key: number]: Warn[] | null };
			return object;
		}
		if (typeof caseOrUser === 'number') {
			const rawWarns = await this.rawDatabase.all<RawWarn>(
				'SELECT * FROM warnings WHERE case_id = ?',
				caseOrUser
			);
			if (!rawWarns.length) return null;
			return rawWarns.map(data => new Warn(this.client, data));
		}
		const id = this.client.users.resolveID(caseOrUser);
		if (!id || !/^\d{17,19}$/.test(id)) throw new Error(Errors.WARNS_RESOLVE_ID);

		const rawWarns = await this.rawDatabase.all<RawWarn>('SELECT * FROM warnings WHERE user_id = ?', id);
		if (!rawWarns.length) return null;
		return rawWarns.map(data => new Warn(this.client, data));
	}

	public async newWarn(user: UserResolvable, moderator: UserResolvable, { caseID, reason, timestamp = new Date() }: {
		caseID: number;
		reason: string;
		timestamp?: Date;
	}) {
		const data = { case_id: caseID, reason } as RawWarn;
		const resolve = (resolvable: UserResolvable, error: Error) => {
			try {
				const id = this.client.users.resolveID(resolvable);
				if (!id || !/^\d{17,19}$/.test(id)) {
					throw error;
				}
				return this.client.users.fetch(id);
			} catch {
				throw error;
			}
		};
		data.moderator_id = (await resolve(moderator, new Error(Errors.RESOLVE_PROVIDED('moderator')))).id;
		data.user_id = (await resolve(user, new Error(Errors.RESOLVE_PROVIDED('user')))).id;

		await this.rawDatabase.run(
			'INSERT INTO warnings (case_id, moderator_id, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?)',
			caseID,
			data.moderator_id,
			reason,
			data.user_id,
			data.timestamp = timestamp.toISOString()
		);

		return new Warn(this.client, data);
	}
}