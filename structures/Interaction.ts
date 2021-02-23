import {
	APIApplicationCommandInteractionDataOption, APIGuildMember, APIInteraction, APIRole, APIUser
} from 'discord-api-types/v8';
import { Client, Snowflake, GuildMember, TextChannel, User, Role } from 'discord.js';

interface ResolvedInteractionData {
	members?: Record<Snowflake, APIGuildMember>;
	users?: Record<Snowflake, APIUser>;
	roles?: Record<Snowflake, APIRole>;
}

export default class Interaction {
	public readonly client!: Client;
	public channelID: Snowflake;
	public guildID: Snowflake;
	public id: Snowflake;
	public name: string;
	public member: GuildMember;
	public options?: APIApplicationCommandInteractionDataOption[];
	public resolved?: {
		roles?: Map<Snowflake, Role>;
	} & ({
		members?: Map<Snowflake, GuildMember>;
		users?: Map<Snowflake, User>;
	} | {
		members?: never;
		users?: never;
	})

	public constructor(client: Client, interaction: APIInteraction) {
		Object.defineProperty(this, 'client', { value: client });

		this.channelID = interaction.channel_id;
		this.guildID = interaction.guild_id;
		this.id = interaction.data!.id;
		this.name = interaction.data!.name;
		this.member = this.guild.members.add(interaction.member, true);
		this.options = interaction.data!.options;

		// @ts-expect-error this isn't yet documented
		const resolved: ResolvedInteractionData = interaction.data!.resolved;
		if ('resolved' in interaction.data!) {
			const { guild } = this;
			this.resolved = {};
			if (resolved.roles) {
				const roles = this.resolved.roles = new Map();
				for (const apiRole of Object.values(resolved.roles)) {
					roles.set(apiRole.id, guild.roles.add(apiRole, true));
				}
			}
			if (resolved.users) {
				const users = this.resolved.users = new Map();
				for (const apiUser of Object.values(resolved.users)) {
					users.set(apiUser.id, client.users.add(apiUser, true));
				}
				const members = this.resolved.members = new Map();
				for (const [id, apiMember] of Object.entries(resolved.members!)) {
					members.set(id, guild.members.add(
						Object.assign({ user: resolved.users[id] }, apiMember),
						true
					));
				}
			}
		}
	}
	
	public get channel() {
		return <TextChannel> this.client.channels.cache.get(this.channelID)!;
	}

	public get guild() {
		return this.client.guilds.cache.get(this.guildID)!;
	}
}