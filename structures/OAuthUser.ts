import { Client, SnowflakeUtil, User, UserFlags } from 'discord.js';

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

	public avatarURL(...args: Parameters<User['avatarURL']>) {
		return User.prototype.avatarURL.call(this, ...args);
	}

	public displayAvatarURL(...args: Parameters<User['avatarURL']>) {
		return User.prototype.displayAvatarURL.call(this, ...args);
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