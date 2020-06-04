import { Permissions, SnowflakeUtil } from 'discord.js';
import Command from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import Util from '../../util/Util';

const SNOWFLAKE_REGEX = /([0-9]{17,20})/;

const validateSnowflake = (id: string, past?: number) => {
	if (!SNOWFLAKE_REGEX.test(id)) {
		throw new CommandError('INVALID_SNOWFLAKE', 'invalid');
	}

	const snowflake = SnowflakeUtil.deconstruct(id);
	if (typeof past === 'number' && snowflake.timestamp < past) {
		throw new CommandError('INVALID_SNOWFLAKE', 'past');
	}
	if (snowflake.timestamp > Date.now()) {
		throw new CommandError('INVALID_SNOWFLAKE', 'future');
	}
};

export default class Purge extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
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
			},
			usages: [{
				required: true,
				type: 'limit'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments) {
		await message.delete();
		const limit = parseInt(args[0]!);
    
		if (isNaN(limit) || limit < 2 || limit > 100) {
			throw new CommandError('INVALID_NUMBER', { max: 100, min: 2 });
		}
    
		const { flags } = Util.extractFlags(args.regular.slice(1).join(' '), [{
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
		}]);

		if (typeof flags.before === 'string') {
			validateSnowflake(flags.before, message.channel.createdTimestamp);
		}
		if (typeof flags.after === 'string') {
			validateSnowflake(flags.after, message.channel.createdTimestamp);
		}

		if (flags.before && flags.after) {
			throw new CommandError('CONFLICTING_FLAGS', ['before', 'after']);
		}
    
		if (typeof flags.bots === 'boolean' && (flags.user || flags.mentions || flags.match)) {
			const conflicting = ['bots'];
			if (flags.user) conflicting.push('user');
			if (flags.mentions) conflicting.push('mentions');
			if (flags.match) conflicting.push('match');
			throw new CommandError('CONFLICTING_FLAGS', conflicting);
		}
    
		let messages = await message.channel.messages.fetch({
			after: flags.after as string,
			before: flags.before as string,
			limit
		});
    
		if (typeof flags.bots === 'boolean') {
			messages = messages.filter(msg => msg.author?.bot === flags.bots);
		} else {
			if (typeof flags.match === 'string') {
				messages = messages.filter(msg => msg.content.includes(flags.match as string));
			}
			if (typeof flags.user === 'string') {
				const users = flags.user.split(/ ?, ?/g)
					.map(str => {
						const [match] = str.match(SNOWFLAKE_REGEX) || [];
						if (!match) return '';
						return match.replace(/^ | $/, '');
					});
        
				for (const userID of users) validateSnowflake(userID);
        
				messages = messages.filter(msg => msg.author && users.includes(msg.author.id));
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
						msg.mentions.roles.has(id) || msg.mentions.users.has(id) ||
            msg.mentions.roles.some(role => role.name === id)
					));
				}
			}

			if (messages.size === 0) {
				throw new CommandError('PURGE_NO_MESSAGES');
			}
		}
		await message.channel.bulkDelete(messages);
	}
}