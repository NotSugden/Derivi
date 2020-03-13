import { Message } from 'discord.js';

export default class CommandArguments extends Array<string> {
	public regular: string[];

	constructor(message: Message) {
		super(...message.cleanContent.toLowerCase().split(' ').slice(1));
		this.regular = message.content.split(' ').slice(1);
	}
}
