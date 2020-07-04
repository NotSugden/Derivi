import TextChannel from '../structures/discord.js/TextChannel';
import { Events } from '../util/Client';
import { Responses } from '../util/Constants';
import { GuildMessage } from '../util/Types';

export default (async (reaction, user) => {
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
  
	const config = guild && client.config.guilds.get(guild.id);
	if (!guild || !config) return;
	
	if (config.starboard && reaction.emoji.name === '⭐') {
		if (reaction.partial) await reaction.fetch();
		if (reaction.message.author.id === user.id) {
			await reaction.users.remove(user.id);
			await reaction.message.channel.send(Responses.STAR_OWN_MESSAGE(user));
		}
		const existing = await client.database.stars(guild, reaction.message.id);
		if (!existing && reaction.count! >= config.starboard.minimum) {
			const users = (await reaction.users.fetch()).keyArray();
			const starboardMessage = await (
        client.channels.resolve(config.starboard.channelID) as TextChannel
			).send(
				Responses.STARBOARD_EMBED(users.length, reaction.message)
			);
			await client.database.createStar({
				channel: reaction.message.channel.id,
				guild: guild.id,
				message: reaction.message as GuildMessage,
				starboardMessage: starboardMessage.id,
				users
			});
		} else if (existing) {
			await existing.addStar(user);
		}
		return;
	}
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
	} catch { } // eslint-disable-line no-empty
}) as (...args: Events['messageReactionAdd']) => void;