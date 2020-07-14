import { TextChannel, Permissions, MessageEmbed, Util as DJSUtil, Snowflake } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses, ModerationActionTypes } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

enum CaseModes {
	EDIT = 'edit',
	DELETE = 'delete'
}

const EDIT_OPTIONS = {
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
			category: 'Moderation',
			cooldown: 5,
			examples: [
				'delete 69',
				'edit 420 reason="dank"'
			],
			name: 'case',
			permissions: (member, channel) => {
				if (!channel.parentID) return 'You\'re not using this command in the correct category!';
				const config = [...member.client.config.guilds.values()].find(
					cfg => cfg.staffServerCategoryID === channel.parentID
				);
				if (!config) return 'You\'re not using this command in the correct category!';
				const channelID = config.staffCommandsChannelID;
				return channel.id === channelID || (channelID ?
					`This command can only be used in <#${channelID}>.` :
					'The Staff commands channel has not been configured.');
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const mode = args[0];

		const caseID = parseInt(args[1]);
		if (isNaN(caseID)) {
			throw new CommandError('INVALID_CASE_ID', args[1] || '');
		}
    
		const config = [...this.client.config.guilds.values()].find(
			cfg => cfg.staffServerCategoryID === message.channel.parentID
		)!;
    
		const guild = this.client.guilds.resolve(config.id)!;

		const caseData = await message.client.database.case(guild, caseID);
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
			const channel = this.client.channels.resolve(config.casesChannelID) as TextChannel;
			const caseMessage = await channel.messages.fetch(caseData.logMessageID);
			await caseMessage.delete();
			const response = await send(Responses.DELETE_CASE(caseID));
			await this.client.database.deleteCase(guild, caseID);
			const cases = await this.client.database.query<{
				action: keyof typeof ModerationActionTypes;
				id: number;
				message_id: Snowflake;
			}>(
				'SELECT message_id, id, action FROM cases WHERE id > ? AND guild_id = ?',
				caseID, guild.id
			);
			await this.client.database.query(
				'UPDATE cases SET id = id - 1 WHERE id > :caseID AND guild_id = :guildID',
				{ caseID, guildID: guild.id }
			);
			if (!cases.length) return response.edit(Responses.DELETE_CASE(caseID, true)) as Promise<GuildMessage<true>>;
			for (const data of cases) {
				const newID = data.id - 1;
				if (data.action === 'WARN') {
					await this.client.database.editWarn(data.id, { caseID: newID }, guild);
				}
				const msg = await channel.messages.fetch(data.message_id);
				await msg.edit(`Case ${newID}`, new MessageEmbed(msg.embeds[0]));
				await DJSUtil.delayFor(2500);
			}

			return response.edit(Responses.DELETE_CASE(caseID, true)) as Promise<GuildMessage<true>>; 
		} else if (mode === CaseModes.EDIT) {
			const newData = Util.getOptions(
				args.regular.slice(1).join(' '),
				Object.keys(EDIT_OPTIONS) as (keyof typeof EDIT_OPTIONS)[]
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

			await this.client.database.editCase(guild, caseData.id, {
				reason: newData.reason as string
			});
      
			return send(Responses.SUCCESSFULLY_EDITED_CASE(caseID));
		}
		throw new CommandError('INVALID_MODE', keys);
	}
}