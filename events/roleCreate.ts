import { ClientEvents } from 'discord.js';

export default (async role => {
	const { guild } = role;
	const config = await guild.fetchConfig();
	if (!config || role.permissions.bitfield !== guild.roles.everyone.permissions.bitfield) return;
	await role.setPermissions(0, 'New role permissions fix');
}) as (...args: ClientEvents['roleCreate']) => void;