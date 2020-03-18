import { GuildMember as DJSMember } from 'discord.js';
import Guild from './Guild';
import Message from './Message';
import User from './User';
import Client from '../../util/Client';

export default class GuildMember extends DJSMember {
	public client!: Client;
	public guild!: Guild;
	public readonly lastMessage!: Message | null;
	public user!: User;
}