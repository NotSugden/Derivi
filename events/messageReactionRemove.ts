import { ClientEvents, User, MessageReaction, Message, PartialMessage } from 'discord.js';

export default (async (
	reaction: Omit<MessageReaction, 'message'> & { message: Message | PartialMessage },
	user: User
) => {
	const { client, guild } = reaction.message;
  
	const config = guild && await guild.fetchConfig();
	if (!guild || !config) return;
	
	if (config.starboard.enabled && reaction.emoji.name === '⭐' && !client.config.PRODUCTION) {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.author!.id === user.id) return;
		const existing = await client.database.stars(guild, reaction.message.id);
		if (!existing) return;
		await existing.refreshStars();
		return;
	}
	if (!client.config.reactionRoles.size) return;

	const data = client.config.reactionRoles.get(reaction.message.id);
	if (!data) return;
	const roleID = data.emojis.get(reaction.emoji.id || reaction.emoji.name);
	if (!roleID || !guild.roles.cache.has(roleID)) return;

	try {
		const member = await guild.members.fetch(user.id);
		if (!member.roles.cache.has(roleID)) return;
		await member.roles.remove(roleID);
	} catch (error) {
		client.emit('error', error);
	} // eslint-disable-line no-empty
}) as (...args: ClientEvents['messageReactionAdd']) => void;