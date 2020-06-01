import { Events } from '../util/Client';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `invite-logs`
 * should be in the config.json
 */
export default (async invite => {
	const { client, guild } = invite;
	const config = guild && client.config.guilds.get(guild.id);
  
	if (!config || !guild) return;
  
	if (!guild.invites.has(invite.code)) {
		guild.invites.set(invite.code, invite);
	}

	const webhook = config.webhooks.get('invite-logs');
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_CREATE(invite);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: Events['inviteCreate']) => void;