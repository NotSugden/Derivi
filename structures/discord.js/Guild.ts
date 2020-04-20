import { Guild as DJSGuild, Collection } from 'discord.js';
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

		this.fetchBans()
			.then(bans => {
				for (const ban of bans.values()) {
					this.bans.set(ban.user.id, ban as {
						reason: string | null;
						user: User;
					});
				}
			});

		this.fetchInvites()
			.then(invites => {
				for (const invite of invites.values()) {
					this.invites.set(invite.code, invite as Invite);
				}
			}).catch(error => console.error(error));
	}
}