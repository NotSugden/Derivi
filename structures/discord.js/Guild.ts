import { Guild as DJSGuild, Collection, Permissions } from 'discord.js';
import User from './User';
import Client from '../../util/Client';
import { Invite } from '../../util/Types';

export default class Guild extends DJSGuild {
	public bans = new Collection<string, {
		reason: string | null;
		user: User;
	}>()
	public readonly client!: Client;
	public invites = new Collection<string, Invite>();

	constructor(client: Client, data: object) {
		super(client, data);

		if (this.me && this.me.hasPermission(Permissions.FLAGS.BAN_MEMBERS)) {
			this.fetchBans()
				.then(bans => {
					for (const ban of bans.values()) {
						this.bans.set(ban.user.id, ban as {
						reason: string | null;
						user: User;
					});
					}
				});
		}

		if (this.me && this.me.hasPermission(Permissions.FLAGS.MANAGE_GUILD)) {
			this.fetchInvites()
				.then(invites => {
					for (const invite of invites.values()) {
						this.invites.set(invite.code, invite as Invite);
					}
				}).catch(error => console.error(error));
		}
	}
}