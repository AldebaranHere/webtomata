export function serveBuild(
	dir: string,
	port?: number
): Promise<{ origin: string; close: () => void }>;
