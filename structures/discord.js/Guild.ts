import { Guild as DJSGuild, Collection, Permissions, User, Invite } from 'discord.js';
import Client from '../../util/Client';

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
	bans: Collection<string, BanInfo>;
	invites: Collection<string, Invite>;
}

export default class Guild extends DJSGuild {
	public bans = new Collection<string, BanInfo>();
	public invites = new Collection<string, Invite>();

	constructor(client: Client, data: object) {
		super(client, data);
		_init.apply(this);
	}
}