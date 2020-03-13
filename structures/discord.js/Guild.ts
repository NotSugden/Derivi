import { Guild as DJSGuild, Collection, Invite } from 'discord.js';
import Client from '../../util/Client';
export default class Guild extends DJSGuild {
	public client!: Client;
	public invites: Collection<string, Invite & { client: Client }> = new Collection();

	constructor(client: Client, data: object) {
		super(client, data);

		this.fetchInvites()
			.then(invites => {
				for (const invite of invites.values()) {
					this.invites.set(invite.code, invite as Invite & { client: Client });
				}
			}).catch(error => console.error(error));
	}
}
