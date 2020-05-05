import { UserResolvable, Snowflake } from 'discord.js';
import * as mysql from 'mysql';
import Client from './Client';
import { Errors, ModerationActionTypes } from './Constants';
import Case, { RawCase } from '../structures/Case';
import Levels, { RawLevels } from '../structures/Levels';
import Mute, { RawMute } from '../structures/Mute';
import Points, { RawPoints } from '../structures/Points';
import Warn, { RawWarn } from '../structures/Warn';
import Message from '../structures/discord.js/Message';
import User from '../structures/discord.js/User';

const stringify = (json: object) => {
	try {
		return JSON.stringify(json);
	} catch {
		return '{}';
	}
};

export default class DatabaseManager {
	private client!: Client;
	private rawDatabase: mysql.Connection;

	constructor(client: Client, config: mysql.ConnectionConfig) {
		Object.defineProperty(this, 'client', { value: client });
		this.rawDatabase = mysql.createConnection(config);
	}

	public query<T>(sql: string, ...params: unknown[]) {
		return new Promise<T[]>((resolve, reject) => {
			this.rawDatabase.query(sql, params, (error, rows) => {
				if (error) reject(error);
				else resolve(rows);
			});
		});
	}

	public close() {
		return new Promise<this>((resolve, reject) => {
			this.rawDatabase.end(error => {
				if (error) reject(error);
				else resolve(this);
			});
		});
	}

