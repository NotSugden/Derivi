import {
	ClientEvents, Constants,
	GuildMember, MessageEmbed
} from 'discord.js';
import { EventResponses } from '../util/Constants';

export default (async (member: GuildMember) => {
	const { client, user, guild } = member;
	const config = await guild.fetchConfig();
  
	if (!config || user.bot) return;

	const key = `${guild.id}:${user.id}`;
  
	const isMuted = client.database.cache.mutes.has(key);
	const recentlyKicked = client.recentlyKicked.has(key);
	const mutedRole = guild.roles.cache.find(role => role.name === 'Muted')!;
	if (isMuted || recentlyKicked) {
		await member.roles.add(mutedRole);
		if (recentlyKicked && !isMuted) {
			await client.database.createMute({
				endDate: new Date(Date.now() + 27e5),
				guild,
				start: new Date(),
				user: member.user
			});
		}
	}
	const joinsHook = config.webhooks.joins;
	if (joinsHook && !isMuted && !recentlyKicked && !client.config.PRODUCTION) {
		joinsHook.send(EventResponses.GUILD_MEMBER_ADD(member)).catch(console.error);
	}
	const auditHook = config.webhooks.memberLogs;
	if (!auditHook) return;
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.GREEN)
		.setDescription(`${user} (${user.id}) Joined`)
		.setFooter(user.id)
		.setTimestamp(member.joinedAt!)
		.setThumbnail(user.displayAvatarURL({ dynamic: true }));
	auditHook.send({
		embeds: [embed],
		username: 'Member Joined'
	}).catch(console.error);
}) as (...args: ClientEvents['guildMemberAdd']) => void;