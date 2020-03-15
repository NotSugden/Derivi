import { Guild as DJSGuild, Collection, Invite, User } from 'discord.js';
import Client from '../../util/Client';
export default class Guild extends DJSGuild {
	public bans = new Collection<string, {
		user: User & { client: Client };
		reason: string | null;
	}>()
	public client!: Client;
	public invites = new Collection<string, Invite & { client: Client }>();

	constructor(client: Client, data: object) {
		super(client, data);

		this.fetchBans()
			.then(bans => {
				for (const ban of bans.values()) {
					this.bans.set(ban.user.id, ban as {
						user: User & { client: Client };
						reason: string | null;
					});
				}
			});

		this.fetchInvites()
			.then(invites => {
				for (const invite of invites.values()) {
					this.invites.set(invite.code, invite as Invite & { client: Client });
				}
			}).catch(error => console.error(error));
	}
}
