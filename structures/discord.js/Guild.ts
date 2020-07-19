import { Guild as DJSGuild, Collection, Permissions, User, Invite } from 'discord.js';
import Client from '../../util/Client';
import GuildConfig from '../GuildConfig';

async function _init(this: Guild) {
	if (this.me) {
		if (this.me.hasPermission(Permissions.FLAGS.BAN_MEMBERS)) {
			try {
				const bans = await this.fetchBans();
				for (const ban of bans.values()) {
					this.bans.set(ban.user.id, ban);
				}
			} catch (error) {
				this.client.emit('error', error);
			}
		}

		if (this.me.hasPermission(Permissions.FLAGS.MANAGE_GUILD)) {
			try {
				const invites = await this.fetchInvites();
				for (const invite of invites.values()) {
					this.invites.set(invite.code, invite);
				}
			} catch (error) {
				this.client.emit('error', error);
			}
		}
	}
}

interface BanInfo {
	reason: string | null;
	user: User;
}

export interface DeriviGuildT {
	config: GuildConfig | null;
	bans: Collection<string, BanInfo>;
	invites: Collection<string, Invite>;
	fetchConfig(options?: { cache?: boolean; force?: boolean }): Promise<GuildConfig | null>;
}

export default class Guild extends DJSGuild {
	public config: GuildConfig | null;
	public bans = new Collection<string, BanInfo>();
	public invites = new Collection<string, Invite>();

	constructor(client: Client, data: object) {
		super(client, data);
		_init.apply(this);

		this.config = null;
	}

	public fetchConfig({ cache = true, force = false } = {}): Promise<GuildConfig | null> {
		return this.client.database.guildConfig(this, { cache, force });
	}
}