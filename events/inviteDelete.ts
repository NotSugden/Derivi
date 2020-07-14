import { ClientEvents } from 'discord.js';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `invite-logs`
 * should be in the config.json
 */
export default (async invite => {
	const { client, guild } = invite;
	const config = guild && client.config.guilds.get(guild.id);
  
	if (!config || !guild) return;
  
	if (!guild.invites.has(invite.code)) return;
	invite = guild.invites.get(invite.code)!;

	const webhook = config.webhooks.get('invite-logs');
	if (!webhook) return;
	
	const embed = EventResponses.INVITE_DELETE(invite);
	webhook.send(embed)
		.catch(console.error);
}) as (...args: ClientEvents['inviteDelete']) => void;