import { Snowflake, SnowflakeUtil, Collection, Util as DJSUtil } from 'discord.js';
import * as mysql from 'mysql';
import CacheManager from './CacheManager';
import Client from './Client';
import { Errors, ModerationActionTypes, Defaults } from './Constants';
import { GuildMessage } from './Types';
import Util from './Util';
import Case, { RawCase } from '../structures/Case';
import Giveaway, { RawGiveaway } from '../structures/Giveaway';
import Levels, { RawLevels } from '../structures/Levels';
import Mute, { RawMute } from '../structures/Mute';
import Partnership, { RawPartnership } from '../structures/Partnership';
import Points, { RawPoints } from '../structures/Points';
import Profile, { RawProfile } from '../structures/Profile';
import Star, { RawStar } from '../structures/Star';
import Warn, { RawWarn } from '../structures/Warn';
import Guild from '../structures/discord.js/Guild';
import Message from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import User from '../structures/discord.js/User';

export enum QueryTypes {
	INSERT = 'INSERT',
	SELECT = 'SELECT',
	UPDATE = 'UPDATE',
	DELETE = 'DELETE'
}

const SQL_SEARCH_REGEX = /:(\w+)/g;
const hasOwnProperty = (obj: object, prop: string) => Object.prototype.hasOwnProperty.call(obj, prop);

export default class DatabaseManager {
	public cache: CacheManager;
	public readonly client!: Client;
	private readonly options!: DatabaseOptions;
	private rawDatabase: mysql.Connection;

	constructor(client: Client, options: DatabaseOptions) {
		DJSUtil.mergeDefault(Defaults.DATABASE_CONFIG, options);
		Object.defineProperties(this, {
			client: { value: client },
			options: { value: options }
		});
		this.cache = new CacheManager(this);
		this.rawDatabase = mysql.createConnection(options.connection);
	}

	public static formatInsert(table: string, data: SQLValues) {
		const keys = Object.keys(data);
		return `INSERT INTO ${table}(${keys.join(', ')}) VALUES(${keys.map(
			key => mysql.escape(data[key])
		).join(', ')})`;
	}

	public static format(sql: string, values: SQLValues<SQLValues>) {
		return sql.replace(SQL_SEARCH_REGEX, (text, key) => {
			if (hasOwnProperty(values, key) && values[key] !== undefined) {
				return mysql.escape(values[key]);
			}
			return text;
		});
	}

