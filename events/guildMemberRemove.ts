import { MessageEmbed, Constants } from 'discord.js';
import { Events } from '../util/Client';

export default (async member => {
	const { client, user, guild } = member;
	const config = guild && client.config.guilds.get(guild.id);
  
	if (!config || !guild || user.bot) return;
	const hook = config.webhooks.get('member-logs');
	if (!hook) return;
	const roles = member.roles.cache;
	roles.delete(guild.roles.everyone!.id);
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.RED)
		.setDescription([
			`${user} (${user.id}) Left`,
			`Roles: ${roles.size > 1 ? roles.map(role => role.name) : 'No roles'}`
		])
		.setFooter(user.id)
		.setTimestamp()
		.setThumbnail(user.displayAvatarURL({ dynamic: true }));
	hook.send({
		embeds: [embed],
		username: 'Member Left'
	}).catch(console.error);
}) as (...args: Events['guildMemberRemove']) => void;