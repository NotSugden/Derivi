import { ClientEvents, User, Message, PartialMessage, MessageReaction } from 'discord.js';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export default (async (
	reaction: Omit<MessageReaction, 'message'> & { message: Message | PartialMessage },
	user: User
) => {
	const { client, guild, author } = reaction.message;

	if (!author || author.id === client.user!.id) {
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
	
	if (config.starboard.enabled && reaction.emoji.name === '⭐' && !client.config.PRODUCTION) {
		if (reaction.partial) await reaction.fetch();
		if (author!.id === user.id) {
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
		if (member.roles.cache.has(role.id)) return;
		await member.roles.add(role);
	} catch (error) {
		client.emit('error', error);
	}
}) as (...args: ClientEvents['messageReactionAdd']) => void;
