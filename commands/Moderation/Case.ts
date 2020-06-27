import { Permissions, MessageEmbed, Util as DJSUtil, Snowflake } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Guild from '../../structures/discord.js/Guild';
import TextChannel from '../../structures/discord.js/TextChannel';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

const OPTIONS = ['edit', 'delete'];
const EDIT_OPTIONS = ['reason'];

export default class Case extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
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
			},
			usages: [{
				required: true,
				type: 'case number'
			}, {
				extras: ['"delete"'],
				type: '"edit"'
			}]
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const mode = args[0];
		if (!OPTIONS.includes(mode)) {
			throw new CommandError('INVALID_OPTION', OPTIONS);
		}

		const caseID = parseInt(args[1]);
		if (isNaN(caseID)) {
			throw new CommandError('INVALID_CASE_ID', args[1] || '');
		}
    
		const config = [...this.client.config.guilds.values()].find(
			cfg => cfg.staffServerCategoryID === (message.channel as TextChannel).parentID
		)!;
    
		const guild = this.client.guilds.resolve(config.id) as Guild;

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
    
		if (mode === 'delete') {
			const channel = this.client.channels.resolve(config.casesChannelID) as TextChannel;
			const caseMessage = await channel.messages.fetch(caseData.logMessageID);
			await caseMessage.delete();
			const response = await send(Responses.DELETE_CASE(caseID));
			await this.client.database.deleteCase(guild, caseID);
			const cases = await this.client.database.query(
				'SELECT message_id, id FROM cases WHERE id > ? AND guild_id = ?',
				caseID, guild.id
			) as { message_id: Snowflake; id: number }[];
			await this.client.database.query(
				'UPDATE cases SET id = id - 1 WHERE id > ? AND guild_id = ?',
				caseID, guild.id
			);
			if (!cases.length) return response.edit(Responses.DELETE_CASE(caseID, true)) as Promise<GuildMessage<true>>;
			for (const data of cases) {
				const msg = await channel.messages.fetch(data.message_id);
				await msg.edit(`Case ${data.id - 1}`, new MessageEmbed(msg.embeds[0]));
				await DJSUtil.delayFor(2500);
			}

			return response.edit(Responses.DELETE_CASE(caseID, true)) as Promise<GuildMessage<true>>; 
		} else if (mode === 'edit') {
			const newData = Util.getOptions(args.regular.slice(1).join(' '), EDIT_OPTIONS);
			if (!Object.keys(newData).length) {
				throw new CommandError('NO_OPTIONS', EDIT_OPTIONS);
			}
      
			const caseMessage = await caseData.logMessage();
      
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
      
			await this.client.database.query(
				'UPDATE cases SET reason = ?', // well at the moment only the reason can be edited so...
				newData.reason
			);
      
      
      
			return send(Responses.SUCCESSFULLY_EDITED_CASE(caseID));
		}
	}
}