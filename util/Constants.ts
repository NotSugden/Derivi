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
	ALREADY_KICKED_USERS: (multiple: boolean) =>
		`${multiple ? 'All of the members' : 'The member'} you mentioned have already left or been kicked.`,
	INSUFFICIENT_PERMISSIONS: 'You have insufficient permissions to perform this action.',
	MENTION_MEMBERS: 'Please mention at least 1 member.',
	PROVIDE_REASON: 'Please supply a reason for this action.',

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
	KICK_SUCCESSFUL: (members: GuildMember[], users: User[]) => {
		const content = [
			`Kicked ${members.length > 1 ? members[0].user.tag : `${members.length} members`}.`
		];
		if (members.length !== users.length) {
			content.push(`Couldn't kick ${users.length - members.length} users, as they had already left.`);
		}
		return content;
	}
};

export const URLs = {
	HASTEBIN: (endpointOrID?: string) => `https://hasteb.in${endpointOrID ? `/${endpointOrID}` : ''}`
};