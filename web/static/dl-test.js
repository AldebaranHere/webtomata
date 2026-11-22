// Throwaway diagnostic: which blob type or content makes Chrome on Android keep the name "x.jff"?
const XML =
	'<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<structure>\n<type>pda</type>\n<automaton></automaton>\n</structure>\n';
const NO_DECL = '<structure>\n<type>pda</type>\n<automaton></automaton>\n</structure>\n';
const variants = [
	['A', 'a.jff', 'application/octet-stream;charset=utf-8', XML, 'what the site sends now'],
	['B', 'b.jff', 'application/octet-stream', XML, 'plain octet-stream, no charset'],
	['C', 'c.jff', 'application/octet-stream', NO_DECL, 'octet-stream, no <?xml line'],
	[
		'D',
		'd.jff',
		'application/octet-stream',
		'\n' + NO_DECL,
		'octet-stream, text starts with a newline then <structure>'
	],
	['E', 'e.jff', 'application/x-jflap', XML, 'a made-up type no phone knows'],
	['F', 'f.jff', '', XML, 'no type at all'],
	[
		'G',
		'g.jff',
		'application/octet-stream',
		new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(XML)]),
		'octet-stream, UTF-8 BOM first, then the xml'
	],
	['H', 'h.jff', 'application/zip', XML, 'type zip (a check, not a fix)']
];
const list = document.getElementById('list');
for (const [id, name, type, data, note] of variants) {
	const button = document.createElement('button');
	button.textContent = id + ': ' + name;
	const hint = document.createElement('p');
	hint.textContent = note + ' (type: ' + (type || 'none') + ')';
	button.addEventListener('click', () => {
		const blob = new Blob([data], type ? { type } : {});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	});
	list.append(button, hint);
}
