import { Snowflake, SnowflakeUtil } from 'discord.js';
import * as mysql from 'mysql';
import Client from './Client';
import { Errors, ModerationActionTypes } from './Constants';
import Util from './Util';
import Case, { RawCase } from '../structures/Case';
import Levels, { RawLevels } from '../structures/Levels';
import Mute, { RawMute } from '../structures/Mute';
import Points, { RawPoints } from '../structures/Points';
import Star, { RawStar } from '../structures/Star';
import Warn, { RawWarn } from '../structures/Warn';
import Guild from '../structures/discord.js/Guild';
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
		user: User | Snowflake,
		options: { points?: number; vault: number; daily?: boolean | number },
	): Promise<Points>;
	public async setPoints(
		user: User | Snowflake,
		options: { points: number; vault?: number; daily?: boolean | number },
	): Promise<Points>;
	public async setPoints(
		user: User | Snowflake,
		{ points, vault, daily }: { points?: number; vault?: number; daily?: boolean | number | Date }
	) {
		const userID = this.client.users.resolveID(user)!;
		const existing = await this.points(userID);

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

	public async points(user: User | Snowflake): Promise<Points>;
	public async points(users: (User | Snowflake)[]): Promise<Points[]>;
	public async points(user: User | Snowflake | (User | Snowflake)[]) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.points(u)));
		const userID = this.client.users.resolveID(user)!;
		
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

	public async setLevels(user: User | Snowflake, options: { level?: number; xp: number }): Promise<Levels>;
	public async setLevels(user: User | Snowflake, options: { level: number; xp?: number }): Promise<Levels>;
	public async setLevels(user: User | Snowflake, { level, xp }: { level?: number; xp?: number }) {
		const userID = this.client.users.resolveID(user)!;

		const existing = await this.levels(userID);

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
	public async levels(user: User | Snowflake): Promise<Levels>;
	public async levels(users: (User | Snowflake)[]): Promise<Levels[]>;
	public async levels(user: User | Snowflake | (User | Snowflake)[] | number) {
		if (Array.isArray(user)) return Promise.all(user.map(u => this.levels(u)));
		if (typeof user === 'number') {
			const topLevels = await this.query<RawLevels>(
				'SELECT * FROM levels ORDER by xp desc LIMIT ?',
				user
			);
			return topLevels
				.map(data => new Levels(this.client, data));
		}
		const userID = this.client.users.resolveID(user)!;

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

	public async deleteCase(guild: Guild, id: number) {
		await this.query('DELETE FROM cases WHERE id = ? AND guild_id = ?', id, guild.id);
		return;
	}

	public async case(guild: Guild, options: { after?: number | Date; before?: number | Date }): Promise<Case[]>;
	public async case(guild: Guild, id: number): Promise<Case | null>;
	public async case(guild: Guild, ids: number[]): Promise<(Case | null)[]>;
	public async case(guild: Guild, id: number | number[] | { after?: number | Date; before?: number | Date }) {
		if (Array.isArray(id)) return Promise.all(id.map(i => this.case(guild, i)));
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
      
			values[0].push('guild_id = ?');
			values[1].push(guild.id);

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
	public async updateCase(guild: Guild, caseID: number, urls: string[]) {
		await this.query(
			'UPDATE cases SET screenshots = ? WHERE id = ? AND guild_id = ?',
			JSON.stringify(urls),
			caseID,
			guild.id
		);
		return;
	}

	public async newCase({
		action,
		extras,
		guild,
		message,
		moderator,
		reason,
		screenshots = [],
		users
	}: {
		action: keyof typeof ModerationActionTypes;
    extras?: object;
    guild: Guild;
		message: Message;
		moderator: User | Snowflake;
		reason: string;
		screenshots?: string[];
		users: (User | Snowflake)[];
	}) {
		const data = {
			action,
			extras: extras ? stringify(extras) : '{}',
			guild_id: guild.id,
			message_id: message.id,
			moderator_id: this.client.users.resolveID(moderator)!,
			reason: Util.encrypt(reason, this.client.config.encryptionPassword).toString('base64'),
			screenshots: JSON.stringify(screenshots),
			user_ids: JSON.stringify(users.map(user => this.client.users.resolveID(user)!))
		} as RawCase;
    
		const id = (await this.query('SELECT * FROM cases WHERE guild_id = ?', guild.id)).length + 1;

		await this.query(
			// cases table should have an auto-incrementing unique key, id
			`INSERT INTO cases (id, action, extras, guild_id, message_id, moderator_id, reason, screenshots, user_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			data.id = id,
			data.action,
			data.extras,
			data.guild_id,
			data.message_id,
			data.moderator_id,
			data.reason,
			data.screenshots,
			data.user_ids
		);
    
		return new Case(this.client, data);
	}

	public async warns(guild: Guild, caseID: number): Promise<Warn[] | null>;
	public async warns(guild: Guild, caseIDs: number[]): Promise<{ [key: number]: Warn[] | null }>;
	public async warns(guild: Guild, users: (User | Snowflake)[]): Promise<{ [key: string]: Warn[] | null }>;
	public async warns(guild: Guild, user: User | Snowflake): Promise<Warn[]>;
	public async warns(guild: Guild, caseOrUser: User | Snowflake | number | (User | Snowflake)[] | number[]): Promise<
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
			const objects = await Promise.all((caseOrUser as (number | User | Snowflake)[])
				.map((id: number | User | Snowflake) => this.warns(guild, id as number)
					.then(data => ({
						[id as string | number]: data
					}))));
			const object = Object.assign(objects[0], ...objects.slice(1)) as { [key: number]: Warn[] | null };
			return object;
		}
		if (typeof caseOrUser === 'number') {
			const rawWarns = await this.query<RawWarn>(
				'SELECT * FROM warnings WHERE case_id = ? AND guild_id = ?',
				guild.id,
				caseOrUser
			);
			if (!rawWarns.length) return null;
			return rawWarns.map(data => new Warn(this.client, data));
		}
		const userID = this.client.users.resolveID(caseOrUser)!;

		const rawWarns = await this.query<RawWarn>(
			'SELECT * FROM warnings WHERE user_id = ? AND guild_id = ?',
			guild.id, userID
		);
		if (!rawWarns.length) return null;
		return rawWarns.map(data => new Warn(this.client, data));
	}

	public async newWarn(guild: Guild, user: User | Snowflake, moderator: User | Snowflake, {
		caseID, reason, timestamp = new Date()
	}: {
		caseID: number; reason: string; timestamp?: Date;
	}) {
		const data = {
			case_id: caseID,
			guild_id: guild.id,
			id: SnowflakeUtil.generate(),
			moderator_id: this.client.users.resolveID(moderator)!,
			reason: Util.encrypt(reason, this.client.config.encryptionPassword).toString('base64'),
			timestamp,
			user_id: this.client.users.resolveID(user)!
		} as RawWarn;

		await this.query(
			// eslint-disable-next-line max-len
			'INSERT INTO warnings (id, guild_id, case_id, moderator_id, reason, user_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
			data.id,
			data.guild_id,
			data.case_id,
			data.moderator_id,
			data.reason,
			data.user_id,
			data.timestamp.toISOString()
		);

		return new Warn(this.client, data);
	}

	public async mute(all: true): Promise<Mute[]>;
	public async mute(guild: Guild, user: User | Snowflake): Promise<Mute | null>;
	public async mute(guild: Guild, users: (User | Snowflake)[]): Promise<(Mute | null)[]>;
	public async mute(guild: Guild | true, user?: User | Snowflake | (User | Snowflake)[]) {
		if (typeof guild === 'boolean'){
			const rawData = await this.query<RawMute>('SELECT * FROM mutes');
			return rawData.reduce((acc, data) => {
				const mute = new Mute(this.client, data);
				if (mute.endTimestamp < Date.now()) return acc;
				else return [...acc, mute];
			}, [] as Mute[]) as Mute[];
		}
		if (Array.isArray(user)) return Promise.all(user.map(u => this.mute(guild, u)));
		const userID = this.client.users.resolveID(user!)!;
    
		const key = `${guild.id}:${userID}`;

		if (this.client.mutes.has(key)) return this.client.mutes.get(key);

		const [data] = await this.query<RawMute>(
			'SELECT * FROM mutes WHERE user_id = ? AND guild_id = ? LIMIT 1',
			guild.id, userID
		);
		if (!data) return null;
		const mute = new Mute(this.client, data);
		if (mute.endTimestamp < Date.now()) return null;
		else return mute;
	}

	public async newMute(guild: Guild, user: User | Snowflake, start: Date, end: Date) {
		const data = {
			end,
			guild_id: guild.id,
			start,
			user_id: this.client.users.resolveID(user)
		} as RawMute;

		await this.query(
			'INSERT INTO mutes (guild_id, user_id, start, end) VALUES (?, ?, ?, ?)',
			data.guild_id,
			data.user_id,
			data.start.toISOString(),
			data.end.toISOString()
		);

		return new Mute(this.client, data);
	}

	public async deleteMute(guild: Guild, user: User | Snowflake) {
		const userID = this.client.users.resolveID(user);

		await this.query(
			'DELETE FROM mutes WHERE user_id = ? AND guild_id = ?',
			userID, guild.id
		);
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

	public async newPartnership(guild: { invite: string; id: Snowflake }, user: User | Snowflake, timestamp: Date) {
		const userID = this.client.users.resolveID(user)!;
    
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

	public async addRemoveStar(guild: Guild, messageID: Snowflake, userID: Snowflake | Snowflake[], add = true) {
		let newUsers: Snowflake[] = [];

		newUsers.push(...(Array.isArray(userID) ? userID : [userID]));

		const [{ users }] = await this.query(
			'SELECT users FROM starboard WHERE message_id = ? LIMIT 1',
			messageID
		);
		if (add) newUsers.push(...JSON.parse(users));
		else newUsers = JSON.parse(users).filter((id: Snowflake) => !newUsers.includes(id));
		await this.query(
			'UPDATE starboard SET users = ?, stars = ? WHERE message_id = ? AND guild_id = ?',
			JSON.stringify(newUsers),
			newUsers.length,
			messageID,
			guild.id
		);
		return newUsers;
	}

	public async newStar(guild: Guild, data: {
		messageID: Snowflake;
		starboardID: Snowflake;
		channelID: Snowflake;
		users: Snowflake[];
	}) {
		const rawData = {
			channel_id: data.channelID,
			guild_id: guild.id,
			message_id: data.messageID,
			starboard_id: data.starboardID,
			stars: data.users.length,
			users: JSON.stringify(data.users)
		} as RawStar;
		await this.query(
			// eslint-disable-next-line
			'INSERT INTO starboard (guild_id, message_id, starboard_id, channel_id, users, stars) VALUES (?, ?, ?, ?, ?, ?)',
			rawData.guild_id,
			rawData.message_id,
			rawData.starboard_id,
			rawData.channel_id,
			rawData.users,
			rawData.stars
		);
		return new Star(this.client, rawData);
	}

	public async stars(guild: Guild, options: { above?: number; below?: number }): Promise<Star[]>;
	public async stars(guild: Guild, messageIDs: Snowflake[]): Promise<(Star | null)>;
	public async stars(guild: Guild, messageID: Snowflake): Promise<Star | null>;
	public async stars(guild: Guild, messageID: Snowflake | { above?: number; below?: number } | Snowflake[]) {
		if (Array.isArray(messageID)) return Promise.all(messageID.map(id => this.stars(guild, id)));
		if (typeof messageID === 'object') {
			const values: [string[], string[]] = [[], []];
			if (typeof messageID.above !== 'undefined') {
				values[0].push('stars > ?');
				values[1].push(new Date(messageID.above).toISOString());
			}
			if (typeof messageID.below !== 'undefined') {
				values[0].push('stars < ?');
				values[1].push(new Date(messageID.below).toISOString());
			}
      
			values[0].push('guild_id = ?');
			values[1].push(guild.id);

			const stars = await this.query<RawStar>(
				`SELECT * FROM starboard WHERE ${values[0].join(' AND ')}`,
				...values[1]
			);
			return stars.map(data => new Star(this.client, data));
		}
    
		const [data] = await this.query<RawStar>(
			'SELECT * FROM starboard WHERE message_id = ? AND guild_id = ?',
			messageID, guild.id
		);
		if (!data) return null;
		return new Star(this.client, data);
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