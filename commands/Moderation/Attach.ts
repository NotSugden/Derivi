
import { extname } from 'path';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Guild from '../../structures/discord.js/Guild';
import TextChannel from '../../structures/discord.js/TextChannel';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export const VALID_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'mp4'];

export default class Attach extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			examples: ['69 <attached image>'],
			name: 'attach',
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
		if (!this.client.config.attachmentLogging) {
			return send('Attachment Logging needs to be enabled to use this command');
		}
		const caseID = parseInt(args[0]);
		if (isNaN(caseID)) {
			throw new CommandError('INVALID_CASE_ID', args[0] || '');
		}
    
		const config = [...this.client.config.guilds.values()].find(
			cfg => cfg.staffServerCategoryID === (message.channel as TextChannel).parentID
		)!;

		const caseData = await this.client.database.case(
      this.client.guilds.resolve(config.id) as Guild, caseID
		);

		if (!caseData) {
			throw new CommandError('INVALID_CASE_ID', args[0]);
		}

		if (
			!message.attachments.size ||
			message.attachments.some(({ proxyURL, name }) => !VALID_EXTENSIONS.includes(
				extname(name || proxyURL).slice(1).toLowerCase()
			))
		) {
			throw new CommandError('PROVIDE_ATTACHMENT', VALID_EXTENSIONS);
		}

		const urls = [];
		for (const { proxyURL, name, id } of message.attachments.values()) {
			const url = await Util.downloadImage(
				proxyURL,
				`case-reference-${caseData.id}-${id + extname(name || proxyURL)}`,
				this.client.config
			);
			urls.push(url);
		}
		await caseData.update(urls);
		return send(`Updated case ${caseData.id}`);
	}
}