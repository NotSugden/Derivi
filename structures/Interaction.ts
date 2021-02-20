import {
	APIApplicationCommandInteractionDataOption,
	APIGuildMember, APIInteraction, APIRole,
	APIUser
} from 'discord-api-types/v8';
import { Client, Snowflake, GuildMember, TextChannel } from 'discord.js';

export default class Interaction {
	public readonly client!: Client;
	public channelID: Snowflake;
	public guildID: Snowflake;
	public id: Snowflake;
	public name: string;
	public member: GuildMember;
	public options?: APIApplicationCommandInteractionDataOption[];
	public resolved?: {
		members?: Record<Snowflake, APIGuildMember>;
		users?: Record<Snowflake, APIUser>;
		roles?: Record<Snowflake, APIRole>;
	}

	public constructor(client: Client, interaction: APIInteraction) {
		Object.defineProperty(this, 'client', { value: client });

		this.channelID = interaction.channel_id;
		this.guildID = interaction.guild_id;
		this.id = interaction.data!.id;
		this.name = interaction.data!.name;
		this.member = this.guild.members.add(interaction.member, true);
		this.options = interaction.data!.options;
		// @ts-expect-error this isn't yet documented
		this.resolved = interaction.data!.resolved;
	}
	
	public get channel() {
		return <TextChannel> this.client.channels.cache.get(this.channelID)!;
	}

	public get guild() {
		return this.client.guilds.cache.get(this.guildID)!;
	}
}