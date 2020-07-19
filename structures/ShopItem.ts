import { Client, Snowflake } from 'discord.js';

export type ShopActionType = 'give_role';

export default class ShopItem {
	public action: ShopActionType;
	public readonly client!: Client;
	public cost: number;
	public guildID: Snowflake;
	private _item: Snowflake;

	constructor(client: Client, data: RawShopItem) {
		Object.defineProperty(this, 'client', { value: client });
		this.action = data.action;
		this.cost = data.cost;
		this.guildID = data.guild_id;
		this._item = data.item;
	}

	get guild() {
		return this.client.guilds.resolve(this.guildID)!;
	}

	get item() {
		return this.guild.roles.resolve(this._item)!; // add more things later as more actions are added
	}
}

export interface RawShopItem {
	action: ShopActionType;
	cost: number;
	guild_id: Snowflake;
	item: Snowflake;
}
