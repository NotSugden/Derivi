import { Events } from '../util/Client';
import { Responses } from '../util/Constants';

export default (async (reaction, user) => {
	const { client } = reaction.message;
	
	if (client.config.starboard && reaction.emoji.name === '⭐') {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.author.id === user.id) {
			await reaction.users.remove(user.id);
			await reaction.message.channel.send(Responses.STAR_OWN_MESSAGE(user));
		}
		const existing = await client.database.stars(reaction.message.id);
		if (!existing) return;
		await existing.removeStar(user);
		return;
	}
	if (!reaction.message.guild || !client.config.reactionRoles.size) return;

	const data = client.config.reactionRoles.get(reaction.message.id);
	if (!data) return;
	const roleID = data.get(reaction.emoji.id || reaction.emoji.name);
	if (!roleID || !reaction.message.guild.roles.cache.has(roleID)) return;

	try {
		const member = await reaction.message.guild.members.fetch(user.id);
		if (!member.roles.cache.has(roleID)) return;
		await member.roles.remove(roleID)
			.catch(console.error);
	} catch { } // eslint-disable-line no-empty
}) as (...args: Events['messageReactionAdd']) => void;