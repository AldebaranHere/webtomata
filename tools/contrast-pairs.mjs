// The pairs of colors that the design checks (see check-contrast.mjs). `fg` is the text or the
// graphic, `bg` is what is behind it. `need` is 4.5 for text (WCAG 1.4.3) and 3 for graphics, the
// edges of controls and the focus ring (WCAG 1.4.11).
//
// Some colors are not allowed for text on purpose, and so they appear only in a graphic pair:
// `--color-warning` (use `--color-warning-ink` for warning text) and `--color-border-strong`.

const text = (name, fg, bg) => ({ name, fg, bg, need: 4.5 });
const graphic = (name, fg, bg) => ({ name, fg, bg, need: 3 });

export const PAIRS = [
	// Text
	text('Ink on ground', '--color-ink', '--color-ground'),
	text('Ink on surface', '--color-ink', '--color-surface'),
	text('Ink on neutral tint', '--color-ink', '--color-neutral-tint'),
	text('Muted on surface', '--color-muted', '--color-surface'),
	text('Muted on ground', '--color-muted', '--color-ground'),
	text('Muted on neutral tint', '--color-muted', '--color-neutral-tint'),
	text('Neutral ink on neutral tint (chips)', '--color-neutral-ink', '--color-neutral-tint'),
	text('Neutral ink on surface', '--color-neutral-ink', '--color-surface'),
	text('Neutral ink on ground', '--color-neutral-ink', '--color-ground'),
	text('On accent on accent (primary button)', '--color-on-accent', '--color-accent'),
	text('On ink on ink (selected tab)', '--color-on-ink', '--color-ink'),
	text('Accent on surface (link)', '--color-accent', '--color-surface'),
	text('Accent on ground (link)', '--color-accent', '--color-ground'),
	text('Accent ink on accent tint (active state)', '--color-accent-ink', '--color-accent-tint'),
	text('Accent ink on surface', '--color-accent-ink', '--color-surface'),
	text('Success on surface', '--color-success', '--color-surface'),
	text('Success on success tint (badge)', '--color-success', '--color-success-tint'),
	text('Success ink on success tint', '--color-success-ink', '--color-success-tint'),
	text('Warning ink on warning tint', '--color-warning-ink', '--color-warning-tint'),
	text('Warning ink on surface', '--color-warning-ink', '--color-surface'),
	text('Warning ink on ground', '--color-warning-ink', '--color-ground'),

	// Graphics, the edges of controls and the focus ring
	graphic('Diagram stroke on ground', '--color-neutral-ink', '--color-ground'),
	graphic('Diagram stroke on accent tint', '--color-neutral-ink', '--color-accent-tint'),
	graphic('Accent on ground (active state, focus ring)', '--color-accent', '--color-ground'),
	graphic('Accent on surface (focus ring)', '--color-accent', '--color-surface'),
	graphic('Accent on accent tint (active state edge)', '--color-accent', '--color-accent-tint'),
	graphic('Warning on ground (wrong part of an answer)', '--color-warning', '--color-ground'),
	graphic('Warning on surface', '--color-warning', '--color-surface'),
	graphic('Warning on warning tint (label edge)', '--color-warning', '--color-warning-tint'),
	graphic('Success on ground (valid, saved)', '--color-success', '--color-ground'),
	graphic('Border strong on surface (input edge)', '--color-border-strong', '--color-surface'),
	graphic('Border strong on ground (input edge)', '--color-border-strong', '--color-ground')
];

// Colors that are not required to be seen: separators and the dots of the canvas.
export const DECORATIVE = ['--color-border', '--color-canvas-dot'];
