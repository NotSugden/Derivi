import { DMChannel as DJSDMChannel, Client } from 'discord.js';
import Message from './Message';
import User from './User';

export default class DMChannel extends DJSDMChannel {
	public readonly client!: Client;
	public readonly lastMessage!: Message | null
	public recipient!: User;
}