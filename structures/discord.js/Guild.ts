import { Guild as DJSGuild, Collection, User, Invite } from 'discord.js';
import Client from '../../util/Client';
import GuildConfig from '../GuildConfig';

interface BanInfo {
	reason: string | null;
	user: User;
}

export interface DeriviGuildT {
	config: GuildConfig | null;
	bans: Collection<string, BanInfo>;
	invites: Collection<string, Invite>;
	fetchConfig(options?: { cache?: boolean; force?: boolean }): Promise<GuildConfig | null>;
}

export default class Guild extends DJSGuild {
	public config: GuildConfig | null;
	public bans = new Collection<string, BanInfo>();
	public invites = new Collection<string, Invite>();

	constructor(client: Client, data: object) {
		super(client, data);

		this.config = null;
	}

	public fetchConfig({ cache = true, force = false } = {}): Promise<GuildConfig | null> {
		return this.client.database.guildConfig(this, { cache, force });
	}
}