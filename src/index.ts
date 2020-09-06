import Util from './util';
let config: Record<string, unknown> | null = null;
if (process.env.DERIVI_CONFIG_LOCATION) {
	config = Util.tryCatch(
		() => require(process.env.DERIVI_CONFIG_LOCATION!)
	);
} else {
	config = Util.tryCatch(
		() => require('./config.json'),
		() => require('../config.json')
	);
}

if (!config) {
	console.error('Couldn\'t locate config!');
	process.exit();
}