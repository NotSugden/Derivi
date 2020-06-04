import { join } from 'path';
import {
	Constants, EmbedFieldData, RoleData,
	MessageEmbed, Snowflake, MessageOptions,
	MessageAttachment
} from 'discord.js';
import * as moment from 'moment';
import Client, { ShopItem } from './Client';
import { Invite, PartialMessage } from './Types';
import Util from './Util';
import { Card } from '../commands/Points/Blackjack';
import Case from '../structures/Case';
import Levels from '../structures/Levels';
import Warn from '../structures/Warn';
import Guild from '../structures/discord.js/Guild';
import GuildMember from '../structures/discord.js/GuildMember';
import Message from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import User from '../structures/discord.js/User';
/* eslint-disable sort-keys */

const neverReturn = () => {
	throw null;
};

const EMOJI_CARDS = [
	{ suit: 'Diamonds', value: '2', emoji: '<:2D:625291323540504616>' },
	{ suit: 'Clubs', value: '2', emoji: '<:2C:625291323557150750>' },
	{ suit: 'Hearts', value: '2', emoji: '<:2H:625291324224045056>' },
	{ suit: 'Clubs', value: '4', emoji: '<:4C:625291324324839435>' },
	{ suit: 'Diamonds', value: '3', emoji: '<:3D:625291324333096985>' },
	{ suit: 'Hearts', value: '3', emoji: '<:3H:625291324337160213>' },
	{ suit: 'Clubs', value: '3', emoji: '<:3C:625291324341616661>' },
	{ suit: 'Spades', value: '3', emoji: '<:3S:625291324358262794>' },
	{ suit: 'Spades', value: '2', emoji: '<:2S:625291324396011520>' },
	{ suit: 'Diamonds', value: '4', emoji: '<:4D:625291324442148864>' },
	{ suit: 'Hearts', value: '4', emoji: '<:4H:625291326795284480>' },
	{ suit: 'Diamonds', value: 'A', emoji: '<:AD:625291327147606017>' },
	{ suit: 'Hearts', value: 'A', emoji: '<:AH:625291327185223700>' },
	{ suit: 'Clubs', value: 'A', emoji: '<:AC:625291327252463616>' },
	{ suit: 'Spades', value: '4', emoji: '<:4S:625291327797461002>' },
	{ suit: 'Diamonds', value: '5', emoji: '<:5D:625291327927484427>' },
	{ suit: 'Spades', value: '5', emoji: '<:5S:625291327994593291>' },
	{ suit: 'Spades', value: '6', emoji: '<:6S:625291328452034580>' },
	{ suit: 'Diamonds', value: '7', emoji: '<:7D:625291328456228885>' },
	{ suit: 'Spades', value: '7', emoji: '<:7S:625291328560824331>' },
	{ suit: 'Hearts', value: '7', emoji: '<:7H:625291328560824333>' },
	{ suit: 'Hearts', value: '5', emoji: '<:5H:625291328581926922>' },
	{ suit: 'Diamonds', value: '6', emoji: '<:6D:625291328762413056>' },
	{ suit: 'Hearts', value: '6', emoji: '<:6H:625291328800161792>' },
	{ suit: 'Clubs', value: '5', emoji: '<:5C:625291329055752198>' },
	{ suit: 'Diamonds', value: '8', emoji: '<:8D:625291329257340929>' },
	{ suit: 'Spades', value: '9', emoji: '<:9S:625291329366130709>' },
	{ suit: 'Clubs', value: '6', emoji: '<:6C:625291329383170068>' },
	{ suit: 'Spades', value: '8', emoji: '<:8S:625291329450147860>' },
	{ suit: 'Diamonds', value: '9', emoji: '<:9D:625291329504673802>' },
	{ suit: 'Spades', value: '10', emoji: '<:10S:625291329508868096>' },
	{ suit: 'Hearts', value: '8', emoji: '<:8H:625291329550680074>' },
	{ suit: 'Hearts', value: '9', emoji: '<:9H:625291329592754187>' },
	{ suit: 'Spades', value: 'A', emoji: '<:AS:625291329764589579>' },
	{ suit: 'Hearts', value: '10', emoji: '<:10H:625291329844281345>' },
	{ suit: 'Clubs', value: '10', emoji: '<:10C:625291330431614977>' },
	{ suit: 'Clubs', value: '8', emoji: '<:8C:625291330465169408>' },
	{ suit: 'Clubs', value: '9', emoji: '<:9C:625291330532147240>' },
	{ suit: 'Clubs', value: '7', emoji: '<:7C:625291331501162506>' },
	{ suit: 'Diamonds', value: '10', emoji: '<:10D:625291331819798549>' },
	{ suit: 'Clubs', value: 'J', emoji: '<:JC:625294117039243264>' },
	{ suit: 'Diamonds', value: 'J', emoji: '<:JD:625294117483839528>' },
	{ suit: 'Hearts', value: 'J', emoji: '<:JH:625294118138150932>' },
	{ suit: 'Spades', value: 'K', emoji: '<:KS:625294118171705344>' },
	{ suit: 'Clubs', value: 'K', emoji: '<:KC:625294118293078027>' },
	{ suit: 'Diamonds', value: 'K', emoji: '<:KD:625294118599262228>' },
	{ suit: 'Spades', value: 'J', emoji: '<:JS:625294118683279360>' },
	{ suit: 'Hearts', value: 'K', emoji: '<:KH:625294119236796416>' },
	{ suit: 'Clubs', value: 'Q', emoji: '<:QC:625294143131877397>' },
	{ suit: 'Spades', value: 'Q', emoji: '<:QS:625294144700547072>' },
	{ suit: 'Hearts', value: 'Q', emoji: '<:QH:625294145451196446>' },
	{ suit: 'Diamonds', value: 'Q', emoji: '<:QD:625294145702985740>' }
];

