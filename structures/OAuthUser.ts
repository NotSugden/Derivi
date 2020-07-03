import { UserFlags, SnowflakeUtil, ImageURLOptions } from 'discord.js';
import User from './discord.js/User';
import Client from '../util/Client';

export default class OAuthUser {
	public readonly client!: Client;
	public id: string;
	public username: string;
	public avatar: string;
	public discriminator: string;
	public publicFlags: UserFlags;
	public flags: UserFlags;
	public readonly email!: string | null;
	public verified: boolean | null;
	public locale: string;
	public mfaEnabled: boolean;

	constructor(client: Client, data: RawOAuthUser) {
		this.id = data.id;
		this.username = data.username;
		this.avatar = data.avatar;
		this.discriminator = data.discriminator;
		this.publicFlags = new UserFlags(data.public_flags || 0);
		this.flags = new UserFlags(data.flags || 0);
		this.verified = data.verified ?? null;
		this.locale = data.locale;
		this.mfaEnabled = data.mfa_enabled;

		// this is so the email is not enumerable, to prevent accidental leak via eval and such
		Object.defineProperties(this, {
			client: { value: client },
			email: { value: data.email ?? null }
		});
	}

	get createdAt() {
		return new Date(this.createdTimestamp);
	}

	get createdTimestamp() {
		return SnowflakeUtil.deconstruct(this.id).timestamp;
	}

	public avatarURL(options?: ImageURLOptions & { dynamic: boolean }) {
		return User.prototype.avatarURL.call(this, options);
	}

	public displayAvatarURL(options?: ImageURLOptions & { dynamic: boolean }) {
		return User.prototype.displayAvatarURL.call(this, options);
	}
}

interface RawOAuthUser {
	id: string;
	username: string;
	avatar: string;
	discriminator: string;
	public_flags: number;
	flags: number;
	email?: string;
	verified?: boolean;
	locale: string;
	mfa_enabled: boolean;
}