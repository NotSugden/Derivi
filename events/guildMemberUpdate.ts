import GuildMember from '../structures/discord.js/GuildMember';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `audit-logs`
 * should be in the config.json
 */
export default async (oldMember: GuildMember, newMember: GuildMember) => {
	const { client, guild } = newMember;
	if (guild.id !== client.config.defaultGuildID || newMember.user.bot) return;
	const webhook = client.webhooks.get('audit-logs');
	if (!webhook) return;
	
	const embed = EventResponses.GUILD_MEMBER_UPDATE(oldMember, newMember);
	if (!embed) return;
	
	webhook.send(embed)
		.catch(console.error);
};