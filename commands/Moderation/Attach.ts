import { promises as fs } from 'fs';
import { extname, join } from 'path';
import fetch from 'node-fetch';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import Client from '../../util/Client';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

const VALID_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];

const download = async (url: string, name: string, config: Client['config']) => {
	const buffer = await fetch(url)
		.then(resp => resp.buffer())
		.then(data => Util.encrypt(data, config.encryptionPassword));
	await fs.writeFile(join(config.filesDir, name), buffer);
	return `${config.attachmentsURL!}/${name}`;
};

export default class Attach extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Moderation',
			cooldown: 5,
			name: 'attach',
			permissions: (member, channel) => {
				const channelID = member.client.config.punishmentChannelID;
				if (member.guild.id === member.client.config.defaultGuildID) {
					return channelID ?
						`This command can only be used in <#${channelID}>.` :
						'The `punishments` channel has not been configured.';
				}
				return channel.id === channelID;
			},
			usages: [{
				required: true,
				type: 'case number'
			},{
				extras: ['attachment/jpg', 'attachment/jpeg', 'attachment/gif'],
				required: true,
				type: 'attachment/png'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		if (!this.client.config.attachmentLogging) {
			return send('Attachment Logging needs to be enabled to use this command');
		}
		const caseID = parseInt(args[0]);
		if (isNaN(caseID)) return send(Responses.INVALID_CASE_ID(args[0] || ''));

		const caseData = await message.client.database.case(caseID);

		if (!caseData) return send(Responses.INVALID_CASE_ID(args[0]));

		if (
			!message.attachments.size ||
			message.attachments.some(({ proxyURL }) => !VALID_EXTENSIONS.includes(extname(proxyURL).slice(1)))
		) return send(Responses.PROVIDE_ATTACHMENT(VALID_EXTENSIONS));

		const urls = [];
		for (const attachment of message.attachments.values()) {
			const url = await download(
				attachment.proxyURL,
				`case-reference-${caseData.id}-${attachment.id + extname(attachment.proxyURL)}`,
				this.client.config
			);
			urls.push(url);
		}
		await caseData.update(urls);
		return send(`Updated case ${caseData.id}`);
	}
}