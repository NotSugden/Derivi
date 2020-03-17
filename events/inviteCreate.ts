import { Invite as DJSInvite } from 'discord.js';
import Guild from '../structures/discord.js/Guild';
import Client from '../util/Client';
import { EventResponses } from '../util/Constants';

type Invite = DJSInvite & { client: Client }

/**
 * To enable logging for this event, a webhook with the name `invite-logs`
 * should be in the config.json
 */
export default async (invite: Invite & { guild: Guild | null }) => {
	const { client } = invite;
	if (!invite.guild || invite.guild.id !== client.config.defaultGuildID) return;
	if (!invite.guild.invites.has(invite.code)) {
		invite.guild.invites.set(invite.code, invite as Invite & { guild: Guild });
	}

	const webhook = client.webhooks.get('invite-logs');
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_CREATE(invite);
	webhook.send(embed)
		.catch(console.error);
};