import { Permissions, MessageEmbed, Util as DJSUtil, Snowflake } from 'discord.js';
import Command, { CommandData, PermissionsFunction, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses, ModerationActionTypes } from '../../util/Constants';
import { CaseEditData } from '../../util/DatabaseManager';
import { GuildMessage, MapObject } from '../../util/Types';
import Util from '../../util/Util';

enum CaseModes {
	EDIT = 'edit',
	DELETE = 'delete'
}

const EDIT_OPTIONS: MapObject<CaseEditData, 'string' | 'number' | 'boolean'> = {
	reason: 'string'
};

const keys = Object.values(CaseModes);

export default class Case extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: Object.values(CaseModes).flatMap(
				mode => [{
					name: `case-${mode}`,
					prepend: [mode]
				}, {
					name: `${mode}-case`,
					prepend: [mode]
				}]
			),
			category: CommandCategory.MODERATION,
			cooldown: 5,
			examples: [
				'delete 69',
				'edit 420 reason="dank"'
			],
			name: 'case',
			permissions: (...args) => {
				return (this.client.commands.get('attach')!.permissions as PermissionsFunction)(...args);
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const mode = args[0];

		const caseID = parseInt(args[1]);
		if (isNaN(caseID)) {
			throw new CommandError('INVALID_CASE_ID', args[1] || '');
		}
    
		const config = (await this.client.database.guildConfig({
			staff_server_category: message.channel.parentID!
		}))!;

		const caseData = await message.client.database.case(config.guild, caseID);
		if (!caseData) {
			throw new CommandError('INVALID_CASE_ID', args[1]);
		}

		if (
			!message.member.hasPermission(Permissions.FLAGS.ADMINISTRATOR) && 
      caseData.moderatorID !== message.author.id
		) {
			throw new CommandError('NOT_PERMITTED_CASE_MODIFY', mode);
		}
    
		if (mode === CaseModes.DELETE) {
			this.client.database.cache.cases.clear();
			const channel = config.punishmentChannel;
			const caseMessage = await channel.messages.fetch(caseData.logMessageID);
			await caseMessage.delete();
			const response = await send(Responses.DELETE_CASE(caseID));
			await this.client.database.deleteCase(config.guild, caseID);
			const options = { caseID, guildID: config.guildID };
			const cases = await this.client.database.query<{
				action: keyof typeof ModerationActionTypes;
				id: number;
				message_id: Snowflake;
			}>(
				'SELECT message_id, id, action FROM cases WHERE id > :caseID AND guild_id = :guildID',
				options
			);
			await this.client.database.query(
				'UPDATE cases SET id = id - 1 WHERE id > :caseID AND guild_id = :guildID',
				options
			);
			if (!cases.length) return response.edit(Responses.DELETE_CASE(caseID, true)) as Promise<GuildMessage<true>>;
			for (const data of cases) {
				const newID = data.id - 1;
				if (data.action === 'WARN') {
					await this.client.database.editWarn(data.id, { caseID: newID }, config.guild);
				}
				const msg = await channel.messages.fetch(data.message_id);
				await msg.edit(`Case ${newID}`, new MessageEmbed(msg.embeds[0]));
				await DJSUtil.delayFor(2500);
			}

			return response.edit(Responses.DELETE_CASE(caseID, true)) as Promise<GuildMessage<true>>; 
		} else if (mode === CaseModes.EDIT) {
			const { options: newData } = Util.extractOptions(
				args.regular.slice(1).join(' '), Object.entries(EDIT_OPTIONS)
					.map(([opt, type]) => ({ name: opt, type: type! }))
			);
			if (!Object.keys(newData).length) {
				throw new CommandError('NO_OPTIONS', Object.keys(EDIT_OPTIONS));
			}
      
			const caseMessage = await caseData.fetchLogMessage();
      
			const newEmbed = new MessageEmbed(caseMessage.embeds[0]);
      
			if (typeof newData.reason === 'string') {
				if (!newData.reason.length) throw new CommandError('PROVIDE_REASON');
				const description = newEmbed.description!.split('\n');
				for (let i = 0;i < description.length;i++) {
					if (!description[i].startsWith('Reason:')) continue;
					description[i] = `Reason: ${caseData.reason = newData.reason}`;
				}
			}
      
			await caseMessage.edit(newEmbed);

			await this.client.database.editCase(config.guild, caseData.id, {
				reason: newData.reason as string
			});
      
			return send(Responses.SUCCESSFULLY_EDITED_CASE(caseID));
		}
		throw new CommandError('INVALID_MODE', keys);
	}
}