import { MessageEmbed, Constants } from 'discord.js';
import GuildMember from '../structures/discord.js/GuildMember';

export default async (member: GuildMember) => {
	const { client, user } = member;
	if (member.guild.id !== client.config.defaultGuildID || user.bot) return;
	const hook = client.webhooks.get('member-logs');
	if (!hook) return;
	const roles = member.roles.cache;
	roles.delete(member.guild.roles.everyone!.id);
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.NOT_QUITE_BLACK)
		.setDescription([
			`${user} (${user.id}) Left`,
			`Roles: ${roles.size > 1 ? roles.map(role => role.name) : 'No roles'}`
		])
		.setFooter(user.id)
		.setTimestamp();
	hook.send({
		embeds: [embed],
		username: 'Member Left'
	}).catch(console.error);
};