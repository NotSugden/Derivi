import { ClientEvents, User, Message, PartialMessage, MessageReaction } from 'discord.js';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export default (async (
	reaction: Omit<MessageReaction, 'message'> & { message: Message | PartialMessage },
	user: User
) => {
	const { client, guild } = reaction.message;

	if (reaction.message.author?.id === client.user!.id) {
		const giveaway = await client.database.giveaway(reaction.message.id);
		if (giveaway && !giveaway.ended) {
			await reaction.message.edit(Responses.GIVEAWAY_START(giveaway.prize, {
				end: giveaway.endAt,
				messageRequirement: giveaway.messageRequirement 
			}));
		}
	}
  
	const config = guild && await guild.fetchConfig();
	if (!guild || !config) return;
	
	if (config.starboard.enabled && reaction.emoji.name === '⭐') {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.author!.id === user.id) {
			await reaction.users.remove(user.id);
			await reaction.message.channel.send(Responses.STAR_OWN_MESSAGE(user));
			return;
		}
		const existing = await client.database.stars(guild, reaction.message.id);
		const users = (await reaction.users.fetch()).keyArray();
		if (!existing && reaction.count! >= config.starboard.minimum) {
			const starboardMessage = await config.starboard.channel!.send(
				Responses.STARBOARD_EMBED(users.length, reaction.message as Message)
			);
			await client.database.createStar({
				channel: reaction.message.channel.id,
				guild: guild.id,
				message: reaction.message as GuildMessage,
				starboardMessage: starboardMessage.id,
				users
			});
		} else if (existing) {
			await existing.refreshStars();
		}
		return;
	}
	if (!client.config.reactionRoles.size) return;

	const data = client.config.reactionRoles.get(reaction.message.id);
	if (!data) return;
	const member = await guild.members.fetch(user.id);
	if (data.limit > 0) {
		const filtered = [...data.emojis.values()]
			.filter(roleID => member.roles.cache.has(roleID));
		if (filtered.length > data.limit) return;
	}
	const roleID = data.emojis.get(reaction.emoji.id || reaction.emoji.name);
	if (!roleID || !guild.roles.cache.has(roleID)) return;

	try {
		if (member.roles.cache.has(roleID)) return;
		await member.roles.add(roleID);
	} catch (error) {
		client.emit('error', error);
	}
}) as (...args: ClientEvents['messageReactionAdd']) => void;