export const ModerationActionTypes = {
	BAN: Constants.Colors.RED,
	KICK: Constants.Colors.ORANGE,
	MUTE: Constants.Colors.GREY,
	WARN: Constants.Colors.YELLOW,
	SOFT_BAN: Constants.Colors.PURPLE
};

const hyperlink = (name: string, url: string) => `[${name}](${url})`;

const messageURL = (guildID: Snowflake, channelID: Snowflake, messageID: Snowflake) =>
	`https://discord.com/channels/${guildID}/${channelID}/${messageID}`;

export const Defaults = {
	CLIENT_CONFIG: {
		commands_dir: join(__dirname, '..', 'commands'),
		files_dir: join(__dirname, '..', 'saved_files')
	},
	// this is a getter for now, incase djs modifies the object
	get MUTE_ROLE_DATA() {
		return {
			color: 'DARKER_GREY',
			hoist: false,
			mentionable: false,
			name: 'Muted',
			permissions: 0
		} as RoleData;
	}
};

export const Errors = {
	INVALID_CLIENT_OPTION: (option: string, className: string) =>
		`Client config option '${option}' couldn't be resolved to a valid ${className}.`,

	CASE_RESOLVE_USER: (index: number) => `Couldn't resolve a User from 'users[${index}]'.`,

	RESOLVE_PROVIDED: (parameter: string) => `Couldn't resolve the User from the provided '${parameter}'.`,

	LEVELS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} levels of.`,
	POINTS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} points of.`,
	WARNS_RESOLVE_ID: 'Couldn\'t resolve the User ID to fetch warns from.',
	MUTE_RESOLVE_ID: (fetch = true) =>
		`Couldn't resolve the User ID to ${fetch ? 'fetch the mute of' : 'delete the mute'}.`,

	NEGATIVE_NUMBER: (variable: string) => `Provided '${variable}' is negative, and should be positive.`,
	RESOLVE_COMMAND: 'The command passed couldn\'t be resolved',

	COMMAND_LOAD_FAILED: (name: string) => `Failed to load command ${name}`,
	INVALID_TYPE: (parameter: string, type: string) => `Provided '${parameter}' should be a '${type}'`
};

