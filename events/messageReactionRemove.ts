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
	const [data] = await client.database.reactionRole(reaction.message.id, {
		emoji: reaction.emoji
	});

	if (!data) return;

	const role = guild.roles.resolve(data.roleID);
	if (!role) {
		return client.emit('warn', 'There is a reaction role in the database without a valid role ID');
	}
	try {
		const member = await guild.members.fetch(user);
		if (!member.roles.cache.has(role.id)) return;
		await member.roles.remove(role);
	} catch (error) {
		client.emit('error', error);
	}
}) as (...args: ClientEvents['messageReactionAdd']) => void;