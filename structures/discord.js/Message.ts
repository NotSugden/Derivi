import { Message as DJSMessage, Snowflake, DMChannel as DJSDMChannel, TextChannel as DJSTextChannel } from 'discord.js';
import DMChannel from './DMChannel';
import Guild from './Guild';
import GuildMember from './GuildMember';
import TextChannel from './TextChannel';
import User from './User';
import Client from '../../util/Client';

export default class Message extends DJSMessage {
	public author!: User
	public channel!: (Exclude<DJSMessage['channel'], DJSDMChannel | DJSTextChannel>) & {
		client: Client;
	} | DMChannel | TextChannel;
	public client!: Client;
	public commandID?: Snowflake;
	public guild!: Guild | null;
	public readonly member!: GuildMember | null;
	
	get invites(): string[] {
		const invites = this.content.match(/discord(?:app\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi);
		return (invites || []).map(url => url.split('/').pop()) as string[];
	}
}