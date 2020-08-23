import { Permissions, SnowflakeUtil, Snowflake } from 'discord.js';
import Command from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { SNOWFLAKE_REGEX } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

const validateSnowflake = (id: string, { past, argumentIndex }: { past?: number; argumentIndex?: number } = {}) => {
	if (!SNOWFLAKE_REGEX.test(id)) {
		throw new CommandError('INVALID_SNOWFLAKE', 'invalid');
	}

	const snowflake = SnowflakeUtil.deconstruct(id);
	if (typeof past === 'number' && snowflake.timestamp < past) {
		throw new CommandError('INVALID_SNOWFLAKE', 'past', argumentIndex);
	}
	if (snowflake.timestamp > Date.now()) {
		throw new CommandError('INVALID_SNOWFLAKE', 'future', argumentIndex);
	}
};

export default class Purge extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [{
				name: 'cb',
				prepend: ['bots']
			}],
			category: 'Moderation',
			cooldown: 5,
			examples: [
				'{alias:1}',
				'bots',
				'{author}',
				'{author} {randomuserid}',
				'100',
				'75 --match="n word"'
			],
			name: 'purge',
			permissions: member => {
				const config = member.guild.config;
				if (!config) return null;
				const hasAccess = config.accessLevelRoles.slice(1).some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
        
				return false;
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments) {
		await message.delete();
		let limit = parseInt(args[0]!);

		const simpleFilter = {} as {
			bots?: boolean;
			roles?: Snowflake[];
			users?: Snowflake[];
		};

		if (/^!?bots$/.test(args[0])) simpleFilter.bots = args[0].charAt(0) !== '!';
		const idMatches = [...args.regular.join(' ').matchAll(/<@(!?|&)([0-9]{17,19})>/g)]
			.map(arr => arr[2]);
		if (idMatches.length === args.regular.length) {
			for (let i = 0; i < idMatches.length;i++) {
				const id = idMatches[i];
				validateSnowflake(id, { argumentIndex: i });
				const user = this.client.users.resolve(id);
				if (user) {
					if (!simpleFilter.users) simpleFilter.users = [];
					simpleFilter.users.push(id);
				} else {
					const role = message.guild.roles.resolve(id);
					if (!role) {
						throw new CommandError('RESOLVE_ID_USER_ROLE', i);
					}
					if (!simpleFilter.roles) simpleFilter.roles = [];
					simpleFilter.roles.push(id);
				}
			}
		}

		const usingSimpleFilter = Object.keys(simpleFilter).length > 0;

		if (!usingSimpleFilter && (isNaN(limit) || limit < 2 || limit > 100)) {
			throw new CommandError('INVALID_NUMBER', { max: 100, min: 2 });
		} else if (usingSimpleFilter) limit = 50;
    
		const { options } = Util.extractOptions((usingSimpleFilter
			? args.regular
			: args.regular.slice(1)
		).join(' '), [{
			name: 'match',
			type: 'string'
		}, {
			name: 'user',
			type: 'string'
		}, {
			name: 'mentions',
			type: ['string', 'boolean']
		}, {
			name: 'bots',
			type: 'boolean'
		}, {
			name: 'before',
			type: 'string'
		}, {
			name: 'after',
			type: 'string'
		}, {
			name: 'matchexact',
			type: 'string'
		}]);

		if (typeof options.before === 'string') {
			validateSnowflake(options.before, { past: message.channel.createdTimestamp });
		}
		if (typeof options.after === 'string') {
			validateSnowflake(options.after, { past: message.channel.createdTimestamp });
		}

		if (options.before && options.after) {
			throw new CommandError('CONFLICTING_FLAGS', ['before', 'after']);
		}
    
		const botsIsBoolean = typeof options.bots === 'boolean';
    
		if (botsIsBoolean) {
			const conflicting = ['bots'];
			if (botsIsBoolean && typeof options.user === 'string') conflicting.push('user');
			if (conflicting.length > 1) throw new CommandError('CONFLICTING_FLAGS', conflicting);
		}
    
		if (typeof options.match === 'string' && typeof options.matchexact === 'string') {
			throw new CommandError('CONFLICTING_FLAGS', ['match', 'matchexact']);
		}
    
		let messages = await message.channel.messages.fetch({
			after: options.after as string,
			before: options.before as string,
			limit
		});
    
		if (typeof options.bots === 'boolean' || typeof simpleFilter.bots === 'boolean') {
			const bool = typeof options.bots === 'boolean' ? options.bots : simpleFilter.bots as boolean;
			messages = messages.filter(msg => msg.author?.bot === bool);
		} else if (typeof options.user === 'string' || simpleFilter.users) {

			const userFlagIsString = typeof options.user === 'string';
			
			const users = userFlagIsString ? (options.user as string).split(/ ?, ?/g)
				.map(str => {
					const [match] = str.match(SNOWFLAKE_REGEX) || [];
					if (!match) return '';
					return match.replace(/^ | $/, '');
				}) : simpleFilter.users as Snowflake[];
      
			if (userFlagIsString) for (const userID of users) validateSnowflake(userID);
      
			messages = messages.filter(msg => msg.author && users.includes(msg.author.id));
		}

		if (simpleFilter.roles) {
			messages = messages.filter(msg => msg.member !== null && simpleFilter.roles!.some(id =>
				msg.member!.roles.cache.has(id)
			));
		}
    
		if (typeof options.match === 'string') {
			messages = messages.filter(msg => msg.content.includes(options.match as string));
		} else if (typeof options.matchexact === 'string') {
			messages = messages.filter(msg => msg.content === options.matchexact);
		}
			
		if (['boolean', 'string'].includes(typeof options.mentions)) {
			if (options.mentions === true) {
				messages = messages.filter(
					msg => Boolean(msg.mentions.users.size || msg.mentions.roles.size || msg.mentions.everyone)
				);
			} else if (typeof options.mentions === 'string') {
				const ids = options.mentions.split(/ ?, ?/g)
					.map(str => {
						const [match] = str.match(SNOWFLAKE_REGEX) || [];
						if (!match) return '';
						return match.replace(/^ | $/, '');
					});
        
				for (const id of ids) validateSnowflake(id);
          
				messages = messages.filter(msg => ids.some(id => 
					msg.mentions.roles.has(id) || msg.mentions.users.has(id)
				));
			}
		}

		if (messages.size === 0) {
			throw new CommandError('PURGE_NO_MESSAGES');
		}
		await message.channel.bulkDelete(messages);
	}
}