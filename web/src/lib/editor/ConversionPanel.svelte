<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import type { Params } from '#lib/i18n/translate.ts';
	import {
		CONVERT_OPS,
		TWO_MACHINE_OPS,
		buildPlan,
		chipsOf,
		planFrame,
		planResult,
		refusalOf,
		resultDocument,
		runConversion,
		secondRefusalOf
	} from './conversion.ts';
	import type { ListedOp, Layout, Plan } from './conversion.ts';
	import { conversionText } from './conversion-text.ts';
	import { documentsEqual, LIMITS } from './document.ts';
	import type { MachineDocument } from './document.ts';
	import type { ConversionProps } from './conversion-props.ts';
	import { LayoutCancelled, layoutClient } from './layout-client.ts';
	import { layoutGraph, refusalOf as layoutRefusal } from './layout.ts';
	import PlayerControls from './PlayerControls.svelte';
	import RegexPlayer from './RegexPlayer.svelte';
	import { REGEX_OPS, regexRefusalOf, runFsmToRegex } from './regex-conversion.ts';
	import type { RegexOp, RegexRun } from './regex-conversion.ts';
	import type { ConversionShown } from './conversion-props.ts';

	// The "Konversi" tab: a list of operations (each with the reason when it does not fit the
	// machine), and a player that steps through the trace of the one that was chosen. The engine does
	// the work in one call; the page only walks through the answer. The result opens as a new machine,
	// so the machine of the student is never changed. While a conversion is open, the canvas shows
	// the step (`onshow`); any change of the machine closes it, because the steps would be old.
	let { doc, onshow, onopen, others = [], load }: ConversionProps = $props();

	type Say = { key: MessageKey; params: Params };

	let working = $state<ListedOp | RegexOp | null>(null);
	let note = $state<Say | null>(null);
	// A conversion that makes a regular expression (it has its own player), and the view it shows.
	let regexRun = $state.raw<RegexRun | null>(null);
	let regexView = $state.raw<ConversionShown | null>(null);
	// The last run stopped because a label got too big: a bigger limit may finish it.
	let canRaise = $state(false);
	let plan = $state.raw<Plan | null>(null);
	// The machine, and the second machine, that the conversion started from.
	let origin = $state.raw<{ first: MachineDocument; second?: MachineDocument } | null>(null);
	let index = $state(0);
	let playing = $state(false);
	let showing = $state<'result' | 'source'>('result');
	let heading = $state<HTMLElement>();
	// The second machine of a union or an intersection: the saved machines are read once (again when
	// one is saved again), so that the list can say which of them do not fit; the chosen one is read
	// again when the conversion starts.
	let secondIds = $state<Record<string, string>>({ union: '', intersection: '' });
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
	// The words over the list of the second machine, for each operation that takes one.
	const secondLabel: Partial<Record<ListedOp, MessageKey>> = {
		union: 'convert.second_label',
		intersection: 'convert.second_label_intersection',
		xor: 'convert.second_label_xor'
	};
	const chosenFor = (op: ListedOp) => choices.find((c) => c.other.id === secondIds[op]);
	const takesSecond = (op: ListedOp) => TWO_MACHINE_OPS.includes(op);

	const total = $derived(plan?.total ?? 0);
	const current = $derived(plan ? planFrame(plan, index) : null);
	const frame = $derived(current?.frame ?? null);
	const stage = $derived(current?.stage ?? null);
	const chips = $derived(plan ? chipsOf(plan) : []);
	const atEnd = $derived(index >= total - 1);
	// An XOR that accepts nothing: the two machines are equivalent.
	const emptyXor = $derived(
		plan?.op === 'xor' && plan.stages[plan.stages.length - 1]!.run.final.accepting.length === 0
	);

	// "Konversi selesai!" for two seconds each time the player reaches its last step (by the play button, by a
	// step, or by Ke hasil). A step back and forward again shows it again.
	let justDone = $state(false);
	let wasAtEnd = false;
	$effect(() => {
		const end = plan !== null && atEnd;
		if (!end) {
			wasAtEnd = false;
			justDone = false;
			return;
		}
		if (wasAtEnd) return;
		wasAtEnd = true;
		justDone = true;
		const timer = setTimeout(() => (justDone = false), 2000);
		return () => clearTimeout(timer);
	});
	const sentence = $derived(frame && stage ? conversionText(stage.names, frame.step) : null);

	// What the canvas shows: the result as built so far, or the machine we started from (also while the
	// result has no state yet, and then the states the step is about are lit). In an intersection these
	// are the machines of the stage that is open.
	const view = $derived.by(() => {
		if (!stage || !frame) return null;
		if (showing === 'result' && frame.machine) {
			return {
				doc: resultDocument(stage.run, stage.names, stage.places, frame.machine, ''),
				active: new Set(frame.result)
			};
		}
		// The second machine of a union is the source of the steps that copy it.
		const from = frame.from === 2 && stage.run.second ? stage.run.second : stage.run.source;
		return { doc: from, active: new Set(frame.source) };
	});
	$effect(() => {
		onshow(regexView ?? view);
	});
	onDestroy(() => onshow(null));

	// The steps are old when the machine changes.
	$effect(() => {
		const changed = doc;
		untrack(() => {
			if (origin && !documentsEqual(origin.first, changed)) close();
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
			ListedOp,
			ReturnType<typeof refusalOf>
		>
	);

	// The layout of a result: a worker places the states; a machine that is too big or a layout that
	// fails leaves the states on the grid of the document, and that is all.
	const place: Layout = async (draft) => {
		if (layoutRefusal(draft)) return null;
		try {
			return await layoutClient.run(layoutGraph(draft));
		} catch (error) {
			if (error instanceof LayoutCancelled) throw error;
			return null;
		}
	};

	async function start(op: ListedOp) {
		if (working) return;
		const source = doc;
		working = op;
		note = null;
		try {
			const second = takesSecond(op) ? ((await load?.(secondIds[op]!)) ?? undefined) : undefined;
			const outcome = await runConversion(engine, source, op, second);
			if (!documentsEqual(source, doc)) return;
			if (outcome.kind !== 'finished') {
				note = { key: outcome.key, params: 'params' in outcome ? outcome.params : {} };
				return;
			}
			const built = await buildPlan(outcome.run, t('convert.dead_name'), place);
			if (!documentsEqual(source, doc)) return;
			origin = { first: source, ...(second ? { second } : {}) };
			plan = built;
			index = 0;
			showing = 'result';
			playing = false;
			await tick();
			heading?.focus();
		} catch (error) {
			if (error instanceof LayoutCancelled) return;
			note = { key: 'convert.engine_failed', params: {} };
		} finally {
			working = null;
		}
	}

	async function startRegex(op: RegexOp, raised = false) {
		if (working) return;
		const source = doc;
		working = op;
		note = null;
		canRaise = false;
		try {
			const outcome = await runFsmToRegex(engine, source, raised);
			if (!documentsEqual(source, doc)) return;
			if (outcome.kind !== 'finished') {
				note = { key: outcome.key, params: 'params' in outcome ? outcome.params : {} };
				canRaise = outcome.kind === 'stopped' && outcome.raise;
				return;
			}
			origin = { first: source };
			regexRun = outcome.run;
		} catch {
			note = { key: 'convert.engine_failed', params: {} };
		} finally {
			working = null;
		}
	}

	function close() {
		playing = false;
		regexRun = null;
		plan = null;
		origin = null;
		index = 0;
	}

	function open() {
		if (!plan || !origin) return;
		const base = origin.first.title || t('editor.untitled');
		const second = origin.second?.title || t('editor.untitled');
		const title = Array.from(t(`convert.result_title.${plan.op}`, { title: base, second }))
			.slice(0, LIMITS.titleChars)
			.join('');
		onopen(planResult(plan, title));
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
	{#if regexRun}
		<RegexPlayer run={regexRun} onshow={(shown) => (regexView = shown)} onclose={close} />
	{:else if plan && stage && frame && sentence}
		<section aria-labelledby="convert-heading">
			<h3 id="convert-heading" tabindex="-1" bind:this={heading}>{t(`convert.op.${plan.op}`)}</h3>
			{#if stage.key}
				<!-- An intersection is seven stages: the open one is named, and the chips jump between them. -->
				<p class="stage">
					{t('convert.stage_of', { n: stage.number, total: chips.length })} · {t(
						stage.key as MessageKey
					)}
				</p>
				<ol class="chips" aria-label={t('convert.stages')}>
					{#each chips as chip (chip.number)}
						{@const name = t(chip.key as MessageKey)}
						<li>
							<button
								type="button"
								class="chip"
								class:current={chip.number === stage.number}
								disabled={!chip.present}
								aria-current={chip.number === stage.number ? 'step' : undefined}
								aria-label={chip.present
									? t('convert.stage_chip', { n: chip.number, name })
									: t('convert.stage_skipped', { n: chip.number, name })}
								onclick={() => go(chip.offset)}
							>
								{chip.number}
							</button>
						</li>
					{/each}
				</ol>
				<p class="muted">
					{t('convert.step_in_stage', { n: current!.local + 1, total: stage.length })}
				</p>
			{:else}
				<p class="muted">{t('convert.step_of', { n: index + 1, total })}</p>
			{/if}
			<!-- The live region is always in the page, so that a screen reader hears the text when it comes. -->
			<p class="done" role="status">{justDone ? t('convert.done') : ''}</p>
			{#if atEnd && emptyXor}
				<!-- Rich, chapter 9: two machines are equivalent exactly when their XOR accepts nothing. -->
				<p class="note-line">{t('convert.xor_empty')}</p>
			{/if}

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

			<PlayerControls
				{index}
				{total}
				{playing}
				playLabel={t(`convert.play_${plan.op}`)}
				ongo={go}
				ontoggle={toggle}
			/>

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
		<p class="progress" role="status">{working ? t('convert.in_progress') : ''}</p>
		{#if note}
			<p class="note" role="status">{t(note.key, note.params)}</p>
		{/if}
		{#if canRaise}
			<button type="button" class="raise" onclick={() => void startRegex('fsm_to_regex', true)}>
				{t('convert.raise_limit')}
			</button>
		{/if}
		<ul class="ops">
			{#each CONVERT_OPS as op (op)}
				{@const reason =
					refusals[op] ??
					(takesSecond(op) && others.length === 0
						? { key: 'convert.reason_no_second' as MessageKey, params: {} }
						: null)}
				<li>
					<div class="text">
						<span class="name">{t(`convert.op.${op}`)}</span>
						<span class="muted" id="convert-hint-{op}">
							{reason ? t(reason.key, reason.params) : t(`convert.op.${op}_hint`)}
						</span>
						{#if takesSecond(op) && !reason}
							<label class="second">
								<span class="muted">{t(secondLabel[op] ?? 'convert.second_label')}</span>
								<select bind:value={secondIds[op]}>
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
							(takesSecond(op) && (!chosenFor(op) || chosenFor(op)!.reason !== null))}
						aria-describedby="convert-hint-{op}"
						aria-busy={working === op}
						onclick={() => void start(op)}
					>
						{working === op ? t('convert.working') : t('convert.start')}
					</button>
				</li>
			{/each}
		</ul>
		<h4>{t('convert.group_regex')}</h4>
		<ul class="ops">
			{#each REGEX_OPS as op (op)}
				{@const reason = regexRefusalOf(doc)}
				<li>
					<div class="text">
						<span class="name">{t(`convert.op.${op}`)}</span>
						<span class="muted" id="convert-hint-{op}">
							{reason ? t(reason.key, reason.params) : t(`convert.op.${op}_hint`)}
						</span>
					</div>
					<button
						type="button"
						disabled={reason !== null || working !== null}
						aria-describedby="convert-hint-{op}"
						aria-busy={working === op}
						onclick={() => void startRegex(op)}
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
	h4,
	p {
		margin: 0;
	}
	h3,
	h4 {
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
	/* The two short messages: they take no room while they are empty. */
	.done:empty,
	.progress:empty {
		display: none;
	}
	.done {
		align-self: flex-start;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--color-success-tint);
		color: var(--color-success-ink);
		font-weight: var(--weight-strong);
	}
	.note-line {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-success-tint);
		color: var(--color-success-ink);
		font-size: var(--text-sm);
	}
	.progress {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
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
	.stage {
		font-weight: var(--weight-strong);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		min-width: var(--target-min);
		padding: 0;
		font-family: var(--font-mono);
	}
	.chip.current {
		border: 2px solid var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
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
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	.raise {
		align-self: flex-start;
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
