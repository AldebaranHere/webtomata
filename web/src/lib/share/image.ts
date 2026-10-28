// A machine as a picture to keep or to put in a document: an SVG that stands on its own, and a PNG made from it
// (S11). The SVG is written from the same geometry as the canvas (`edgeGeometry`), so the picture is the one on
// the screen, and it has fixed colors on white and no CSS variable, script or link, so that Word, a slide or a
// browser shows it the same. The text of each name and label is the text of the canvas, written as XML text.
// `diagramSvg` has no DOM; `svgToPng` is the one function that needs the page (an image and a canvas).
import { INNER_RADIUS, RADIUS, edgeGeometry } from '../editor/diagram/geometry.ts';
import { message } from '../editor/document.ts';
import type { MachineDocument, Result } from '../editor/document.ts';

const PADDING = 24;
const PNG_SCALE = 2;
/** The longest side of a PNG, in pixels: a canvas bigger than this fails on some phones. */
export const PNG_MAX_SIDE = 4096;

// The colors of the canvas, as values (the picture must not depend on the CSS of the page).
const INK = '#16181d';
const LINE = '#3b414c';
const MUTED = '#5b6270';
const WHITE = '#ffffff';
const UI_FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace";

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
};
/** Text for an element or an attribute of XML. */
const xml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

export interface DiagramImage {
	svg: string;
	/** The size of the picture, in units (1 unit is 1 px in the SVG). */
	width: number;
	height: number;
}

/**
 * The SVG of the machine. `startLabel` is the word on the start arrow, in the language of the page. A machine
 * with no states has no picture: `image.empty`.
 */
export function diagramSvg(doc: MachineDocument, startLabel: string): Result<DiagramImage> {
	if (doc.states.length === 0) return { ok: false, error: message('image.empty') };
	const shapes = edgeGeometry(doc, { startLabel });
	const x = shapes.bounds.x - PADDING;
	const y = shapes.bounds.y - PADDING;
	const width = Math.ceil(shapes.bounds.width + 2 * PADDING);
	const height = Math.ceil(shapes.bounds.height + 2 * PADDING);
	const out: string[] = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">`,
		`<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="${LINE}"/></marker></defs>`,
		`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${WHITE}"/>`
	];
	const line = (kind: string, path: string) =>
		`<path class="${kind}" d="${path}" fill="none" stroke="${LINE}" stroke-width="1.5" marker-end="url(#arrow)"/>`;
	for (const edge of shapes.edges) out.push(line('edge', edge.path));
	if (shapes.start) out.push(line('start', shapes.start.path));
	for (const state of shapes.states) {
		out.push(
			`<circle class="state" cx="${state.x}" cy="${state.y}" r="${RADIUS}" fill="${WHITE}" stroke="${LINE}" stroke-width="1.5"/>`
		);
		if (state.accepting) {
			out.push(
				`<circle class="inner" cx="${state.x}" cy="${state.y}" r="${INNER_RADIUS}" fill="none" stroke="${LINE}" stroke-width="1.5"/>`
			);
		}
		out.push(
			`<text x="${state.x}" y="${state.y}" font-family="${xml(UI_FONT)}" font-size="${state.text.fontSize}" font-weight="600" fill="${INK}" text-anchor="middle" dominant-baseline="central">${xml(state.text.content)}</text>`
		);
	}
	for (const edge of shapes.edges) {
		// A halo in the color of the background, so that a line never cuts the text.
		out.push(
			`<text x="${edge.label.center.x}" y="${edge.label.center.y}" font-family="${xml(MONO_FONT)}" font-size="16" fill="${INK}" stroke="${WHITE}" stroke-width="4" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${xml(edge.label.text)}</text>`
		);
	}
	if (shapes.start) {
		const { label } = shapes.start;
		out.push(
			`<text x="${label.center.x}" y="${label.center.y}" font-family="${xml(UI_FONT)}" font-size="12" fill="${MUTED}" text-anchor="middle" dominant-baseline="central">${xml(label.text)}</text>`
		);
	}
	out.push('</svg>', '');
	return { ok: true, value: { svg: out.join('\n'), width, height } };
}

/**
 * The scale of a PNG: 2 for a normal picture, less when the longest side would pass the limit, and null when
 * even one pixel for each unit would.
 */
export function pngScale(width: number, height: number): number | null {
	const longest = Math.max(width, height);
	if (longest > PNG_MAX_SIDE) return null;
	if (longest * PNG_SCALE <= PNG_MAX_SIDE) return PNG_SCALE;
	// Rounded down, so that the side never passes the limit by a rounding error.
	return Math.floor((PNG_MAX_SIDE / longest) * 1000) / 1000;
}

/**
 * The PNG of an SVG made by `diagramSvg`: the image is drawn on a canvas. The image comes from a `data:` URL,
 * which the page's content security policy allows (`img-src 'self' data:`). Fails with `image.too_big` for a
 * picture over the limit and `image.failed` for anything that the browser cannot do.
 */
export async function svgToPng(image: DiagramImage): Promise<Result<Blob>> {
	const scale = pngScale(image.width, image.height);
	if (scale === null) return { ok: false, error: message('image.too_big') };
	try {
		const picture = new Image();
		picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;
		await picture.decode();
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(image.width * scale);
		canvas.height = Math.ceil(image.height * scale);
		const context = canvas.getContext('2d');
		if (!context) return { ok: false, error: message('image.failed') };
		context.drawImage(picture, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
		return blob ? { ok: true, value: blob } : { ok: false, error: message('image.failed') };
	} catch {
		return { ok: false, error: message('image.failed') };
	}
}