	/**
   * Warning: database file will need to be properly configured.
   */
	public open() {
		return new Promise<this>((resolve, reject) => {
			this.rawDatabase.connect(error => {
				if (error) reject(error);
				else resolve(this);
			});
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
		{ points, vault, daily }: { points?: number; vault?: number; daily?: boolean | number | Date }
	) {
		const userID = this.client.users.resolveID(user);
		const error = new Error(Errors.POINTS_RESOLVE_ID(false));
		if (!userID || !/^\d{17,19}$/.test(userID)) throw error;
		let existing: Points;
		try {
			existing = await this.points(userID);
		} catch (err) {
			if (err.name === Errors.POINTS_RESOLVE_ID(false)) throw error;
			else throw err;
		}

		const set: [Exclude<keyof RawPoints, 'id'>, number | string][] = [];

		if (typeof points === 'number') {
			if (points < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('points'));
			set.push(['amount', existing.amount = points]);
		}
		if (typeof vault === 'number') {
			if (vault < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('vault'));
			set.push(['vault', existing.vault = vault]);
		}
		if (typeof daily === 'number' || typeof daily === 'boolean' || daily instanceof Date) {
			if (daily < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('daily'));
			const date = new Date(typeof daily === 'boolean' ?
				Date.now() :
				daily
			);
			set.push(['last_daily', date.toISOString()]);
			existing.lastDailyTimestamp = date.getTime();
		}

		await this.query(
			`UPDATE points SET ${set.map(([key]) => `${key} = ?`).join(', ')} WHERE user_id = ?`,
			...set.map(([, value]) => value),
			userID
		);
		return existing;
	}

	public async points(user: UserResolvable): Promise<Points>;
	public async points(users: UserResolvable[]): Promise<Points[]>;
	public async points(user: UserResolvable | UserResolvable[]) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.points(u)));
		const userID = this.client.users.resolveID(user);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.POINTS_RESOLVE_ID(true));
		
		const [data] = await this.query<RawPoints>('SELECT * FROM points WHERE user_id = ? LIMIT 1', userID);
		if (!data) {
			await this.query(
				'INSERT INTO points (user_id) VALUES (?)',
				userID
			);
			return this.points(userID);
		}
		return new Points(this.client, data);
	}

	public async setLevels(user: UserResolvable, options: { level?: number; xp: number }): Promise<Levels>;
	public async setLevels(user: UserResolvable, options: { level: number; xp?: number }): Promise<Levels>;
	public async setLevels(user: UserResolvable, { level, xp }: { level?: number; xp?: number }) {
		const userID = this.client.users.resolveID(user);
		const error = new Error(Errors.LEVELS_RESOLVE_ID(false));
		if (!userID || !/^\d{17,19}$/.test(userID)) throw error;

		let existing: Levels;
		try {
			existing = await this.levels(userID);
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

		await this.query('UPDATE levels SET level = ?, xp = ? WHERE user_id = ?',
			existing.level = level,
			existing.xp = xp,
			userID
		);
		return existing;
	}

	public async levels(top: number): Promise<Levels[]>;
	public async levels(user: UserResolvable): Promise<Levels>;
	public async levels(users: UserResolvable[]): Promise<Levels[]>;
	public async levels(user: UserResolvable | UserResolvable[] | number) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.levels(u)));
		if (typeof user === 'number') {
			const topLevels = await this.query<RawLevels>(
				'SELECT * FROM levels ORDER by xp desc LIMIT ?',
				user
			);
			return topLevels
				.map(data => new Levels(this.client, data));
		}
		const userID = this.client.users.resolveID(user);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.LEVELS_RESOLVE_ID());

		const [data] = await this.query<RawLevels>(
			'SELECT * FROM levels WHERE user_id = ? LIMIT 1',
			userID
		);
		if (!data) {
			await this.query('INSERT INTO levels (user_id) VALUES (?)', userID);
			return this.levels(user);
		}
		return new Levels(this.client, data);
	}

	public async deleteCase(id: number) {
		await this.query('DELETE FROM cases WHERE id = ?', id);
		return;
	}

	public async case(options: { after?: number | Date; before?: number | Date }): Promise<Case[]>;
	public async case(id: number): Promise<Case | null>;
	public async case(ids: number[]): Promise<(Case | null)[]>;
	public async case(id: number | number[] | { after?: number | Date; before?: number | Date }) {
		if (Array.isArray(id)) return Promise.all(id.map(i => this.case(i)));
		if (typeof id === 'object') {

			const values: [string[], string[]] = [[], []];
			if (typeof id.after !== 'undefined') {
				values[0].push('timestamp > ?');
				values[1].push(new Date(id.after).toISOString());
			}
			if (typeof id.before !== 'undefined') {
				values[0].push('timestamp < ?');
				values[1].push(new Date(id.before).toISOString());
			}

			const cases = await this.query<RawCase>(
				`SELECT * FROM cases WHERE ${values[0].join(' AND ')}`,
				...values[1]
			);
			return cases.map(data => new Case(this.client, data));
		}
		const [data] = await this.query<RawCase>('SELECT * FROM cases WHERE id = ? LIMIT 1', id);
		if (!data) return null;
		return new Case(this.client, data);
	}

	/**
	 * TODO: change this to accept an object for multiple misc changes
	 */
	public async updateCase(caseID: number, urls: string[]) {
		await this.query(
			'UPDATE cases SET screenshots = ? WHERE id = ?',
			JSON.stringify(urls),
			caseID
		);
		return;
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
			const moderatorID = this.client.users.resolveID(moderator);
			if (!moderatorID || !/^\d{17,19}$/.test(moderatorID)) {
				throw error;
			}
			const user = await this.client.users.fetch(moderatorID);
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
				const userID = this.client.users.resolveID(idOrUser);
				if (!userID) throw null;
				const user = await this.client.users.fetch(
					userID
				);
				_users.push(user.id);
			} catch {
				throw new Error(Errors.CASE_RESOLVE_USER(users.indexOf(idOrUser)));
			}
		}

		await this.query(
			// cases table should have an auto-incrementing unique key, id
			`INSERT INTO cases (action, extras, message_id, moderator_id, reason, screenshots, user_ids)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			data.action = action,
			data.extras = extras ? stringify(extras) : '{}',
			data.message_id = message.id,
			// this was converted into a `string`
			data.moderator_id,
			data.reason,
			data.screenshots = JSON.stringify(screenshots),
			data.user_ids = JSON.stringify(_users)
		);

		const [{ id }] = (await this.query<{ id: number }>(
			'SELECT LAST_INSERT_ID() as id FROM cases'
		));
		data.id = id;
		return new Case(this.client, data);
	}

	public async warns(caseID: number): Promise<Warn[] | null>;
	public async warns(caseIDs: number[]): Promise<{ [key: number]: Warn[] | null }>;
	public async warns(users: UserResolvable[]): Promise<{ [key: string]: Warn[] | null }>;
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
			const rawWarns = await this.query<RawWarn>(
				'SELECT * FROM warnings WHERE case_id = ?',
				caseOrUser
			);
			if (!rawWarns.length) return null;
			return rawWarns.map(data => new Warn(this.client, data));
		}
		const userID = this.client.users.resolveID(caseOrUser);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.WARNS_RESOLVE_ID);

		const rawWarns = await this.query<RawWarn>('SELECT * FROM warnings WHERE user_id = ?', userID);
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
				const userID = this.client.users.resolveID(resolvable);
				if (!userID || !/^\d{17,19}$/.test(userID)) {
					throw error;
				}
				return this.client.users.fetch(userID);
			} catch {
				throw error;
			}
		};
		data.moderator_id = (await resolve(moderator, new Error(Errors.RESOLVE_PROVIDED('moderator')))).id;
		data.user_id = (await resolve(user, new Error(Errors.RESOLVE_PROVIDED('user')))).id;

		await this.query(
			'INSERT INTO warnings (case_id, moderator_id, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?)',
			caseID,
			data.moderator_id,
			reason,
			data.user_id,
			(data.timestamp = timestamp).toISOString()
		);

		return new Warn(this.client, data);
	}

	public async mute(all: true): Promise<Mute[]>;
	public async mute(user: UserResolvable): Promise<Mute | null>;
	public async mute(users: UserResolvable[]): Promise<(Mute | null)[]>;
	public async mute(user: true | UserResolvable | UserResolvable[]) {
		if (typeof user === 'boolean'){
			const rawData = await this.query<RawMute>('SELECT * FROM mutes');
			return rawData.reduce((acc, data) => {
				const mute = new Mute(this.client, data);
				if (mute.endTimestamp < Date.now()) return acc;
				else return [...acc, mute];
			}, [] as Mute[]) as Mute[];
		}
		if (Array.isArray(user)) return Promise.all(user.map(u => this.mute(u)));
		const userID = this.client.users.resolveID(user);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.MUTE_RESOLVE_ID(true));

		if (this.client.mutes.has(userID)) return this.client.mutes.get(userID);

		const [data] = await this.query<RawMute>('SELECT * FROM mutes WHERE user_id = ? LIMIT 1', userID);
		if (!data) return null;
		const mute = new Mute(this.client, data);
		if (mute.endTimestamp < Date.now()) return null;
		else return mute;
	}

	public async newMute(user: UserResolvable, start: Date, end: Date) {
		const userID = this.client.users.resolveID(user);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.RESOLVE_PROVIDED('user'));

		const data = { user_id: userID } as RawMute;

		await this.query(
			'INSERT INTO mutes (user_id, start, end) VALUES (?, ?, ?)',
			userID,
			(data.start = start).toISOString(),
			(data.end = end).toISOString()
		);

		return new Mute(this.client, data);
	}

	public async deleteMute(user: UserResolvable) {
		const userID = this.client.users.resolveID(user);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.MUTE_RESOLVE_ID(false));

		await this.query('DELETE FROM mutes WHERE user_id = ?', userID);
		return;
	}

	public async partnerships(options: {
		after: string | number | Date;
		before: string | number | Date;
	}): Promise<Partnership[]>;
	public async partnerships(options: { after: string | number | Date }): Promise<Partnership[]>;
	public async partnerships(options: { before: string | number | Date }): Promise<Partnership[]>
	public async partnerships(guild: string[]): Promise<Partnership[][]>;
	public async partnerships(guild: string): Promise<Partnership[]>;
	public async partnerships(guild: string | string[] | {
		before?: string | number | Date;
		after?: string | number | Date;
	}): Promise<Partnership[] | Partnership[][]> {
		if (Array.isArray(guild)) return Promise.all(guild.map(id => this.partnerships(id)));
		const { client } = this;
		if (typeof guild === 'string') {
			const partnerships = await this.query<RawPartnership>(
				'SELECT * FROM partnerships WHERE guild_id = ? OR guild_invite = ?',
				guild, guild
			);
			return partnerships.map(partnership => ({
				guildID: partnership.guild_id,
				invite: partnership.guild_invite,
				timestamp: new Date(partnership.timestamp),
				get user() {
					return client.users.resolve(this.userID) as User | null;
				},
				userID: partnership.user_id
			}));
		}
		const before = new Date(guild.before ? guild.before : Date.now());
		const after = new Date(guild.after ? guild.after : 0);
		const partnerships = await this.query<RawPartnership>(
			'SELECT * FROM partnerships WHERE timestamp < ? AND timestamp > ?',
			before.toISOString(), after.toISOString()
		);
		return partnerships.map(partnership => ({
			guildID: partnership.guild_id,
			invite: partnership.guild_invite,
			timestamp: new Date(partnership.timestamp),
			get user() {
				return client.users.resolve(this.userID) as User | null;
			},
			userID: partnership.user_id
		}));
	}

	public async newPartnership(guild: { invite: string; id: Snowflake }, user: UserResolvable, timestamp: Date) {
		const userID = this.client.users.resolveID(user);
		if (!userID || !/^\d{17,19}$/.test(userID)) throw new Error(Errors.RESOLVE_PROVIDED('user'));
		await this.query(
			'INSERT INTO partnerships (guild_id, guild_invite, user_id, timestamp) VALUES (?, ?, ?, ?)',
			guild.id, guild.invite, userID, timestamp.getTime()
		);
		const { client } = this;
		return {
			guildID: guild.id,
			invite: guild.invite,
			timestamp: new Date(timestamp),
			get user() {
				return client.users.resolve(this.userID) as User | null;
			},
			userID
		};
	}
}

interface Partnership {
	guildID: Snowflake;
	userID: Snowflake;
	readonly user: User | null;
	invite: string;
	timestamp: Date;
}

interface RawPartnership {
	guild_id: Snowflake;
	user_id: Snowflake;
	guild_invite: string;
	timestamp: number;
}