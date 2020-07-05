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
			arguments: [{
				extras: ['...user', '...role', '\'bots\''],
				required: true,
				type: 'limit'
			}],
			category: 'Moderation',
			cooldown: 5,
			name: 'purge',
			permissions: member => {
				const config = member.client.config.guilds.get(member.guild.id);
				if (!config) return false;
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
    
		const { flags } = Util.extractFlags((usingSimpleFilter
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

		if (typeof flags.before === 'string') {
			validateSnowflake(flags.before, { past: message.channel.createdTimestamp });
		}
		if (typeof flags.after === 'string') {
			validateSnowflake(flags.after, { past: message.channel.createdTimestamp });
		}

		if (flags.before && flags.after) {
			throw new CommandError('CONFLICTING_FLAGS', ['before', 'after']);
		}
    
		const botsIsBoolean = typeof flags.bots === 'boolean';
    
		if (botsIsBoolean) {
			const conflicting = ['bots'];
			if (botsIsBoolean && typeof flags.user === 'string') conflicting.push('user');
			if (conflicting.length > 1) throw new CommandError('CONFLICTING_FLAGS', conflicting);
		}
    
		if (typeof flags.match === 'string' && typeof flags.matchexact === 'string') {
			throw new CommandError('CONFLICTING_FLAGS', ['match', 'matchexact']);
		}
    
		let messages = await message.channel.messages.fetch({
			after: flags.after as string,
			before: flags.before as string,
			limit
		});
    
		if (typeof flags.bots === 'boolean' || typeof simpleFilter.bots === 'boolean') {
			const bool = typeof flags.bots === 'boolean' ? flags.bots : simpleFilter.bots as boolean;
			messages = messages.filter(msg => msg.author?.bot === bool);
		} else if (typeof flags.user === 'string' || simpleFilter.users) {

			const userFlagIsString = typeof flags.user === 'string';
			
			const users = userFlagIsString ? (flags.user as string).split(/ ?, ?/g)
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
    
		if (typeof flags.match === 'string') {
			messages = messages.filter(msg => msg.content.includes(flags.match as string));
		} else if (typeof flags.matchexact === 'string') {
			messages = messages.filter(msg => msg.content === flags.matchexact);
		}
			
		if (['boolean', 'string'].includes(typeof flags.mentions)) {
			if (flags.mentions === true) {
				messages = messages.filter(
					msg => Boolean(msg.mentions.users.size || msg.mentions.roles.size || msg.mentions.everyone)
				);
			} else if (typeof flags.mentions === 'string') {
				const ids = flags.mentions.split(/ ?, ?/g)
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