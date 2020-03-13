import { Message as DJSMessage, Snowflake, GuildMember } from 'discord.js';
import Guild from './Guild';
import Client from '../../util/Client';
export default class Message extends DJSMessage {
	public client!: Client;
	public commandID?: Snowflake;
	public guild!: Guild | null;
	public readonly member!: GuildMember & { client: Client } | null
	public channel!: DJSMessage['channel'] & { client: Client }
	get invites(): string[] {
		const invites = this.content.match(/discord(?:app\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi);
		return (invites || []).map(url => url.split('/').pop()) as string[];
	}
}
