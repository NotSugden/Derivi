import { join } from 'path';
import { Constants, User, EmbedFieldData, GuildMember } from 'discord.js';
/* eslint-disable sort-keys */

export enum ModerationActionTypes {
	BAN = Constants.Colors.RED,
	KICK = Constants.Colors.ORANGE,
	MUTE = Constants.Colors.GREEN,
	WARN = Constants.Colors.YELLOW
}


export const Defaults = {
	CLIENT_CONFIG: {
		commands_dir: join(__dirname, '..', 'commands'),
		database: 'database.sqlite',
		files_dir: join(__dirname, '..', 'saved_files')
	}
};

export const Errors = {
	INVALID_CLIENT_OPTION: (option: string, className: string) =>
		`Client config option '${option}' couldn't be resolved to a valid ${className}.`,

	CASE_RESOLVE_USER: (index: number) => `Couldn't resolve a User from 'users[${index}]'.`,
	CASE_INVALID_MODERATOR: 'Couldn\'t resolve the User from the provided \'moderator\' for a new case.',

	LEVELS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} levels of.`,
	POINTS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} points of.`,

	NEGATIVE_NUMBER: (variable: string) => `Provided '${variable}' is negative, and should be positive.`,
	RESOLVE_ID: (id: string) =>
		`An ID or user mention was provided, but the user couldn't be resolved, are you sure its valid? (${id})`,
	RESOLVE_COMMAND: 'The command passed couldn\'t be resolved',

	COMMAND_LOAD_FAILED: (name: string) => `Failed to load command ${name}`,
	INVALID_TYPE: (parameter: string, type: string) => `Provided '${parameter}' should be a '${type}'`
};

export const Responses = {
	ALREADY_REMOVED_USERS: (multiple: boolean, kick = true) =>
		`${multiple ? 'All of the members' : 'The member'} you mentioned ${multiple ? 'have' : 'has'} already ${
			kick ?
				'left or been kicked' :
				'been banned'
		}.`,
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
			} ${amount} user${amount > 1 ? 's' : ''}, as they had already ${
				kick ? 'left/been kicked' : 'been banned'
			}.`);
		}
		return content;
	}
};

export const URLs = {
	HASTEBIN: (endpointOrID?: string) => `https://hasteb.in${endpointOrID ? `/${endpointOrID}` : ''}`
};

export const FLAGS_REGEX = /--([a-z]+)=("[^"]*"|[0-9a-z]*)/gi;