<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Params } from '#lib/i18n/translate.ts';
	import {
		CONVERT_OPS,
		frameAt,
		namesOf,
		refusalOf,
		resultDocument,
		runConversion,
		secondRefusalOf
	} from './conversion.ts';
	import type { ConvertOp, ConvertRun, Names, Place } from './conversion.ts';
	import { conversionText } from './conversion-text.ts';
	import { documentsEqual, LIMITS } from './document.ts';
	import type { MachineDocument } from './document.ts';
	import type { ConversionProps } from './conversion-props.ts';
	import { LayoutCancelled, layoutClient } from './layout-client.ts';
	import { layoutGraph, refusalOf as layoutRefusal } from './layout.ts';

	// The "Konversi" tab: a list of operations (each with the reason when it does not fit the
	// machine), and a player that steps through the trace of the one that was chosen. The engine does
	// the work in one call; the page only walks through the answer. The result opens as a new machine,
	// so the machine of the student is never changed. While a conversion is open, the canvas shows
	// the step (`onshow`); any change of the machine closes it, because the steps would be old.
	let { doc, onshow, onopen, others = [], load }: ConversionProps = $props();

	type Say = { key: MessageKey; params: Params };

	let working = $state<ConvertOp | null>(null);
	let note = $state<Say | null>(null);
	let run = $state.raw<ConvertRun | null>(null);
	let names = $state.raw<Names | null>(null);
	let places = $state.raw<Place[] | null>(null);
	let index = $state(0);
	let playing = $state(false);
	let showing = $state<'result' | 'source'>('result');
	let heading = $state<HTMLElement>();
	// The second machine of a union: the saved machines are read once (again when one is saved again),
	// so that the list can say which of them do not fit; the chosen one is read again when it starts.
	let secondId = $state('');
	let loaded = $state.raw<Record<string, MachineDocument | null>>({});
	const asked: Record<string, true> = {};
	const stampOf = (o: { id: string; stamp: number }) => `${o.id}:${o.stamp}`;
	$effect(() => {
		for (const other of others) {
			const key = stampOf(other);
			if (!other.readable || asked[key] || !load) continue;
			asked[key] = true;
			void load(other.id)
				.catch(() => null)
				.then((read) => (loaded = { ...loaded, [key]: read }));
		}
	});
	const choices = $derived(
		others.map((other) => {
			const read = loaded[stampOf(other)];
			const reason =
				!other.readable || read === null
					? { key: 'convert.reason_unreadable' as MessageKey, params: {} }
					: read
						? secondRefusalOf(doc, read)
						: null;
			return { other, reason };
		})
	);
	const chosen = $derived(choices.find((c) => c.other.id === secondId));

	const total = $derived(run?.trace.length ?? 0);
	const frame = $derived(run && names ? frameAt(run, names, index) : null);
	const atEnd = $derived(index >= total - 1);
	const sentence = $derived(frame && names ? conversionText(names, frame.step) : null);

	// What the canvas shows: the result as built so far, or the machine we started from (also while the
	// result has no state yet, and then the states the step is about are lit).
	const view = $derived.by(() => {
		if (!run || !names || !frame) return null;
		if (showing === 'result' && frame.machine) {
			return {
				doc: resultDocument(run, names, places, frame.machine, ''),
				active: new Set(frame.result)
			};
		}
		// The second machine of a union is the source of the steps that copy it.
		const from = frame.from === 2 && run.second ? run.second : run.source;
		return { doc: from, active: new Set(frame.source) };
	});
	$effect(() => {
		onshow(view);
	});
	onDestroy(() => onshow(null));

	// The steps are old when the machine changes.
	$effect(() => {
		const current = doc;
		untrack(() => {
			if (run && !documentsEqual(run.source, current)) close();
		});
	});

	// Play: one step each 0.8 s, and it stops at the end.
	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			if (index >= total - 1) playing = false;
			else index += 1;
		}, 800);
		return () => clearInterval(timer);
	});

	const refusals = $derived(
		Object.fromEntries(CONVERT_OPS.map((op) => [op, refusalOf(doc, op)])) as Record<
			ConvertOp,
			ReturnType<typeof refusalOf>
		>
	);

	async function start(op: ConvertOp) {
		if (working) return;
		const source = doc;
		working = op;
		note = null;
		try {
			const second = op === 'union' ? ((await load?.(secondId)) ?? undefined) : undefined;
			const outcome = await runConversion(engine, source, op, second);
			if (!documentsEqual(source, doc)) return;
			if (outcome.kind !== 'finished') {
				note = { key: outcome.key, params: 'params' in outcome ? outcome.params : {} };
				return;
			}
			const finished = outcome.run;
			const named = namesOf(finished, t('convert.dead_name'));
			let found: Place[] | null = null;
			if (op !== 'trap' && op !== 'complement') {
				const draft = resultDocument(finished, named, null, finished.final, '');
				if (!layoutRefusal(draft)) {
					try {
						found = await layoutClient.run(layoutGraph(draft));
					} catch (error) {
						if (error instanceof LayoutCancelled) return;
						// No layout: the states go on the grid of the document. That is all.
					}
				}
			}
			if (!documentsEqual(source, doc)) return;
			run = finished;
			names = named;
			places = found;
			index = 0;
			showing = 'result';
			playing = false;
			await tick();
			heading?.focus();
		} catch {
			note = { key: 'convert.engine_failed', params: {} };
		} finally {
			working = null;
		}
	}

	function close() {
		playing = false;
		run = null;
		names = null;
		places = null;
		index = 0;
	}

	function open() {
		if (!run || !names) return;
		const base = run.source.title || t('editor.untitled');
		const second = run.second?.title || t('editor.untitled');
		const title = Array.from(t(`convert.result_title.${run.op}`, { title: base, second }))
			.slice(0, LIMITS.titleChars)
			.join('');
		onopen(resultDocument(run, names, places, run.final, title));
	}

	const go = (to: number) => {
		playing = false;
		index = Math.min(Math.max(to, 0), total - 1);
	};
	function toggle() {
		if (atEnd) index = 0;
		playing = !playing;
	}
