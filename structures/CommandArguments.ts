import { Message, Snowflake } from 'discord.js';

const MENTION_REGEX = /<(@!?|@&|#)([0-9]{17,19})>/g;
const cleanContent = (message: Message) => {
	return message.content.split(' ').reduce((args, argument) => {
		const matches = [...argument.matchAll(MENTION_REGEX)]
			.map(([, type, id]) => [type, id] as ['@!' | '@&' | '@' | '#', Snowflake]);
		if (matches.length) {
			let newArg = '';
			for (const [type, id] of matches) {
				if ((type === '@!' || type === '@') && message.mentions.users.has(id)) {
					if (type === '@!' && message.mentions.members?.has(id)) {
						const member = message.mentions.members.get(id)!;
						newArg += `@${member.nickname || member.user.username}`;
					} else {
						newArg += `@${message.mentions.users.get(id)!.username}`;
					}
				} else if (type === '@&' && message.mentions.roles.has(id)) {
					newArg += `@${message.mentions.roles.get(id)!.name}`;
				} else if (type === '#' && message.mentions.channels.has(id)) {
					newArg += `#${message.mentions.channels.get(id)!.name}`;
				} else {
					newArg += `<${type}${id}>`;
				}
			}
			args.push(newArg);
		} else args.push(argument);
		return args;
	}, [] as string[]);
};

export default class CommandArguments extends Array<string> {
	public regular: string[];

	constructor(message: Message) {
		super(...cleanContent(message).slice(1));
		this.regular = message.content.split(' ').slice(1);
	}

	slice(start?: number, end?: number) {
		return [...this].slice(start, end);
	}
}