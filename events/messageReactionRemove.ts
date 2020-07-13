import { Events } from '../util/Client';

export default (async (reaction, user) => {
	const { client, guild } = reaction.message;
  
	const config = guild && client.config.guilds.get(guild.id);
	if (!guild || !config) return;
	
	if (config.starboard && reaction.emoji.name === '⭐') {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.author.id === user.id) return;
		const existing = await client.database.stars(guild, reaction.message.id);
		if (!existing) return;
		await existing.removeStar(user);
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
}) as (...args: Events['messageReactionAdd']) => void;