</script>

<div class="convert">
	{#if run && names && frame && sentence}
		<section aria-labelledby="convert-heading">
			<h3 id="convert-heading" tabindex="-1" bind:this={heading}>{t(`convert.op.${run.op}`)}</h3>
			<p class="muted">{t('convert.step_of', { n: index + 1, total })}</p>

			<div class="seg" role="group" aria-label={t('convert.view')}>
				<button
					type="button"
					aria-pressed={showing === 'result'}
					onclick={() => (showing = 'result')}
				>
					{t('convert.view_result')}
				</button>
				<button
					type="button"
					aria-pressed={showing === 'source'}
					onclick={() => (showing = 'source')}
				>
					{t('convert.view_source')}
				</button>
			</div>

			<p class="sentence" role="status">{t(sentence.key, sentence.params)}</p>

			{#if frame.table}
				{@const table = frame.table}
				{@const caption =
					table.kind === 'closure'
						? t('convert.table_closure')
						: table.kind === 'classes'
							? t('convert.table_classes')
							: t('convert.table_delta')}
				<!-- A region that scrolls must be reachable with the keyboard (the axe rule scrollable-region-focusable). -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="scroll" role="region" aria-label={caption} tabindex="0">
					<table>
						<caption>{caption}</caption>
						<thead>
							<tr>
								{#if table.kind === 'closure'}
									<th scope="col">{t('convert.col_state')}</th>
									<th scope="col">{t('convert.col_closure')}</th>
								{:else if table.kind === 'classes'}
									<th scope="col">{t('convert.col_class')}</th>
								{:else}
									<th scope="col">{t('convert.col_state')}</th>
									{#each table.symbols as symbol (symbol)}
										<th scope="col" class="mono">{symbol}</th>
									{/each}
									<th scope="col">{t('table.accepting')}</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#if table.kind === 'closure'}
								{#each table.rows as row, i (i)}
									<tr class:hot={i === table.hot} aria-current={i === table.hot || undefined}>
										<th scope="row" class="mono">{row.state}</th>
										<td class="mono">{row.closure}</td>
									</tr>
								{/each}
							{:else if table.kind === 'classes'}
								{#each table.rows as row, i (i)}
									<tr class:hot={table.hot.includes(i)}>
										<th scope="row" class="mono">{row}</th>
									</tr>
								{/each}
							{:else}
								{#each table.rows as row, i (i)}
									<tr class:hot={i === table.hot} aria-current={i === table.hot || undefined}>
										<th scope="row" class="mono">{row.state}</th>
										{#each row.cells as cell, c (c)}
											<td class="mono">{cell}</td>
										{/each}
										<td>{row.accepting ? '✓' : ''}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="controls" role="group" aria-label={t('convert.controls')}>
				<button
					type="button"
					class="icon"
					aria-label={t('convert.first')}
					disabled={index === 0}
					onclick={() => go(0)}>⏮</button
				>
				<button
					type="button"
					class="icon"
					aria-label={t('convert.back')}
					disabled={index === 0}
					onclick={() => go(index - 1)}>◀</button
				>
				<button type="button" class="play" onclick={toggle}>
					{playing ? t('convert.pause') : t('convert.play')}
				</button>
				<button
					type="button"
					class="icon"
					aria-label={t('convert.next')}
					disabled={atEnd}
					onclick={() => go(index + 1)}>▶</button
				>
				<button
					type="button"
					class="icon"
					aria-label={t('convert.last')}
					disabled={atEnd}
					onclick={() => go(total - 1)}>⏭</button
				>
			</div>

			<div class="end">
				{#if atEnd}
					<button type="button" class="primary" onclick={open}>{t('convert.open_result')}</button>
				{/if}
				<button type="button" class="plain" onclick={close}>{t('convert.close')}</button>
			</div>
		</section>
	{:else}
		<h3>{t('convert.title')}</h3>
		<p class="muted">{t('convert.intro')}</p>
		{#if note}
			<p class="note" role="status">{t(note.key, note.params)}</p>
		{/if}
		<ul class="ops">
			{#each CONVERT_OPS as op (op)}
				{@const reason =
					refusals[op] ??
					(op === 'union' && others.length === 0
						? { key: 'convert.reason_no_second' as MessageKey, params: {} }
						: null)}
				<li>
					<div class="text">
						<span class="name">{t(`convert.op.${op}`)}</span>
						<span class="muted" id="convert-hint-{op}">
							{reason ? t(reason.key, reason.params) : t(`convert.op.${op}_hint`)}
						</span>
						{#if op === 'union' && !reason}
							<label class="second">
								<span class="muted">{t('convert.second_label')}</span>
								<select bind:value={secondId}>
									<option value="">{t('convert.second_placeholder')}</option>
									{#each choices as { other, reason: unfit } (other.id)}
										<option value={other.id} disabled={unfit !== null}>
											{other.title} · {t(`kind.${other.kind}`)}{unfit
												? ` — ${t(unfit.key, unfit.params)}`
												: ''}
										</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>
					<button
						type="button"
						disabled={reason !== null ||
							working !== null ||
							(op === 'union' && (!chosen || chosen.reason !== null))}
						aria-describedby="convert-hint-{op}"
						aria-busy={working === op}
						onclick={() => void start(op)}
					>
						{working === op ? t('convert.working') : t('convert.start')}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.convert {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	h3:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.ops {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ops li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.second {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	select {
		min-height: var(--target-min);
		max-width: 100%;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
	}
	select:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.name {
		font-weight: var(--weight-strong);
	}
	button {
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	button:focus-visible,
	.scroll:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.seg {
		display: flex;
		align-self: flex-start;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.seg button {
		border: 0;
		border-radius: 0;
		background: transparent;
	}
	.seg button[aria-pressed='true'] {
		background: var(--color-ink);
		color: var(--color-on-ink);
		font-weight: var(--weight-strong);
	}
	.sentence {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	caption {
		padding: var(--space-1) var(--space-2);
		color: var(--color-muted);
		text-align: left;
	}
	th,
	td {
		padding: var(--space-1) var(--space-2);
		border-top: 1px solid var(--color-border);
		text-align: left;
		font-weight: var(--weight-regular);
		white-space: nowrap;
	}
	thead th {
		font-weight: var(--weight-strong);
	}
	.mono {
		font-family: var(--font-mono);
	}
	tr.hot th,
	tr.hot td {
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
	}
	.controls {
		display: grid;
		grid-template-columns: auto auto 1fr auto auto;
		gap: var(--space-2);
	}
	.icon {
		min-width: var(--target-min);
		padding: 0;
	}
	.play,
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	.end {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.plain {
		border-color: transparent;
		background: transparent;
	}
</style>
