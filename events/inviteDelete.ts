import { ClientEvents } from 'discord.js';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `invite-logs`
 * should be in the config.json
 */
export default (async invite => {
	const { guild } = invite;
	const config = guild && await guild.fetchConfig();
  
	if (!config) return;
  
	if (!guild!.invites.has(invite.code)) return;
	invite = guild!.invites.get(invite.code)!;

	const webhook = config.webhooks.inviteLogs;
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_DELETE(invite);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: ClientEvents['inviteDelete']) => void;