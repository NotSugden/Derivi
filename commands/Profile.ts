import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import Command, { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import CommandManager from '../util/CommandManager';
import { GuildMessage } from '../util/Types';
import Util from '../util/Util';

const drawText = (context: CanvasRenderingContext2D, text: string, font: string, {
	color = '#ffffff', x, y
}: { x: number; y: number; color?: string }) => {
	context.font = font;
	context.fillStyle = color;
	return context.fillText(text, x, y);
};

export default class Profile extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			arguments: [{
				type: 'user'
			}],
			category: 'General',
			cooldown: 5,
			name: 'profile'
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const profile = await this.client.database.profile(user);
		const { level, xp } = await this.client.database.levels(user);
    
		const canvas = createCanvas(798, 798);
		const context = canvas.getContext('2d');
		const background = await loadImage('./assets/original.jpg');
		const avatar = await loadImage(message.author.displayAvatarURL({
			format: 'jpg', size: 256
		}));
		context.drawImage(background, 0, 0, canvas.width, canvas.height);
		context.drawImage(avatar, 78, 178, 150, 150);
		drawText(context, message.author.username, '50px bebas-neue', { x: 265, y: 230 });
		drawText(context, `${profile.rep} Rep`, '40px bebas-neue', { x: 520, y: 313 });
		drawText(context, level.toString(), '55px bebas-neue', { x: 207, y: 463 });
		drawText(context, xp.toString(), '55px bebas-neue', { x: 337, y: 463 });
		return send({ files: [{
			attachment: canvas.toBuffer(),
			name: 'profile.png'
		}] });
	}
}