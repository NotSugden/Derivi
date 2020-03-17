import { MessageEmbed, Constants } from 'discord.js';
import { Member } from './guildMemberUpdate';

// TODO: change `invite-logs` to `welcome-messages` and `member-logs` respectively
export default async (member: Member) => {
	const { client, user } = member;
	if (member.guild.id !== client.config.defaultGuildID) return;
	const hook = client.webhooks.get('invite-logs');
	if (!hook) return;
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.NOT_QUITE_BLACK)
		.setDescription(`${user} (${user.id}) Left`)
		.setFooter(user.id)
		.setTimestamp();
	hook.send({
		embeds: [embed],
		username: 'Member Left'
	}).catch(console.error);
};