export const CommandErrors = {
	// eslint-disable-next-line max-len
	NEED_MFA: 'You need to enable Two Factor Authentication to use this command, you can find out how to do this at <https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Two-Factor-Authentication>',
	NOT_LOGGED_IN: (loginURL: string) => `You need to be logged in at <${loginURL}> to use this command.`,
	PURGE_NO_MESSAGES: 'There were no messages to delete',
	CONFLICTING_FLAGS: (flags: string[]) => 
		`The flags ${flags.map(f => `\`${f}\``).join(', ')} cannot be used together`,
	INVALID_SNOWFLAKE: (reason: 'invalid' | 'future' | 'past') => {
		if (reason === 'invalid') return 'The ID provided is invalid.';
		if (reason === 'future') return 'The ID provided is too far in the future!';
		if (reason === 'past') return 'The ID provided is too far in the past!';
		neverReturn();
	},
	ALL_MUTED: 'All of the mentioned members are muted.',
	ALREADY_REMOVED_USERS: (multiple: boolean, kick = true) =>
		`${multiple ? 'All of the members' : 'The member'} you mentioned ${multiple ? 'have' : 'has'} already ${
			kick ?
				'left or been kicked' :
				'been banned'
		}.`,
	CANNOT_ACTION_USER: (action: keyof typeof ModerationActionTypes, multiple = false) =>
		`You cannot perform a ${action.toLowerCase()} on ${multiple ? 'one of the users you mentioned' : 'this user'}`,
	INVALID_TIME: (time = '2 minutes') => `The time you provided is less than ${time}, which is the minimum.`,
	INSUFFICIENT_PERMISSIONS: 'You have insufficient permissions to perform this action.',
	MENTION_USERS: (users = true) => `Please mention at least 1 ${users ? 'user' : 'member'}.`,
	MENTION_USER: (user = true) => `Please mention a ${user ? 'user' : 'member'}.`,
	PROVIDE_REASON: 'Please supply a reason for this action.',
	INVALID_FLAG_TYPE: (flag: string, type: string | string[]) => `Flag ${flag} must be ${
		Array.isArray(type) ? `one of ${type.map(t => `\`${t}\``).join(', ')}` : type}`,
	INVALID_FLAG: (provided: string, valid: string[]) =>
		`Provided flag '${provided}' is not valid, valid flags for this command are: ${valid.join(', ')}`,
	INVALID_CASE_ID: (provided: string) => `'${provided}' isn't a valid case number.`,
	PROVIDE_ATTACHMENT: (valid: string[]) =>
		`Please upload an attachment with one of the following extensions: ${
			valid.map(ext => `\`${ext}\``).join(', ')
		}.`,
	RESOLVE_ID: (id: string) =>
		`An ID or user mention was provided, but the user couldn't be resolved, are you sure its valid? (${id})`,
	TOO_MANY_INVITES: (max = 1) => `A maximum of ${max} invites is permitted here.`,
	NO_INVITE: 'You must provide an invite link.',
	CLIENT_BANNED_INVITE: 'The ASC bot seems to be banned from that guild, ask that server\'s owner why.',
	UNKNOWN_INVITE: (code: string) => `The invite you provided, \`${code}\`, is invalid.`,
	GROUP_INVITE: 'The invite you provided is for a group, not a guild.',
	PARTNER_MEMBER_COUNT: (minimum: boolean) => `The invite you sent ${
		minimum ?
			'does not have enough' :
			'has too many'
	} members for this channel.`,
	INVALID_OPTION: (validOptions: string[], index = 1) => 
		`Argument ${index} is not a valid option, valid options are ${
			validOptions.map(option => `\`${option}\``).join(', ')
		}.`,
	INVALID_NUMBER: ({ min, max }: { min?: number; max?: number} = {}) => {
		let str = 'The number you provided is invalid';
		if (typeof min === 'number') str += `, it must be a minimum of ${min}`;
		if (typeof max === 'number') {
			str += `${typeof min === 'number' ? ' and a maximum of' : ', it must be no higher than'} ${max}`;
		}
		return `${str}.`;
	},
	NOT_ENOUGH_POINTS: (required: number, wallet = true) =>
		`You need at least ${required} points in your ${wallet ? 'wallet' : 'vault'} to do this.`,
	NO_POINTS: (vault = false) => `You do not have any points${vault ? ' in the vault' : ''}.`,
	UNKNOWN_SHOP_ITEM: (item: string) => `${item} isn't listed in the shop.`,
	ALREADY_PURCHASED: 'You already own this item.',
	DAILY_WAIT: (time: string) => `You need to wait ${time} to collect your next daily points.`,
	LOCKED_POINTS: (yours = true) =>
		`${yours ? 'Your' : 'Their'} points are currently locked, this is likely due to ${
			yours ? 'you' : 'them'
		} playing a game.`,
	NOT_PERMITTED_CASE_MODIFY: (action: string) => 
	// eslint-disable-next-line max-len
		`You're not permitted to ${action} this case, you must either be the person who issued it or have the \`Administrator\` permission.`,
	NO_OPTIONS: (valid: string[]) =>
		`You have not provided any options, use the format \`optionName="value"\`, valid options are ${
			valid.map(opt => `\`${opt}\``).join(', ')
		}.`,
	INVALID_OPTION_TYPE: (option: string, validTypes: string[]) =>
		`Option ${option} is not valid, it should be one of ${
			validTypes.map(type => `\`${type}\``).join(', ')
		}.`
};

export type MatchState = 'won' | 'lost' | 'draw' | 'idle'

export const Responses = {
	SUCCESSFULLY_EDITED_CASE: (id: number) => `Successfully edited case ${id}.`,
	STARBOARD_EMBED: (stars: number, message: Message) => {
		const embed = new MessageEmbed()
			.addFields({
				inline: true,
				name: 'Author',
				value: message.author.toString()
			}, {
				inline: true,
				name: 'Channel',
				value: message.channel.toString()
			})
			.setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
			.setFooter(`${stars} Stars`).setTimestamp(message.createdAt);
		embed.setDescription([
			hyperlink('Jump', messageURL(message.guild!.id, message.channel.id, message.id)),
			message.content
		]);
		if (['png', 'jpg', 'jpeg', 'gif'].some(ext => message.attachments.first()?.name?.endsWith(ext))) {
			embed.setImage(message.attachments.first()!.url);
		}
		return embed;
	},
	STAR_OWN_MESSAGE: (user: User) => ({
		content: `${user}, You cannot star your own messages.`,
		allowedMentions: {
			users: [user.id]
		}
	}),
	DELETE_CASE: (caseID: number, deleted = false) => {
		if (!deleted) return `Deleting case ${caseID}, this may take a while to complete.`;
		return `Deleted case ${caseID}.`;
	},
	POINTS_MODIFY: (user: User, amount: number, mode: 'add' | 'set' | 'remove') => {
		if (mode === 'set') return `Successfully set ${user.username}'s points to ${amount}.`;
		return `Successfully ${mode === 'add' ? 'added' : 'removed'} ${amount} points from ${user.username}.`;
	},
	GAME_END_STATE: (state: MatchState, bet: number) => `You ${state === 'won' ? 'won' : 'lost'} **${bet}** points.`,
	BLACKJACK_MESSAGE: (userHand: Card[], dealerHand: Card[], bet: number) => {
		const mapHand = (hand: Card[]) => hand.map(
			card => EMOJI_CARDS.find(({ value, suit }) => value === card.value && suit === card.suit)?.emoji
		).join(' ');
		const getWeight = (deck: Card[]) => deck.reduce((acc, card) => acc + card.weight, 0);
		return new MessageEmbed()
			.setTitle('Blackjack')
			.setDescription([
				'Type `hit` for another card, `double` to double bet and draw card or `stand` to end your turn.',
				'Type `rules` for rules.'
			])
			.addFields({
				name: 'Your hand',
				value: [
					mapHand(userHand),
					`Total: ${getWeight(userHand)}`
				]
			}, {
				name: 'Dealers hand',
				value: [
					mapHand(dealerHand),
					`Total: ${getWeight(dealerHand)}`
				]
			})
			.setFooter(`Your bet: ${bet}`);
	},
	BLACKJACK_RULES: () => {
		const RIGHT_ARROW = '<:RightArrow:597212645812207633>';
		return new MessageEmbed()
			.setTitle('How to play')
			.addFields({
				name: 'Goal',
				value: `${RIGHT_ARROW} beat the dealer's hand without going over 21.`
			}, {
				name: 'Moves',
				value: [
					`${RIGHT_ARROW} \`Hit\` is to ask for another card.`,
					`${RIGHT_ARROW} \`Stand\` is to hold your total and end your turn.`,
					`${RIGHT_ARROW} \`Double\` is to double your bet and add another card to your hand.`,
					`${RIGHT_ARROW} \`Split\` is to divide hand into two. Can only be done with two of the same card.`
				]
			}, {
				name: 'Outcome',
				value: `${RIGHT_ARROW} If you go over 21 you bust, and the dealer wins regardless of the dealer's hand.`
			});
	},
	TRANSFER_SUCCESS: (user: User, amount: number) =>
		`Successfully transferred **${amount}** points to **${user.username}**.`,
	COLLECTED_DAILY: (amount = 250) => `Collected daily **${amount}** points.`,
	SUCCESSFUL_PURCHASE: (item: string) => `Successfully purchased **${item}**.`,
	SHOP_LAYOUT: (items: ShopItem[], guild: Guild) => {
		const RIGHT_ARROW = '<:RightArrow:597212645812207633>';
		return [...items.map(item => {
			if (item.action === 'give_role') {
				const role = guild.roles.cache.get(item.role_id)!;
				return `${RIGHT_ARROW} **${role.name}** Role for ${
					item.cost > 0 ?
						`**${item.cost}** Points` :
						'**Free**'
				}.`;
			}
		}), 'Use `.buy [name]` to buy an item.'];
	},
	WITHDRAW_SUCCESS: (amount: number) => `Successfully withdrew **${amount}** points.`,
	DEPOSIT_SUCCESS: (amount: number) => `Successfully deposited **${amount}** points.`,
	VAULT_CHECK: (user: User, amount: number) => 
		`You have **${amount}** points in your vault.`,
	POINTS: (user: User, amount: number, self = true) =>
		`${self ? 'You' : 'They'} have **${amount}** points in ${self ? 'your' : 'their'} wallet.`,
	TOP: (levels: Levels[], guild: Guild) => {
		return new MessageEmbed()
			.setAuthor(`${guild.name} Leaderboards`, guild.iconURL({ dynamic: true })!)
			.setDescription(levels.map(
				(data, index) => `**#${index+1}** - ${data.user?.tag || 'Unkown User#0000'} Level ${data.level}`
			))
			.setColor('WHITE');
	},
	LEVEL: (user: User, level: number, xp: number) => {
		const LEFT_BORDER = '<:Lines2:597212619299880962>';
		const RIGHT_BORDER = '<:Lines3:594509306364297228>';
		const RIGHT_ARROW = '<:RightArrow:597212645812207633>';
		const MIDDLE_BORDER = '<:Lines:597212592167059456>';

		return [
			`**${user.username}**#${user.discriminator}`,
			`${LEFT_BORDER}${MIDDLE_BORDER.repeat(6)}${RIGHT_BORDER}`,
			//`${RIGHT_ARROW} Rank **${rank}**`,
			`${RIGHT_ARROW} Level **${level}**`,
			`${LEFT_BORDER}${MIDDLE_BORDER.repeat(6)}${RIGHT_BORDER}`,
			`XP: **${xp}**/**${Util.levelCalc(level).toFixed(0)}**`
		];
	},
	LEVEL_UP: (user: User, newLevel: number) => ({
		content: `Congrats ${user}, you're now level ${newLevel}.`,
		allowedMentions: {
			users: [user.id]
		}
	}),
	PARTNER_REWARD: (user: User, channel: TextChannel, points: number) => ({
		content: `${user} Was rewarded **${points}** points for a ${channel}.`,
		allowedMentions: {
			users: [user.id]
		}
	}),
	AUTO_REPORT_EMBED: (message: Message) => {
		return new MessageEmbed()
			.setAuthor('Alert')
			.setColor('RED')
			.setDescription(
				`${message.author.tag} (${message.author}) has __${
					message.edits.length > 1 ? 'edited' : 'sent'
				}__ a ${hyperlink('message', message.url)} with a possible restricted term`
			).addFields({
				name: 'Message Content',
				value: message.content.length > 1000 ?
					`${message.content.slice(0, 1000)}...` :
					message.content
			});
	},
	HISTORY: (cases: Case[]) => {
		return cases.flatMap(caseData => [
			`${caseData.id}: ${caseData.action.charAt(0) + caseData.action.slice(1).toLowerCase()} ${
				caseData.moderator?.tag || caseData.moderatorID
			} (${moment.utc(caseData.timestamp).format('DD/MM/YYYY HH:mm A')}): ${caseData.reason}`,
			...Object.entries(caseData.extras).map(([name, value]) => `${name}: ${value}`)
		]);
	},
	WARNINGS: (warns: Warn[]) => {
		return warns.map(warn => `(${warn.caseID}) ${
			warn.moderator?.tag || warn.moderatorID
		} (${moment.utc(warn.timestamp).format('DD/MM/YYYY HH:mm A')}): ${warn.reason}`);
	},
	MODERATION_LOG_FIELDS: (moderator: User, users: User[]): EmbedFieldData[] => [{
		name: 'Moderator',
		value: `${moderator.tag} (${moderator.id})`
	}, {
		name: `User${users.length > 1 ? 's' : ''} punished`,
		value: users.map(({ tag, id }) => `${tag} (${id})`)
	}],
	MODERATION_LOG_DESCRIPTION: (action: keyof typeof ModerationActionTypes, reason: string, extras: object) => {
		const description = [
			`ASC Logs: ${action.split('_').map(str => str.charAt(0) + str.slice(1).toLowerCase())}`
		];
		if (Object.keys(extras).length) {
			description.push(...Object.entries(extras)
				.map(([key, value]) => `${key}: ${value}`));
		}
		return [...description, `Reason: ${reason}`];
	},

	AUDIT_LOG_MEMBER_REMOVE: (moderator: User, caseID: number, kick: boolean | null = true) =>
		`${kick ?
			'Kicked' :
			kick === null ? 'Softbanned' : 'Banned'
		} by ${moderator.tag}: Case ${caseID}`,

	/**
   * Big spaghetti code ;(
	 * if someone wants to prettify this be my guest
	 */
	MEMBER_REMOVE_SUCCESSFUL: ({ filteredUsers, members, users }: {
		filteredUsers?: User[];
		members?: GuildMember[];
		users: User[];
	}, kick: boolean | null = true) => {

		const content = [
			`${kick ? 'Kicked' : kick === null ? 'Softbanned' : 'Banned'} ${
				(members || users).length === 1 ?
					(members ? members[0].user : users[0]).tag :
					`${(members || users).length} members`
			}.`
		];

		const array = members || filteredUsers!;

		if (array.length !== users.length) {
			const amount = users.length - array.length;
			content.push(`Couldn't ${
				kick ? 'kick' : kick === null ? 'softban' : 'ban'
			} ${amount} other user${amount > 1 ? 's' : ''}, as they had already ${
				kick ? 'left/been kicked' : 'been banned'
			}.`);
		}
		return content;
	},

	WARN_SUCCESS: (users: User[], reason: string) =>
		`${users.length > 1 ? `${users.length} Users were` : `${users[0].tag} was`} warned for ${reason}.`,
	MUTE_SUCCESS: (members: GuildMember[], reason: string) =>
		`${members.length > 1 ? `${members.length} Members were` : `${members[0].user.tag} was`} muted for ${reason}.`
};

