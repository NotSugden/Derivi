import { ClientEvents, TextChannel, GuildMember } from 'discord.js';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `audit-logs`
 * should be in the config.json
 */
export default (async (oldMember: GuildMember, newMember: GuildMember) => {
	const { client, guild } = newMember;
	const config = guild && client.config.guilds.get(guild.id);
  
	if (!config || !guild || newMember.user.bot) return;
	const webhook = config.webhooks.get('audit-logs');
	if (!webhook) return;
  
	if (
		config.filePermissionsRole && !oldMember.roles.cache.has(config.filePermissionsRole) &&
    newMember.roles.cache.has(config.filePermissionsRole)
	) {
		try {
			await newMember.send(EventResponses.FILE_PERMISSIONS_NOTICE(true, guild));
		} catch {
			await (client.channels.resolve(config.generalChannelID) as TextChannel).send(
				EventResponses.FILE_PERMISSIONS_NOTICE(newMember, guild)
			);
		}
	}
	
	const embed = EventResponses.GUILD_MEMBER_UPDATE(oldMember, newMember);
	if (!embed) return;
	
	webhook.send(embed)
		.catch(console.error);
}) as (...args: ClientEvents['guildMemberUpdate']) => void;