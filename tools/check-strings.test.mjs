import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findHardCodedStrings } from './check-strings.mjs';

const found = (markup) => findHardCodedStrings(`<script lang="ts">let n = 1;</script>\n${markup}`);
const texts = (markup) => found(markup).map((f) => f.text);

test('accepts markup whose text comes from messages', () => {
	assert.deepEqual(
		found('<h1>{t("app.name")}</h1><a href="/x" aria-label={t("nav.label")}>{t("a")}</a>'),
		[]
	);
});

test('refuses literal text in an element', () => {
	assert.deepEqual(texts('<h1>Halo dunia</h1>'), ['Halo dunia']);
});

test('refuses literal text next to an expression, in blocks and in the head', () => {
	assert.deepEqual(texts('{#if n}<p>Satu {n}</p>{:else}<p>Dua</p>{/if}'), ['Satu', 'Dua']);
	assert.deepEqual(texts('<svelte:head><title>Judul</title></svelte:head>'), ['Judul']);
	assert.deepEqual(texts('{#each [1] as x}<li>Baris {x}</li>{/each}'), ['Baris']);
});

test('refuses a literal in the attributes that users read', () => {
	assert.deepEqual(texts('<button aria-label="Tutup">{t("x")}</button>'), ['Tutup']);
	assert.deepEqual(texts('<img src="a.png" alt="Logo">'), ['Logo']);
	assert.deepEqual(texts('<input placeholder="Cari" title="Bantuan">'), ['Cari', 'Bantuan']);
	assert.deepEqual(texts('<meta name="description" content="Deskripsi">'), ['Deskripsi']);
});

test('refuses a string literal inside braces', () => {
	assert.deepEqual(texts('<p>{"Halo"}</p>'), ['Halo']);
	assert.deepEqual(texts('<p>{`Halo`}</p>'), ['Halo']);
});

test('allows text without letters: symbols, numbers and punctuation', () => {
	assert.deepEqual(
		found('<span>·</span><span>→ ε</span><p>{t("a")} · {t("b")}</p><span>42%</span>'),
		[]
	);
});

test('allows attributes that are not for people to read', () => {
	assert.deepEqual(
		found('<a href="/sandbox" class="menu" id="main" data-x="Halo" role="status">{t("a")}</a>'),
		[]
	);
	assert.deepEqual(found('<meta name="viewport" content="width=device-width">'), []);
});

test('does not read the script or the style', () => {
	assert.deepEqual(
		findHardCodedStrings(
			'<script lang="ts">const s = "Halo";</script>\n<style>.a::after { content: "Halo"; }</style>\n<p>{t("a")}</p>'
		),
		[]
	);
});

test('reports the line of the text', () => {
	const [first] = findHardCodedStrings('<script>let a = 1;</script>\n\n<p>\n\tHalo\n</p>');
	assert.equal(first.line, 4);
});
