import { User as DJSUser, DMChannel } from 'discord.js';
import Message from './Message';
import Client from '../../util/Client';

export default class User extends DJSUser {
	public client!: Client;
	public readonly dmChannel!: DMChannel;
	public readonly lastMessage!: Message | null;
}