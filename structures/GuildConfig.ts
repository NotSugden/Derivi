import { CategoryChannel, Client, DMChannel, Snowflake, TextChannel, WebhookClient } from 'discord.js';
import { TextBasedChannels } from '../util/Types';

type GuildWebhookName = 'auditLogs' | 'memberLogs' | 'inviteLogs' | 'joins';

export default class GuildConfig {
	public raw!: RawGuildConfig;
	public readonly client!: Client;
	public guildID!: Snowflake;
	public accessLevelRoles!: [Snowflake, Snowflake, Snowflake, Snowflake];
	public filePermissionsRoleID!: Snowflake;
	public generalChannelID!: Snowflake;
	public lockdownChannelID!: Snowflake | null;
	public mfaModeration!: boolean;
	public partnerRewardsChannelID!: Snowflake;
	public punishmentChannelID!: Snowflake;
	public rulesChannelID!: Snowflake;
	public rulesMessageID!: Snowflake | null;
	public staffCommandsChannelID!: Snowflake;
	public staffServerCategoryID!: Snowflake;
	public starboard!: {
		readonly channel: TextChannel | null;
		channelID: Snowflake | null;
		enabled: boolean;
		minimum: number;
	};
	public welcomeRoleID!: Snowflake | null;
	public webhooks!: {
		[K in GuildWebhookName]: WebhookClient;
	} | {
		[K in GuildWebhookName]?: undefined
	}
	constructor(client: Client, data: RawGuildConfig) {
		Object.defineProperty(this, 'client', { value: client });
		this.patch(data);
	}

	public patch(data: RawGuildConfig) {
		const { client } = this;
		this.raw = data;

		this.guildID = data.id;
		this.accessLevelRoles = JSON.parse(data.access_level_roles);
		this.filePermissionsRoleID = data.file_permissions_role;
		this.generalChannelID = data.general_channel;
		this.lockdownChannelID = data.lockdown_channel;
		this.mfaModeration = data.mfa_moderation === 1;
		this.partnerRewardsChannelID = data.partner_rewards_channel;
		this.punishmentChannelID = data.punishment_channel;
		this.rulesChannelID = data.rules_channel;
		this.rulesMessageID = data.rules_message;
		this.staffCommandsChannelID = data.staff_commands_channel;
		this.staffServerCategoryID = data.staff_server_category;
		this.starboard = {
			get channel() {
				if (!this.channelID) return null;
				return client.channels.resolve(this.channelID) as TextChannel;
			},
			channelID: data.starboard_channel_id,
			enabled: data.starboard_enabled === 1,
			minimum: data.starboard_minimum
		};
		this.welcomeRoleID = data.welcome_role;
		this.webhooks = {};
		const registerHook = (name: GuildWebhookName, [id, token]: string[]) => {
			this.webhooks[name] = new WebhookClient(id, token, this.client.options);
		};
		if (data.audit_logs_webhook) {
			registerHook('auditLogs', data.audit_logs_webhook.split(':'));
			registerHook('memberLogs', data.member_logs_webhook!.split(':'));
			registerHook('inviteLogs', data.invite_logs_webhook!.split(':'));
		}
		if (data.joins_webhook) {
			registerHook('joins', data.joins_webhook.split(':'));
		}
	}

	public fetchRulesMessage(cache = false) {
		if (!this.rulesMessageID) return Promise.resolve(null);
		return this.rulesChannel.messages.fetch(this.rulesMessageID, cache);
	}

	get filePermissionsRole() {
		return this.guild.roles.resolve(this.filePermissionsRoleID)!;
	}

	get generalChannel() {
		return this.guild.channels.resolve(this.generalChannelID) as TextChannel;
	}

	get lockdownChannel() {
		if (!this.lockdownChannelID) return null;
		return this.guild.channels.resolve(this.lockdownChannelID) as TextChannel;
	}

	get partnerRewardsChannel() {
		return this.guild.channels.resolve(this.partnerRewardsChannelID) as TextChannel;
	}

	get punishmentChannel() {
		return this.staffServerCategory.children.get(this.punishmentChannelID) as TextChannel;
	}

	get rulesChannel() {
		return this.guild.channels.resolve(this.rulesChannelID) as Exclude<TextBasedChannels, DMChannel>;
	}

	get staffCommandsChannel() {
		return this.staffServerCategory.children.get(this.staffCommandsChannelID);
	}

	get staffServerCategory() {
		return this.client.channels.resolve(this.staffServerCategoryID) as CategoryChannel;
	}

	get guild() {
		return this.client.guilds.resolve(this.guildID)!;
	}
}

export type RawGuildConfig = {
	id: Snowflake;
	access_level_roles: string; // [Snowflake, Snowflake, Snowflake, Snowflake]
	file_permissions_role: Snowflake;
	general_channel: Snowflake;
	lockdown_channel: Snowflake | null;
	mfa_moderation: 0 | 1;
	partner_rewards_channel: Snowflake;
	punishment_channel: Snowflake;
	rules_channel: Snowflake;
	rules_message: Snowflake | null;
	staff_commands_channel: Snowflake;
	staff_server_category: Snowflake;
	starboard_channel_id: Snowflake | null;
	starboard_enabled: 0 | 1;
	starboard_minimum: number;
	welcome_role: Snowflake | null;
	// all hooks should be present if one hook is
	audit_logs_webhook: string | null; // id:token
	member_logs_webhook: string | null; // id:token
	invite_logs_webhook: string | null; // id:token
	joins_webhook: string | null; // id:token
}