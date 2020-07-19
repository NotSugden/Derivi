import { ClientEvents, MessageEmbed, Constants, GuildMember } from 'discord.js';

export default (async (member: GuildMember) => {
	const { user, guild } = member;
	const config = await guild.fetchConfig();
  
	if (!config || user.bot) return;
	const hook = config.webhooks.memberLogs;
	if (!hook) return;
	const roles = member.roles.cache.clone();
	roles.delete(guild.id);
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.RED)
		.setDescription([
			`${user} (${user.id}) Left`,
			`Roles: ${roles.size ? roles.map(role => role.name) : 'No roles'}`
		])
		.setFooter(user.id)
		.setTimestamp()
		.setThumbnail(user.displayAvatarURL({ dynamic: true }));
	hook.send({
		embeds: [embed],
		username: 'Member Left'
	}).catch(console.error);
}) as (...args: ClientEvents['guildMemberRemove']) => void;