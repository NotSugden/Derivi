import { ClientEvents, GuildMember } from 'discord.js';
import { EventResponses } from '../util/Constants';

/**
 * To enable logging for this event, a webhook with the name `audit-logs`
 * should be in the config.json
 */
export default (async (oldMember: GuildMember, newMember: GuildMember) => {
	const { client, guild } = newMember;
	const config = await guild.fetchConfig();
  
	if (!config || newMember.user.bot) return;
	
	if (
		config.filePermissionsRole && !oldMember.roles.cache.has(config.filePermissionsRoleID) &&
    newMember.roles.cache.has(config.filePermissionsRoleID) && !client.config.PRODUCTION
	) {
		// lazy-fixes here because the send overloads for djs are messed up
		try {
			await newMember.send(<string> EventResponses.FILE_PERMISSIONS_NOTICE(true, guild));
		} catch {
			await config.generalChannel.send(
				<string> EventResponses.FILE_PERMISSIONS_NOTICE(newMember, guild)
			);
		}
	}

	const webhook = config.webhooks.auditLogs;
	if (!webhook) return;
	
	const embed = EventResponses.GUILD_MEMBER_UPDATE(oldMember, newMember);
	if (!embed) return;
	
	webhook.send(embed)
		.catch(console.error);
}) as (...args: ClientEvents['guildMemberUpdate']) => void;