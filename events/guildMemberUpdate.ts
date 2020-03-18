import GuildMember from '../structures/discord.js/GuildMember';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `audit-logs`
 * should be in the config.json
 */
export default async (oldMember: GuildMember, newMember: GuildMember) => {
	const { client, guild } = newMember;
	if (guild.id !== client.config.defaultGuildID) return;
	// TODO: change `invite-logs` to `audit-logs` before commiting
	const webhook = client.webhooks.get('audit-logs');
	if (!webhook) return;
	
	const embed = EventResponses.GUILD_MEMBER_UPDATE(oldMember, newMember);
	webhook.send(embed)
		.catch(console.error);
};