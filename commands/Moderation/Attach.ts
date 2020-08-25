
import { extname } from 'path';
import Command, { CommandData, CommandCategory } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];

export const VIDEO_EXTENSIONS = ['mp4'];

export const VALID_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

export default class Attach extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: CommandCategory.MODERATION,
			cooldown: 5,
			examples: ['69 <attached image>'],
			name: 'attach',
			permissions: async (member, channel) => {
				if (!channel.parentID) return 'You\'re not using this command in the correct category!';
				const config = await this.client.database.guildConfig({
					staff_server_category: channel.parentID
				});
				if (!config) return null;
				const channelID = config.staffCommandsChannelID;
				return channel.id === channelID || `This command can only be used in <#${channelID}>.`;
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
    
		const config = (await this.client.database.guildConfig({
			staff_server_category: message.channel.parentID!
		}))!;

		const caseData = await this.client.database.case(config.guild, caseID);

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