	public query(sql: QueryTypes.INSERT, table: string, values: SQLValues): Promise<mysql.OkPacket>;
	public query<T = mysql.OkPacket>(
		sql: string,
		values: SQLValues<SQLValues>,
		skipFormat?: boolean
	): Promise<T extends mysql.OkPacket ? mysql.OkPacket : T[]>
	public query<T = mysql.OkPacket>(
		sql: string,
		...values: SQLDataType<{ [key: string]: SQLDataType }>[]
	): Promise<T extends mysql.OkPacket ? mysql.OkPacket : T[]>;
	public query<T = mysql.OkPacket>(sql: string, ...params: unknown[]) {
		if (
			(params.length === 1 || (params.length === 2 && params[1] !== true)) &&
			typeof params[0] == 'object' && params[0] !== null
		) {
			sql = DatabaseManager.format(sql, params[0] as SQLValues<SQLValues>);
			params = [];
		} else if (sql === QueryTypes.INSERT) {
			sql = DatabaseManager.formatInsert(params[0] as string, params[1] as SQLValues);
			params = [];
		}
		return new Promise<T[] | mysql.OkPacket>((resolve, reject) => {
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

	public async editPoints(
		user: User | Snowflake,
		data: Partial<Omit<RawPoints, 'user_id' | 'last_daily'> & { daily: boolean | Date }>
	) {
		data = DJSUtil.cloneObject(data);
		const userID = this.client.users.resolveID(user)!;
		const existing = await this.points(userID);

		const values: SQLValues = {};

		if (typeof data.amount === 'number') {
			if (data.amount < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('points'));
			values.amount = data.amount;
		}
		if (typeof data.vault === 'number') {
			if (data.vault < 0) throw new RangeError(Errors.NEGATIVE_NUMBER('vault'));
			values.vault = data.vault;
		}
		if (typeof data.daily === 'boolean' || data.daily instanceof Date) {
			const date = typeof data.daily === 'boolean'
				? new Date()
				: new Date(data.daily);
			(data as RawPoints).last_daily = date;
			data.daily = undefined;
		}

		existing.patch(data as Partial<RawPoints>);

		await this.query(
			'UPDATE points SET :data WHERE user_id = :userID',
			{ data: values, userID }
		);
		return existing;
	}

	public async points(user: User | Snowflake): Promise<Points>;
	public async points(users: (User | Snowflake)[]): Promise<Collection<Snowflake, Points>>;
	public async points(user: User | Snowflake | (User | Snowflake)[]) {
		if (Array.isArray(user)) {
			const points = await Promise.all(user.map(_user => this.points(_user)));
			return points.reduce(
				(collection, next) => collection.set(next.userID, next),
				new Collection<Snowflake, Points>()
			);
		}
		const userID = this.client.users.resolveID(user)!;

		if (this.cache.points.has(userID)) return this.cache.points.get(userID);
		
		const [data] = await this.query<RawPoints>(
			'SELECT * FROM points WHERE user_id = :userID LIMIT 1',
			{ userID }
		);
		if (!data) {
			await this.query(
				QueryTypes.INSERT,
				'points',
				{ user_id: userID }
			);
			return this.points(userID);
		}
		const constructed = new Points(this.client, data);
		this.cache.points.set(constructed.userID, constructed);
		return constructed;
	}

	public async editLevels(user: User | Snowflake, data: Partial<Omit<RawLevels, 'user_id'>>) {
		data = DJSUtil.cloneObject(data);
		const userID = this.client.users.resolveID(user)!;

		const existing = await this.levels(userID);

		if (typeof data.xp === 'number') {
			data.level = 0;
			while (Levels.levelCalc(data.level) < data.xp) data.level++;
		} else if (typeof data.level === 'number') {
			data.xp = Levels.levelCalc(data.level) + 1;
		}

		if (typeof data.level !== 'number' || typeof data.xp !== 'number') {
			throw new TypeError(Errors.INVALID_TYPE('level\' or \'xp', 'number'));
		}
		if (data.level < 0 || data.xp < 0) {
			throw new RangeError(Errors.NEGATIVE_NUMBER(data.level < 0 ? 'level' : 'xp'));
		}

		existing.patch(data as Partial<RawLevels>);

		await this.query('UPDATE levels SET :data WHERE user_id = :userID', {
			data: { level: data.level, xp: data.xp },
			userID
		});
		return existing;
	}

	public async levels(top: number): Promise<Collection<Snowflake, Levels>>;
	public async levels(user: User | Snowflake): Promise<Levels>;
	public async levels(users: (User | Snowflake)[]): Promise<Collection<Snowflake, Levels>>;
	public async levels(user: User | Snowflake | (User | Snowflake)[] | number) {
		if (Array.isArray(user)) {
			const levels = await Promise.all(user.map(u => this.levels(u)));
			return levels.reduce(
				(collection, next) => collection.set(next.userID, next),
				new Collection<Snowflake, Levels>()
			);
		}
		if (typeof user === 'number') {
			const topLevels = await this.query<RawLevels>(
				'SELECT * FROM levels ORDER by xp desc LIMIT ?',
				user
			);
			return topLevels.reduce((collection, next) => {
				const constructed = this.cache.levels.get(next.user_id) || new Levels(this.client, next);
				this.cache.levels.set(constructed.userID, constructed);
				return collection.set(constructed.userID, constructed);
			}, new Collection<Snowflake, Levels>());
		}
		const userID = this.client.users.resolveID(user)!;

		if (this.cache.levels.has(userID)) return this.cache.levels.get(userID);

		const [data] = await this.query<RawLevels>(
			'SELECT * FROM levels WHERE user_id = :userID LIMIT 1',
			{ userID }
		);
		if (!data) {
			await this.query(
				QueryTypes.INSERT,
				'levels',
				{ user_id: userID }
			);
			return this.levels(user);
		}
		const constructed = new Levels(this.client, data);
		this.cache.levels.set(constructed.userID, constructed);
		return constructed;
	}

	public async deleteCase(guild: Guild, id: number) {
		const key = `${guild.id}:${id}`;
		const existing = this.cache.cases.get(key);
		if (existing) {
			if (existing.action === 'WARN') {
				await this.deleteWarn(id, guild);
			}
			this.cache.cases.delete(key);
		} else {
			const [{ action }] = await this.query<{ action: keyof typeof ModerationActionTypes }>(
				'SELECT action FROM cases WHERE guild_id = :guildID AND id = :id',
				{ guildID: guild.id, id }
			);
			if (action === 'WARN') {
				await this.deleteWarn(id, guild);
			}
		}
		const { affectedRows } = await this.query(
			'DELETE FROM cases WHERE id = :id AND guild_id = :guildID',
			{ guildID: guild.id, id }
		);
		return affectedRows === 1;
	}

	public async case(guild: Guild, options: CaseQueryOptions): Promise<Collection<number, Case>>;
	public async case(guild: Guild, id: number): Promise<Case | null>;
	public async case(guild: Guild, ids: number[]): Promise<Collection<number, Case | null>>;
	public async case(
		guild: Guild,
		id: number | number[] | CaseQueryOptions
	) {
		if (Array.isArray(id)) {
			const cases = await Promise.all(id.map(_id => {
				return this.case(guild, _id).then(
					_case => ({ case: _case, id: _id })
				);
			}));
			return cases.reduce(
				(collection, next) => collection.set(next.id, next.case),
				new Collection<number, Case | null>()
			);
		}
		if (typeof id === 'object') {
			const values: SQLValues = {
				guildID: guild.id
			};
			let sql = 'SELECT * FROM cases WHERE guild_id = :guildID';
			if (typeof id.after !== 'undefined') {
				values.after = id.after;
				sql += ` AND ${typeof id.after === 'number' ? 'id' : 'timestamp'} > :after`;
			}
			if (typeof id.before !== 'undefined') {
				values.before = id.before;
				sql += ` AND ${typeof id.before === 'number' ? 'id' : 'timestamp'} > :before`;
			}

			const cases = await this.query<RawCase>(sql, values);
			return cases.reduce((collection, next) => {
				const key = `${guild.id}:${next.id}`;
				const constructed = this.cache.cases.get(key) || new Case(this.client, next);
				this.cache.cases.set(key, constructed);
				return collection.set(constructed.id, constructed);
			}, new Collection<number, Case>());
		}
		const key = `${guild.id}:${id}`;
		if (this.cache.cases.has(key)) return this.cache.cases.get(key);
		const [data] = await this.query<RawCase>(
			'SELECT * FROM cases WHERE id = :id AND guild_id = :guildID LIMIT 1',
			{ guildID: guild.id, id }
		);
		if (!data) return null;
		const constructed = new Case(this.client, data);
		this.cache.cases.set(key, constructed);
		return constructed;
	}

	public async editCase(
		guild: Guild,
		id: number,
		data: CaseEditData
	) {
		const values: SQLValues = {};
		const hasReason = typeof data.reason === 'string';
		if (typeof data.action === 'string') {
			values.action = data.action;
		}
		if (typeof data.extras !== 'undefined') {
			values.extras = typeof data.extras === 'string'
				? data.extras : JSON.stringify(data.extras);
		}
		if (typeof data.message !== 'undefined') {
			values.message_id = typeof data.message === 'string'
				? data.message : data.message.id;
		}
		if (typeof data.moderator !== 'undefined') {
			values.moderator_id = typeof data.moderator === 'string'
				? data.moderator : data.moderator.id;
		}
		if (hasReason) {
			values.reason = this.encrypt(data.reason!);
		}
		if (typeof data.screenshots !== 'undefined') {
			values.screenshots = typeof data.screenshots === 'string'
				? data.screenshots : JSON.stringify(data.screenshots);
		}
		if (typeof data.users !== 'undefined') {
			values.user_ids = typeof data.users === 'string'
				? data.users : JSON.stringify(data.users.map(id => this.client.users.resolveID(id)!));
		}
		const existing = this.cache.cases.get(`${guild.id}:${id}`);
		if (existing) {
			if (existing.action === 'WARN' && hasReason) {
				await this.editWarn(id, { reason: data.reason! }, guild);
			}
			existing.patch(values as unknown as RawCase);
		} else if (hasReason) {
			const [{ action }] = await this.query<{ action: keyof typeof ModerationActionTypes }>(
				'SELECT action FROM cases WHERE guild_id = :guildID AND id = :id',
				{ guildID: guild.id, id }
			);
			if (action === 'WARN') {
				await this.editWarn(id, { reason: data.reason! }, guild);
			}
		}
		await this.query(
			'UPDATE cases SET :data WHERE guild_id = :guildID AND id = :id', {
				data: values,
				guildID: guild.id,
				id
			}
		);
	}

	public async createCase(data: CaseCreateData) {
		const values: SQLValues = {
			action: data.action,
			extras: typeof data.extras === 'object'
				? JSON.stringify(data.extras) : data.extras || '{}',
			guild_id: this.client.guilds.resolveID(data.guild)!,
			message_id: typeof data.message === 'string'
				? data.message : data.message.id,
			moderator_id: this.client.users.resolveID(data.moderator),
			reason: this.encrypt(data.reason),
			screenshots: Array.isArray(data.screenshots)
				? JSON.stringify(data.screenshots)
				: data.screenshots || '[]',
			user_ids: typeof data.users === 'string'
				? data.users
				: JSON.stringify(data.users.map(userOrId => this.client.users.resolveID(userOrId)!))
		};
		const [{ id }] = await this.query<{ id: number }>(
			'SELECT COUNT(*) + 1 AS id FROM cases WHERE guild_id = :guildID',
			{ guildID: values.guild_id }
		);
		values.id = id;
		await this.query(QueryTypes.INSERT, 'cases', values);
		const constructed = new Case(this.client, values as unknown as RawCase);
		this.cache.cases.set(`${constructed.guildID}:${constructed.id}`, constructed);
		return constructed;
	}
	
	public async warns(guild: Guild, options: TimeQueryOptions): Promise<Collection<string, Warn>>;
	public async warns(guild: Guild, user: User | Snowflake): Promise<Warn[]>;
	public async warns(guild: Guild, users: (User | Snowflake)[]): Promise<Collection<Snowflake, Warn[]>>;
	public async warns(guild: Guild, caseID: number): Promise<Collection<Snowflake, Warn[]>>;
	public async warns(guild: Guild, caseIDs: number[]): Promise<Collection<number, Warn[]>>;
	public async warns(
		guild: Guild,
		caseOrUser: User | Snowflake | number | (User | Snowflake)[] | number[] | TimeQueryOptions
	) {
		if (Array.isArray(caseOrUser)) {
			const warns = await Promise.all([...caseOrUser]
				.map(_caseOrUser => typeof _caseOrUser === 'number'
					? this.warns(guild, _caseOrUser) : this.warns(guild, _caseOrUser)
				) as Promise<Warn[] | Collection<number, Warn[]>>[]
			);
			return warns.reduce((collection, next) => {
				if (next instanceof Collection) {
					return collection.concat(next);
				}
				for (const warn of next) {
					if (collection.has(warn.userID)) {
						collection.get(warn.userID)!.push(warn);
					} else {
						collection.set(warn.userID, [warn]);
					}
				}
				return collection;
			}, new Collection<Snowflake | number, Warn[]>());
		}
		if (typeof caseOrUser === 'object' && !(caseOrUser instanceof User)) {
			const warns = await this.query<RawWarn>(
				'SELECT * FROM warnings WHERE timestamp > :after AND timestamp < :before LIMIT :limit', {
					after: caseOrUser.after ?? new Date(0),
					before: caseOrUser.before ?? new Date(),
					limit: caseOrUser.limit ?? 10e3
				}
			);
			return warns.reduce((collection, next) => {
				const constructed = this.cache.warnings.get(next.id) || new Warn(this.client, next);
				this.cache.warnings.set(constructed.id, constructed);
				return collection.set(constructed.id, constructed);
			}, new Collection<string, Warn>());
		}
		if (typeof caseOrUser === 'number') {
			const warns = await this.query<RawWarn>(
				'SELECT * FROM warnings WHERE case_id = :caseID',
				{ caseID: caseOrUser }
			);
			return warns.reduce((collection, next) => {
				const constructed = this.cache.warnings.get(next.id) || new Warn(this.client, next);
				this.cache.warnings.set(constructed.id, constructed);
				if (collection.has(constructed.caseID)) {
					collection.get(constructed.caseID)!.push(constructed);
				} else {
					collection.set(constructed.caseID, [constructed]);
				}
				return collection;
			}, new Collection<number, Warn[]>());
		}
		const warns = await this.query<RawWarn>(
			'SELECT * FROM warnings WHERE user_id = :userID',
			{ userID: this.client.users.resolveID(caseOrUser)! }
		);
		return warns.map(data => {
			const constructed = this.cache.warnings.get(data.id) || new Warn(this.client, data);
			this.cache.warnings.set(constructed.id, constructed);
			return constructed;
		});
	}

	public async createWarn(data: WarnCreateData) {
		const values: SQLValues = {
			case_id: typeof data.case === 'number'
				? data.case : data.case.id,
			guild_id: this.client.guilds.resolveID(data.guild)!,
			id: SnowflakeUtil.generate(),
			moderator_id: this.client.users.resolveID(data.moderator)!,
			reason: this.encrypt(data.reason),
			timestamp: data.timestamp ?? new Date(),
			user_id: this.client.users.resolveID(data.user)!
		};

		await this.query(QueryTypes.INSERT, 'warnings', values);

		const constructed = new Warn(this.client, values as unknown as RawWarn);
		this.cache.warnings.set(constructed.id, constructed);
		return constructed;
	}

	public async mute(all: true): Promise<Collection<Snowflake, Collection<Snowflake, Mute>>>;
	public async mute(guild: Guild, user: User | Snowflake): Promise<Mute | null>;
	public async mute(guild: Guild, users: (User | Snowflake)[]): Promise<Collection<Snowflake, Mute | null>>;
	public async mute(guild: Guild | true, user?: User | Snowflake | (User | Snowflake)[]) {
		if (typeof guild === 'boolean') {
			const rawMutes = await this.query<RawMute>('SELECT * FROM mutes');
			return rawMutes.reduce((collection, next) => {
				const key = `${next.guild_id}:${next.user_id}`;
				const constructed = this.cache.mutes.get(key) || new Mute(this.client, next);
				if (constructed.endTimestamp < Date.now()) {
					constructed.unmute()
						.catch(error => this.client.emit('error', error));
					return collection;
				}
				this.cache.mutes.set(key, constructed);
				let guildMutes = collection.get(constructed.guildID);
				if (!guildMutes) {
					collection.set(
						constructed.guildID,
						guildMutes = new Collection<Snowflake, Mute>()
					);
				}
				guildMutes.set(constructed.userID, constructed);
				return collection;
			}, new Collection<Snowflake, Collection<Snowflake, Mute>>());
		}
		if (Array.isArray(user)) {
			const mutes = await Promise.all(user.map(_user => {
				return this.mute(guild, _user).then(
					mute => ({ mute, user: this.client.users.resolveID(_user)! })
				);
			}));
			return mutes.reduce(
				(collection, next) => collection.set(next.user, next.mute),
				new Collection<Snowflake, Mute | null>()
			);
		}
		const userID = this.client.users.resolveID(user!)!;
		const key = `${guild.id}:${userID}`;

		if (this.cache.mutes.has(key)) return this.cache.mutes.get(key);

		const [data] = await this.query<RawMute>(
			'SELECT * FROM mutes WHERE user_id = :userID AND guild_id = :guildID LIMIT 1', {
				guildID: guild.id,
				userID
			}
		);
		if (!data) return null;
		const constructed = new Mute(this.client, data);
		if (constructed.endTimestamp < Date.now()) {
			await constructed.unmute();
			await this.deleteMute(guild, userID);
			return null;
		}
		this.cache.mutes.set(key, constructed);
		return constructed;
		
	}

	public async createMute(data: MuteCreateData) {
		const values: SQLValues = {
			end: data.endDate,
			guild_id: this.client.guilds.resolveID(data.guild),
			start: data.start,
			user_id: this.client.users.resolveID(data.user)
		};

		await this.query(QueryTypes.INSERT, 'mutes', values);

		const constructed = new Mute(this.client, values as unknown as RawMute);
		this.cache.mutes.set(`${constructed.guildID}:${constructed.userID}`, constructed);
		return constructed;
	}

	public async deleteMute(guild: Guild, user: User | Snowflake) {
		const userID = this.client.users.resolveID(user);
		this.cache.mutes.delete(`${guild.id}:${userID}`);
		const { affectedRows } = await this.query(
			'DELETE FROM mutes WHERE user_id = :userID AND guild_id = :guildID', {
				guildID: guild.id,
				userID
			}
		);
		return affectedRows;
	}

	public async partnershipCounts(
		options: TimeQueryOptions & { limit?: number }
	): Promise<{ count: number; userID: Snowflake }[]>;
	public async partnershipCounts(
		user: (User | Snowflake)[],
		options?: TimeQueryOptions
	): Promise<Collection<Snowflake, number | null>>;
	public async partnershipCounts(user: User | Snowflake, options?: TimeQueryOptions): Promise<number | null>;
	public async partnershipCounts(
		user:
			| User | Snowflake
			| (User | Snowflake)[]
			| TimeQueryOptions & { limit?: number },
		options?: TimeQueryOptions
	) {
		if (Array.isArray(user)) {
			const counts = await Promise.all(user.map(id => this.partnershipCounts(id, options).then(num => ({
				count: num,
				id: this.client.users.resolveID(id)!
			}))));
			return counts.reduce(
				(collection, next) => collection.set(next.id, next.count),
				new Collection<Snowflake, number | null>()
			);
		}
		if (user instanceof User || typeof user === 'string') {
			const id = this.client.users.resolveID(user);
			const [data] = await this.client.database.query<{ count: number }>(
				'SELECT COUNT(*) as count FROM partnerships \
WHERE user_id = :userID AND timestamp < :before AND timestamp > :after', {
					after: options?.after ?? new Date(0),
					before: options?.before ?? new Date(),
					userID: id
				}
			);
			return data ? data.count : null;
		}
		const values: SQLValues = {
			after: user.after ?? new Date(0),
			before: user.before ?? new Date(),
			limit: user.limit ?? 10e3
		};
		const counts = await this.client.database.query<{ count: number; userID: Snowflake }>(
			'SELECT COUNT(*) as count, user_id as userID FROM partnerships \
WHERE timestamp < :before AND timestamp > :after \
GROUP BY user_id ORDER BY count desc LIMIT :limit',
			values
		);
		return counts;
	}

	public async partnerships(options: TimeQueryOptions): Promise<Partnership[]>;
	public async partnerships(guild: Snowflake[]): Promise<Collection<Snowflake, Partnership[]>>;
	public async partnerships(guild: Snowflake): Promise<Partnership[]>;
	public async partnerships(guild: Snowflake | Snowflake[] | TimeQueryOptions) {
		if (Array.isArray(guild)) {
			const partnerships = await Promise.all(guild.map(id => this.partnerships(id)));
			return partnerships.reduce((collection, next) => {
				for (const partnership of next) {
					if (!collection.has(partnership.guildID)) {
						collection.get(partnership.guildID)!.push(partnership);
					} else {
						collection.set(partnership.guildID, [partnership]);
					}
				}
				return collection;
			}, new Collection<Snowflake, Partnership[]>());
		}
		if (typeof guild === 'string') {
			const partnerships = await this.query<RawPartnership>(
				'SELECT * FROM partnerships WHERE guild_id = :idOrInvite OR guild_invite = :idOrInvite',
				{ idOrInvite: guild }
			);
			return partnerships.map(
				data => this.cache.partnerships.get(data.timestamp.getTime()) || new Partnership(this.client, data)
			);
		}
		const before = new Date(guild.before ? guild.before : Date.now());
		const after = new Date(guild.after ? guild.after : 0);
		const partnerships = await this.query<RawPartnership>(
			'SELECT * FROM partnerships WHERE timestamp < :before AND timestamp > :after LIMIT :limit',
			{ after, before, limit: guild.limit ?? 10e3 }
		);
		return partnerships.map(data => {
			const constructed =
				this.cache.partnerships.get(data.timestamp.getTime()) || new Partnership(this.client, data);
			this.cache.partnerships.set(constructed.postedTimestamp, constructed);
			return constructed;
		});
	}

	public async createPartnership(data: {
		guild: { id: Snowflake; invite: string };
		timestamp: Date;
		user: User | Snowflake;
	}) {
		const values: SQLValues = {
			guild_id: data.guild.id,
			guild_invite: data.guild.invite,
			timestamp: data.timestamp,
			user_id: this.client.users.resolveID(data.user)
		};

		await this.query(QueryTypes.INSERT, 'partnerships', values);

		const constructed = new Partnership(this.client, values as unknown as RawPartnership);
		this.cache.partnerships.set(constructed.postedTimestamp, constructed);
		return constructed;
	}

	public async editStar(message: GuildMessage | Snowflake, data: StarEditData) {
		const values: SQLValues = {};
		if (typeof data.starboardMessage !== 'undefined') {
			values.starboard_id = typeof data.starboardMessage === 'string'
				? data.starboardMessage : data.starboardMessage.id;
		}
		if (typeof data.users !== 'undefined') {
			values.users = typeof data.users === 'string'
				? data.users
				: JSON.stringify(data.users.map(id => this.client.users.resolveID(id)!));
			values.stars = data.users.length;
		}
		const messageID = typeof message === 'string' ? message : message.id;
		const existing = this.cache.stars.get(messageID);
		if (existing) existing.patch(values);
		await this.query('UPDATE starboard SET :data WHERE message_id = :messageID', {
			data: values,
			messageID
		});
	}

	public async createStar(data: StarCreateData) {
		const values: SQLValues = {
			author_id: data.message.author.id,
			channel_id: this.client.channels.resolveID(data.channel)!,
			guild_id: this.client.guilds.resolveID(data.guild)!,
			message_id: data.message.id,
			starboard_id: typeof data.starboardMessage === 'string'
				? data.starboardMessage : data.starboardMessage.id,
			stars: data.users.length,
			timestamp: new Date(),
			users: JSON.stringify(data.users.map(user => this.client.users.resolveID(user)))
		};

		await this.query(QueryTypes.INSERT, 'starboard', values);

		const constructed = new Star(this.client, values as unknown as RawStar);
		this.cache.stars.set(constructed.messageID, constructed);
		return constructed;
	}

	public async stars(
		guild: Guild,
		options: StarQueryOptions
	): Promise<Collection<Snowflake, Star>>;
	public async stars(
		guild: Guild,
		messages: (User | Message | Snowflake)[]
	): Promise<Collection<Snowflake, Star | null>>;
	public async stars(guild: Guild, message: User | Message | Snowflake): Promise<Star | null>;
	public async stars(
		guild: Guild,
		message: User | Message | Snowflake | StarQueryOptions | (User | Message | Snowflake)[]
	) {
		if (Array.isArray(message)) {
			const stars = await Promise.all(message.map(
				id => this.stars(guild, id).then(star => ({
					id: typeof id === 'string' ? id : id.id,
					star
				}))
			));
			return stars.reduce(
				(collection, next) => collection.set(next.id, next.star),
				new Collection<Snowflake, Star | null>()
			);
		}
		if (typeof message === 'object' && !(message instanceof Message) && !(message instanceof User)) {
			let sql =
				'SELECT * FROM starboard WHERE guild_id = :guildID AND timestamp > :after AND timestamp < :before';
			if (typeof message.above === 'number') {
				sql += ` AND stars > ${mysql.escape(message.above)}`;
			}
			if (typeof message.below === 'number') {
				sql += ` AND stars < ${mysql.escape(message.below)}`;
			}
			sql += ' LIMIT :limit';
			const stars = await this.query<RawStar>(sql, {
				after: message.after ?? new Date(),
				before: message.before ?? new Date(0),
				guildID: guild.id,
				limit: message.limit ?? 10e3
			});
			return stars.reduce((collection, next) => {
				const constructed = this.cache.stars.get(next.message_id) || new Star(this.client, next);
				this.cache.stars.set(constructed.messageID, constructed);
				return collection.set(constructed.messageID, constructed);
			}, new Collection<Snowflake, Star>());
		}

		const messageID = typeof message === 'string'
			? message : message.id;

		if (this.cache.stars.has(messageID)) return this.cache.stars.get(messageID);
		
		const [data] = await this.query<RawStar>(
			'SELECT * FROM starboard WHERE (\
message_id = :messageID OR author_id = :messageID\
) AND guild_id = :guildID', {
				guildID: this.client.guilds.resolveID(guild.id)!,
				messageID
			}
		);
		if (!data) return null;
		const constructed = new Star(this.client, data);
		this.cache.stars.set(constructed.messageID, constructed);
		return constructed;
	}
	
	public async profile(user: User | Snowflake): Promise<Profile>;
	public async profile(user: (User | Snowflake)[]): Promise<Collection<Snowflake, Profile>>;
	public async profile(user: User | Snowflake | (User | Snowflake)[]) {
		if (Array.isArray(user)) {
			const profiles = await Promise.all(user.map(u => this.profile(u)));
			return profiles.reduce(
				(collection, next) => collection.set(next.userID, next),
				new Collection<Snowflake, Profile>()
			);
		}
		const userID = this.client.users.resolveID(user)!;

		if (this.cache.profiles.has(userID)) return this.cache.profiles.get(userID);

		const [data] = await this.query<RawProfile>(
			'SELECT * FROM profiles WHERE user_id = :userID LIMIT 1',
			{ userID }
		);
		if (!data) {
			await this.query(QueryTypes.INSERT, 'profiles', {
				description: this.encrypt('No description'),
				user_id: userID
			});
			return this.profile(userID);
		}
		
		const constructed = new Profile(this.client, data);
		this.cache.profiles.set(constructed.userID, constructed);
		return constructed;
	}
	
	public async editProfile(user: User | Snowflake, data: Partial<Omit<RawProfile, 'user_id'>>) {
		if (data.description) {
			data.description = this.encrypt(data.description);
		}
		const userID = this.client.users.resolveID(user)!;

		const values: SQLValues = {};
		if (typeof data.description === 'string') {
			values.description = this.encrypt('No description');
		}
		if (typeof data.reputation === 'number') {
			values.reputation = data.reputation;
		}
		const existing = this.cache.profiles.get(userID);
		if (existing) existing.patch(data);
		await this.query(
			'UPDATE profiles SET :data WHERE user_id = :userID',
			{ data: values, userID }
		);
	}

	public async giveaway(id: Snowflake): Promise<Giveaway | null>;
	public async giveaway(id: Snowflake, all: true): Promise<Collection<Snowflake, Giveaway>>;
	public async giveaway(all: true): Promise<Collection<Snowflake, Giveaway>>;
	public async giveaway(id: Snowflake | true, all?: true) {
		if (id === true) {
			const giveaways = await this.query<RawGiveaway>('SELECT * FROM giveaways WHERE winners IS NULL');
			return giveaways.reduce((collection, next) => {
				const constructed = this.cache.giveaways.get(next.message_id) || new Giveaway(this.client, next);
				if (constructed.endTimestamp < Date.now()) {
					constructed.end()
						.catch(error => this.client.emit('error', error));
				}
				this.cache.giveaways.set(constructed.messageID, constructed);
				return collection.set(constructed.messageID, constructed);
			}, new Collection<Snowflake, Giveaway>());
		}
		if (this.client.channels.cache.has(id)) {
			const giveaways = await this.query<RawGiveaway>(
				`SELECT * FROM giveaways WHERE channel_id = :channelID ORDER BY start desc${all ? '' : ' LIMIT 1'}`,
				{ channelID: id }
			);
			if (!giveaways.length) throw new Error(Errors.NO_GIVEAWAYS_IN_CHANNEL(id));
			if (all) {
				return giveaways.reduce((collection, next) => {
					const constructed = this.cache.giveaways.get(next.message_id) || new Giveaway(this.client, next);
					if (constructed.endTimestamp < Date.now()) {
						constructed.end()
							.catch(error => this.client.emit('error', error));
					}
					this.cache.giveaways.set(constructed.messageID, constructed);
					return collection.set(constructed.messageID, constructed);
				}, new Collection<Snowflake, Giveaway>());
			}
			const constructed =
				this.cache.giveaways.get(giveaways[0].message_id) || new Giveaway(this.client, giveaways[0]);
			this.cache.giveaways.set(constructed.messageID, constructed);
			return constructed;
		} else {
			if (this.cache.giveaways.has(id)) return this.cache.giveaways.get(id);
			const [data] = await this.query<RawGiveaway>(
				'SELECT * FROM giveaways WHERE message_id = :messageID LIMIT 1',
				{ messageID: id }
			);
			if (!data) return null;
			const constructed = new Giveaway(this.client, data);
			if (constructed.endTimestamp < Date.now()) {
				await constructed.end();
			}
			this.cache.giveaways.set(constructed.messageID, constructed);
			return constructed;
		}
	}

	public async editGiveaway(id: Message | Snowflake, data: GiveawayEditData) {
		const values: SQLValues = {};
		if (typeof data.messageRequirement === 'number') {
			values.message_requirement = data.messageRequirement;
		}
		if (typeof data.prize === 'string') {
			values.prize = this.encrypt(data.prize);
		}
		if (typeof data.winners !== 'undefined') {
			values.winners = typeof data.winners === 'string'
				? data.winners
				: JSON.stringify(data.winners.map(user => this.client.users.resolveID(user)!));
		}
		if (typeof data.requirement === 'string') {
			values.requirement = this.encrypt(data.requirement);
		}
		const messageID = typeof id === 'string' ? id : id.id;
		const existing = this.cache.giveaways.get(messageID);
		if (existing) existing.patch(values);
		await this.query('UPDATE giveaways SET :data WHERE message_id = :messageID', {
			data: values,
			messageID
		});
	}

	public async createGiveaway(data: GiveawayCreateData) {
		const values: SQLValues = {
			channel_id: data.message.channel.id,
			created_by: this.client.users.resolveID(data.createdBy),
			end: new Date(data.endAt),
			message_id: data.message.id,
			message_requirement: data.messageRequirement ?? null,
			prize: this.encrypt(data.prize),
			start: new Date(),
			winners: null
		};
		await this.query(QueryTypes.INSERT, 'giveaways', values);
		const constructed = new Giveaway(this.client, values as unknown as RawGiveaway);
		this.cache.giveaways.set(constructed.messageID, constructed);
		return constructed;
	}

	public async editWarn(id: number, data: WarnEditOptions, guild: Guild): Promise<void>;
	public async editWarn(id: Snowflake, data: WarnEditOptions): Promise<void>;
	public async editWarn(id: number | Snowflake, data: WarnEditOptions, guild?: Guild) {
		const values: SQLValues = {};
		if (typeof data.caseID === 'number') {
			values.case_id = data.caseID;
		}
		if (typeof data.reason === 'string') {
			values.reason = this.encrypt(data.reason);
		}
		const isNumber = typeof id === 'number';
		const cache = this.cache.warnings;
		if (isNumber) {
			for (const warn of cache.values()) {
				if (warn.caseID === id && warn.guildID === guild!.id) warn.patch(values);
			}
		} else {
			const warn = cache.get(id as string);
			if (warn) warn.patch(values);
		}
		let sql = `UPDATE warnings SET :data WHERE ${mysql.escapeId(isNumber ? 'case_id' : 'id')} = :id`;
		if (isNumber) {
			sql += ` AND guild_id = ${mysql.escape(guild!.id)}`;
		}
		await this.query(sql, { data: values, id });
	}

	private async deleteWarn(id: number, guild: Guild): Promise<number>
	private async deleteWarn(id: Snowflake): Promise<number>;
	private async deleteWarn(id: number | Snowflake, guild?: Guild) {
		const isNumber = typeof id === 'number';
		let sql = `DELETE FROM warnings WHERE ${mysql.escapeId(isNumber ? 'case_id' : 'id')} = :id`;
		if (isNumber) {
			sql += ` AND guild_id = ${mysql.escape(guild!.id)}`;
		}
		const { affectedRows } = await this.client.database.query(sql, { id });
		const cache = this.cache.warnings;
		if (isNumber) {
			for (const warn of cache.values()) {
				if (warn.caseID === id && warn.guildID === guild!.id) cache.delete(warn.id);
			}
		} else cache.delete(id as string);
		return affectedRows;
	}

	private encrypt(string: string) {
		return Util.encrypt(string, this.client.config.encryptionPassword).toString('base64');
	}
}

interface WarnEditOptions {
	caseID?: number;
	reason?: string;
}

export interface DatabaseOptions {
	cacheSweepInterval?: number;
	connection: mysql.ConnectionConfig;
	maxCacheSize?: number;
}

interface CaseCreateData {
	action: keyof typeof ModerationActionTypes;
	extras?: { [key: string]: string } | string;
	guild: Guild | Snowflake;
	message: GuildMessage<true> | Snowflake;
	moderator: User | Snowflake;
	reason: string;
	screenshots?: string[] | string;
	users: (User | Snowflake)[] | string;
}

interface CaseQueryOptions {
	after?: Date | number;
	before?: Date | number;
}

type CaseEditData = Partial<Omit<CaseCreateData, 'guild'>>

interface GiveawayCreateData {
	createdBy: User | Snowflake;
	endAt: Date;
	message: GuildMessage<true>;
	messageRequirement?: number;
	prize: string;
}

interface GiveawayEditData {
	messageRequirement?: number;
	prize?: string;
	requirement?: string;
	winners?: (User | Snowflake)[] | string;
}

interface MuteCreateData {
	endDate: Date;
	guild: Guild | Snowflake;
	start: Date;
	user: User | Snowflake;
}

type SQLDataType<E = never> = number | Date | string | null | E;

interface SQLValues<E = never> {
	[key: string]: SQLDataType | E;
}

interface StarCreateData {
	channel: TextChannel | Snowflake;
	guild: Guild | Snowflake;
	message: GuildMessage;
	starboardMessage: GuildMessage<true> | Snowflake;
	users: (Snowflake | User)[];
}

interface StarQueryOptions extends TimeQueryOptions {
	above?: number;
	below?: number;
}

interface StarEditData {
	starboardMessage?: GuildMessage | Snowflake;
	users?: (Snowflake | User)[] | string;
}

interface TimeQueryOptions {
	after?: Date;
	before?: Date;
	limit?: number;
}

interface WarnCreateData {
	case: Case | number;
	guild: Guild | Snowflake;
	moderator: User | Snowflake;
	reason: string;
	timestamp?: Date;
	user: User | Snowflake;
}
