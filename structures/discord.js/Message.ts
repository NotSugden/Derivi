import { Message as DJSMessage } from 'discord.js';

export interface DeriviMessageT {
	commandID?: string;
	readonly invites: string[];
}

export default class Message extends DJSMessage {	
	get invites(): string[] {
		const invites = this.content.match(/discord(?:app\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi);
		return (invites || []).map(url => url.split('/').pop()) as string[];
	}
}