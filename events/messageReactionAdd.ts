import { Events } from '../util/Client';

export default (async (reaction, user) => {
	const { client } = reaction.message;
	if (!reaction.message.guild || !client.config.reactionRoles.size) return;

	const data = client.config.reactionRoles.get(reaction.message.id);
	if (!data) return;
	const roleID = data.get(reaction.emoji.id || reaction.emoji.name);
	if (!roleID || !reaction.message.guild.roles.cache.has(roleID)) return;

	try {
		const member = await reaction.message.guild.members.fetch(user.id);
		if (member.roles.cache.has(roleID)) return;
		await member.roles.add(roleID)
			.catch(console.error);
	} catch { } //eslint-disable-line no-empty
}) as (...args: Events['messageReactionAdd']) => void;