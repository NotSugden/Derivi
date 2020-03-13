import { join } from 'path';
/* eslint-disable sort-keys */
export const Defaults = {
	CLIENT_CONFIG: {
		commandsDir: join(__dirname, '..', 'commands'),
		prefix: '+',
		database: 'database.sqlite',
		token: null,
		webhooks: [],
	},
};

export const Errors = {
	LEVELS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} levels of.`,
	POINTS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} points of.`,

	NEGATIVE_NUMBER: (variable: string) => `Provided '${variable}' is negative, and should be positive.`,
	RESOLVE_ID: (id: string) =>
		`An ID or user mention was provided, but the user couldn't be resolved, are you sure its valid? (${id})`,
};

export const Responses = {
	INSUFFICIENT_PERMISSIONS: 'You have insufficient permissions to perform this action.',
};

export const URLs = {
	HASTEBIN: (endpointOrID?: string) => `https://hasteb.in${endpointOrID ? `/${endpointOrID}` : ''}`,
};
