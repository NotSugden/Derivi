import { Message, Collection, User, GuildMember, Snowflake } from 'discord.js';
import { Errors } from './Constants';

export default class Util {
	static async reason(message: Message) {
		const { client } = message;
		const users = new Collection<Snowflake, User>();
		const [, ...content] = message.content.split(' ');
		for (const word of [...content]) {
			const [id] = word.match(/\d{17,19}/) || [];
			if (!id) break;
			content.shift();
			let user: User;
			try {
				user = await client.users.fetch(id); // eslint-disable-line no-await-in-loop
			} catch {
				throw new Error(Errors.RESOLVE_ID(id));
			}
			users.set(user.id, user);
		}
		return { async fetchMembers() {
			const members = new Collection<Snowflake, GuildMember>();
			for (const user of users.values()) {
				try {
					const member = await message.guild!.members.fetch(user); // eslint-disable-line no-await-in-loop
					members.set(member.id, member);
				} catch { } // eslint-disable-line no-empty
			}
			return members;
		}, reason: content, users };
	}
}
