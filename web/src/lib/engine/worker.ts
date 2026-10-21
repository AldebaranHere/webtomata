// The only module allowed to import the WASM package (see eslint.config.js).
import init, { version } from './wasm/engine_wasm.js';

const ready = init();

self.onmessage = async () => {
	await ready;
	self.postMessage(version());
};
