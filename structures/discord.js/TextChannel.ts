import { TextChannel as DJSTextChannel, Collection, Snowflake } from 'discord.js';
import Guild from './Guild';
import GuildMember from './GuildMember';
import Message from './Message';
import Client from '../../util/Client';

export default class TextChannel extends DJSTextChannel {
	public client!: Client;
	public guild!: Guild;
	public lastMessage!: Message | null;
	public members!: Collection<Snowflake, GuildMember>;
}