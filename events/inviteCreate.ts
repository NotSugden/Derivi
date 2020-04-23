import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `invite-logs`
 * should be in the config.json
 */
export default (async invite => {
	const { client } = invite;
	if (invite.guild?.id !== client.config.defaultGuildID) return;
	if (!invite.guild.invites.has(invite.code)) {
		invite.guild.invites.set(invite.code, invite);
	}

	const webhook = client.webhooks.get('invite-logs');
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_CREATE(invite);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: Events['inviteCreate']) => void;