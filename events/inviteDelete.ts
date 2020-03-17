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
	const guild = invite.client.config.defaultGuild;
	if (!guild.invites.has(invite.code)) return;
	invite = guild.invites.get(invite.code) as Invite & { guild: Guild };

	const webhook = client.webhooks.get('invite-logs');
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_DELETE(invite);
	webhook.send(embed)
		.catch(console.error);
};