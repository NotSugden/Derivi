import { APIApplicationCommandInteractionDataOption, APIInteraction } from 'discord-api-types/v8';
import { Client, Snowflake, GuildMember } from 'discord.js';

export default class Interaction {
	public readonly client!: Client;
	public channelID: Snowflake;
	public guildID: Snowflake;
	public id: Snowflake;
	public name: string;
	public member: GuildMember;
	public options?: APIApplicationCommandInteractionDataOption[];

	public constructor(client: Client, interaction: APIInteraction) {
		Object.defineProperty(this, 'client', { value: client });

		this.channelID = interaction.channel_id;
		this.guildID = interaction.guild_id;
		this.id = interaction.data!.id;
		this.name = interaction.data!.name;
		this.member = this.guild!.members.add(interaction.member, true);
		this.options = interaction.data!.options;
	}

	public get guild() {
		return this.client.guilds.cache.get(this.guildID);
	}
}