import { TextChannel, WebhookClient, MessageEmbed, Constants } from 'discord.js';
import { Member } from './guildMemberUpdate';
import { EventResponses } from '../util/Constants';

export default async (member: Member) => {
	const { client, user } = member;
	if (member.guild.id !== client.config.defaultGuildID) return;
	const hookOrChannel = client.webhooks.get('welcome-messages') ||
		(member.guild.channels.cache.find(ch => ch.type === 'text' && ch.name === 'general') as TextChannel);
	const isWebhook = hookOrChannel instanceof WebhookClient;
	if (hookOrChannel) {
		const options = {
			content: EventResponses.GUILD_MEMBER_ADD(member, isWebhook)
		} as { [key: string]: string };
		if (isWebhook) {
			options.username = 'Welcome';
		}
		hookOrChannel.send(options)
			.catch(console.error);
	}
	const hook = client.webhooks.get('member-logs');
	if (!hook) return;
	// This will be added to constants at a later date
	const embed = new MessageEmbed()
		.setAuthor(user.tag)
		.setColor(Constants.Colors.NOT_QUITE_BLACK)
		.setDescription(`${user} (${user.id}) Joined`)
		.setFooter(user.id)
		.setTimestamp(member.joinedAt!);
	hook.send({
		embeds: [embed],
		username: 'Member Joined'
	}).catch(console.error);
};