export const URLs = {
	HASTEBIN: (endpointOrID?: string) => `https://paste.nomsy.net${endpointOrID ? `/${endpointOrID}` : ''}`
};

export const FLAGS_REGEX = /(--|—)([a-z]+)=('[^']*'|“[^“]*“|"[^"]*"|[0-9a-z]*)/gi;
export const OPTIONS_REGEX = /([a-z]*)=('[^']*'|“[^“]*“|"[^"]*"|[0-9a-z]*)/gi;

export const EventResponses = {
	FILE_PERMISSIONS_NOTICE: (dm: true | GuildMember, guild: Guild): string | MessageOptions => {
		// eslint-disable-next-line
		if (dm === true) return `Please note that by sending attachments in ${guild.name} they are being downloaded and saved for moderation purposes, you can request these be deleted at any time by messaging Sugden#0562`;
		return {
			content: `${dm}, ${EventResponses.FILE_PERMISSIONS_NOTICE(true, guild)}`,
			allowedMentions: {
				users: [dm.id]
			}
		};
	},
	INVITE_CREATE: (invite: Invite) => {
		return new MessageEmbed()
			.setAuthor(`Invite created in #${(invite.channel as TextChannel).name} by ${
				invite.inviter ? invite.inviter.tag : 'Unknown User#0000'
			}`)
			.setColor(Constants.Colors.GREEN)
			.setDescription([
				`Invite Code: ${hyperlink(invite.code, invite.url)}`,
				`Expires at: ${invite.expiresTimestamp ? moment.utc(invite.expiresAt!).format(
					'DD/MM/YYYY HH:mm A'
				) : 'Never'}`,
				`Inviter: ${invite.inviter ? `${invite.inviter} (${invite.inviter.id})` : 'Unknown User#0000'}`,
				`Max Uses: ${invite.maxUses ?? 'Infinite'}`,
				`Temporary?: ${invite.temporary ? 'Yes' : 'No'}`
			])
			.setFooter(`User ID: ${invite.inviter?.id || '00000000000000000'}`)
			.setTimestamp(invite.createdAt!);
	},
	INVITE_DELETE: (invite: Invite) => {
		return new MessageEmbed()
			.setAuthor(`Invite deleted in #${(invite.channel as TextChannel).name}, created by ${
				invite.inviter?.tag || 'Unknown User#0000'
			}`)
			.setColor(Constants.Colors.RED)
			.setDescription([
				`Inivte Code: ${invite.code}`,
				// Could check for `invite.uses === invite.maxUses` here however it's never updated so there's no point
				`Expired?: ${invite.expiresTimestamp && invite.expiresTimestamp < Date.now() ? 'Yes' : 'No'}`,
				`Inviter: ${invite.inviter ? `${invite.inviter} (${invite.inviter.id})` : 'Unknown User#0000'}`,
				`Max Uses: ${invite.maxUses ?? 'Infinite'}`,
				`Temporary?: ${invite.temporary ? 'Yes' : 'No'}`
			])
			.setFooter(`User ID: ${invite.inviter?.id || '00000000000000000'}`)
			.setTimestamp(invite.createdAt!);
	},

	GUILD_MEMBER_ADD: (member: GuildMember & { client: Client }, webhook = true) => {
		const config = member.client.config.guilds.get(member.guild.id)!;
		return {
			content: `<:RightArrow:597212645812207633> ${
				config.welcomeRoleID && member.guild.roles.cache.has(config.welcomeRoleID) ?
					`<@&${config.welcomeRoleID}>` : 'Welcome'
			} to **${
				member.guild.name
			}** ${member.user}, you can click ${
				webhook && config.rulesMessageID ? `[here](<${
					messageURL(member.guild.id, config.rulesChannelID, config.rulesMessageID)
				}>)` : `<#${config.rulesChannelID}>`
			} to read the rules!`,
			allowedMentions: {
				users: [member.id],
				roles: config.welcomeRoleID ? [config.welcomeRoleID] : []
			}
		};
	},
	GUILD_MEMBER_UPDATE: (oldMember: GuildMember, newMember: GuildMember) => {
		const { user } = newMember;
		const data = [];
		if (oldMember.displayColor !== newMember.displayColor) {
			data.push(`Display Color Changed: ${oldMember.displayHexColor} to ${newMember.displayHexColor}`);
		}

		if (oldMember.nickname !== newMember.nickname) {
			if (!oldMember.nickname || !newMember.nickname) {
				data.push(
					`Nickname ${oldMember.nickname ? 'Removed' : 'Set'}: ${newMember.nickname || oldMember.nickname}`
				);
			} else {
				data.push(`Nickname Changed: ${oldMember.nickname} to ${newMember.nickname}`);
			}
		}

		if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
			data.push(`User is ${oldMember.premiumSinceTimestamp ? 'no longer' : 'now'} boosting`);
		}

		if (!oldMember.roles.cache.equals(newMember.roles.cache)) {
			const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
			const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
			if (addedRoles.size) {
			// I'm not using role mentions here as the log channel is in a different guild
				data.push(`Roles Added: ${addedRoles.map(role => role.name).join(', ')}`);
			}
			/** 
		 	 * Not using an else if as roles can be both removed and added
		 	 * see https://discord.com/developers/docs/resources/guild#modify-guild-member
		 	 */
			if (removedRoles.size) {
			// I'm not using role mentions here as the log channel is in a different guild
				data.push(`Roles Removed: ${removedRoles.map(role => role.name).join(', ')}`);
			}
		}

		if (!data.length) return null;

		return new MessageEmbed()
			.setAuthor(user.tag)
			.setColor(Constants.Colors.GREEN)
			.setDescription(data)
			.setFooter(`User ID: ${user.id}`)
			.setThumbnail(user.displayAvatarURL({ dynamic: true }));
	},

	MESSAGE_DELETE: (message: Message | PartialMessage, options: { files?: string[]; previous?: Message }) => {
		let content = message.partial ?
			'Message content was not cached' :
			message.content || 'No content';
		if (content.length > 1000) content = `${content.slice(0, 1000)}...`;
		const embed = new MessageEmbed()
			.setAuthor(`Message Deleted in #${
				(message.channel as TextChannel).name
			} by ${message.author?.tag || 'Unkown User#0000'}`)
			.setDescription([
				options.previous ? hyperlink('Previous Message', options.previous.url) : 'No previous message',
				`Author ID: ${message.author?.id || '00000000000000000'}`
			])
			.setColor(Constants.Colors.RED)
			.addField('Content', content)
			.setFooter(`${message.id} | Created at`)
			.setTimestamp(message.createdAt);
		if (options.files?.length) {
			embed.addField(
				`File${options.files.length > 1 ? 's' : ''}`,
				options.files.map(file => `${message.client.config.attachmentsURL}/${file}`)
			);
		}
		return embed;
	},
  
	MESSAGE_DELETE_BULK: (channel: TextChannel, options: {
    amount: number; json: { [key: string]: unknown }[]; previous?: Message;
  }) => {
		return {
			embeds: [new MessageEmbed()
				.setAuthor(`Bulk delete in #${channel.name} ${options.amount} messages deleted`)
				.setDescription(
					options.previous ? hyperlink('Previous Message', options.previous.url) : 'No previous message'
				).setColor(Constants.Colors.BLUE)
			],
			files: [new MessageAttachment(Buffer.from(JSON.stringify(options.json, null, 4)), `bulk-delete-${
				moment.utc(new Date()).format('DD-MM-YYYY HH-mm A')
			}.json`)]
		};
	},

	MESSAGE_UPDATE: (oldMessage: Message | PartialMessage, newMessage: Message) => {
		let oldContent = oldMessage.partial ?
			'Old content wasn\'t cached' :
			(oldMessage.content || 'No content');
		let newContent = newMessage.content || 'No content';
		if (oldContent.length > 1000) oldContent = `${oldContent.slice(0, 1000)}...`;
		if (newContent.length > 1000) newContent = `${newContent.slice(0, 1000)}...`;
		return new MessageEmbed()
			.setAuthor(`Message Edited in #${(newMessage.channel as TextChannel).name} by ${newMessage.author.tag}`)
			.setDescription([
				hyperlink('Jump', newMessage.url),
				`Author ID: ${newMessage.author.id}`
			])
			.setColor(Constants.Colors.YELLOW)
			.setFooter(`${newMessage.id} | Created at`)
			.setTimestamp()
			.addFields({
				name: 'Old Content',
				value: oldContent
			}, {
				name: 'New Content',
				value: newContent
			});
	}
};