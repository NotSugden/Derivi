import { join } from 'path';
import { Constants, User, EmbedFieldData, GuildMember, RoleData } from 'discord.js';
/* eslint-disable sort-keys */

export enum ModerationActionTypes {
	BAN = Constants.Colors.RED,
	KICK = Constants.Colors.ORANGE,
	MUTE = Constants.Colors.GREY,
	WARN = Constants.Colors.YELLOW
}


export const Defaults = {
	CLIENT_CONFIG: {
		commands_dir: join(__dirname, '..', 'commands'),
		database: 'database.sqlite',
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

	NEGATIVE_NUMBER: (variable: string) =>`Provided '${variable}' is negative, and should be positive.`,
	RESOLVE_ID: (id: string) =>
		`An ID or user mention was provided, but the user couldn't be resolved, are you sure its valid? (${id})`,
	RESOLVE_COMMAND: 'The command passed couldn\'t be resolved',

	COMMAND_LOAD_FAILED: (name: string) => `Failed to load command ${name}`,
	INVALID_TYPE: (parameter: string, type: string) => `Provided '${parameter}' should be a '${type}'`
};

export const Responses = {
	ALL_MUTED: 'All of the mentioned members are muted.',
	ALREADY_REMOVED_USERS: (multiple: boolean, kick = true) =>
		`${multiple ? 'All of the members' : 'The member'} you mentioned ${multiple ? 'have' : 'has'} already ${
			kick ?
				'left or been kicked' :
				'been banned'
		}.`,
	CANNOT_ACTION_USER: (action: keyof typeof ModerationActionTypes, multiple = false) =>
		`You cannot perform a ${action.toLowerCase()} on ${multiple ? 'one of the users you mentioned' : 'this user'}`,
	INSUFFICIENT_PERMISSIONS: 'You have insufficient permissions to perform this action.',
	MENTION_USERS: (users = true) => `Please mention at least 1 ${users ? 'user' : 'member'}.`,
	PROVIDE_REASON: 'Please supply a reason for this action.',
	INVALID_FLAG_TYPE: (flag: string, type: string) => `Flag ${flag} must be ${type}`,
	INVALID_FLAG: (provided: string, valid: string[]) =>
		`Provided flag '${provided}' is not valid, valid flags for this command are: ${valid.join(', ')}`,

	MODERATION_LOG_FIELDS: (moderator: User, users: User[]): EmbedFieldData[] => [{
		name: 'Moderator',
		value: moderator.tag
	}, {
		name: `User${users.length > 1 ? 's' : ''} punished`,
		value: users.map(({ tag }) => tag)
	}],
	MODERATION_LOG_DESCRIPTION: (action: keyof typeof ModerationActionTypes, reason: string, extras: object) => {
		const description = [
			`ASC Logs: ${action.charAt(0) + action.slice(1).toLowerCase()}`
		];
		if (Object.keys(extras).length) {
			description.push(...Object.entries(extras)
				.map(([key, value]) => `${key}: ${value}`));
		}
		return [...description, `Reason: ${reason}`];
	},

	AUDIT_LOG_MEMBER_REMOVE: (moderator: User, caseID: number, kick = true) =>
		`${kick ? 'Kicked' : 'Banned'} by ${moderator.tag}: Case ${caseID}`,

	/**
   * Big spaghetti code ;(
	 * if someone wants to prettify this be my guest
	 */
	MEMBER_REMOVE_SUCCESSFUL: ({ filteredUsers, members, users }: {
		filteredUsers?: User[];
		members?: GuildMember[];
		users: User[];
	}, kick = true) => {

		const content = [
			`${kick ? 'Kicked' : 'Banned'} ${
				(members || users).length === 1 ?
					(members ? members[0].user : users[0]).tag :
					`${(members || users).length} members`
			}.`
		];

		const array = members || filteredUsers!;

		if (array.length !== users.length) {
			const amount = users.length - array.length;
			content.push(`Couldn't ${
				kick ? 'kick' : 'ban'
			} ${amount} other user${amount > 1 ? 's' : ''}, as they had already ${
				kick ? 'left/been kicked' : 'been banned'
			}.`);
		}
		return content;
	},

	WARN_SUCCESS: (users: User[], reason: string) =>
		`${users.length > 1 ? `${users.length} Users where` : `${users[0].tag} was`} warned for ${reason}.`,
	MUTE_SUCCESS: (members: GuildMember[], reason: string) =>
		`${members.length > 1 ? `${members.length} Members were` : `${members[0].user.tag} was`} muted for ${reason}.`
};

export const URLs = {
	HASTEBIN: (endpointOrID?: string) => `https://hasteb.in${endpointOrID ? `/${endpointOrID}` : ''}`
};

export const FLAGS_REGEX = /--([a-z]+)=("[^"]*"|[0-9a-z]*)/gi;