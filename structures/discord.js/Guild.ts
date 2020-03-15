import { Guild as DJSGuild, Collection, Invite, User } from 'discord.js';
import Client from '../../util/Client';
export default class Guild extends DJSGuild {
	public bans = new Collection<string, {
		reason: string | null;
		user: User & { client: Client };
	}>()
	public client!: Client;
	public invites = new Collection<string, Invite & { client: Client }>();

	constructor(client: Client, data: object) {
		super(client, data);

		this.fetchBans()
			.then(bans => {
				for (const ban of bans.values()) {
					this.bans.set(ban.user.id, ban as {
						reason: string | null;
						user: User & { client: Client };
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
