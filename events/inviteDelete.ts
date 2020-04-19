import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `invite-logs`
 * should be in the config.json
 */
export default (async invite => {
	const { client } = invite;
	const guild = invite.client.config.defaultGuild;
	if (!guild.invites.has(invite.code)) return;
	invite = guild.invites.get(invite.code)!;

	const webhook = client.webhooks.get('invite-logs');
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_DELETE(invite);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: Events['inviteDelete']) => void;