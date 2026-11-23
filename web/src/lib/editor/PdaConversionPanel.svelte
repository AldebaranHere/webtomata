<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { engine } from '#lib/engine/client.ts';
	import type { Message } from '#lib/engine/types.ts';
	import EngineNotice from '#lib/components/EngineNotice.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/id.ts';
	import {
		conversionTitle,
		createPdaConverter,
		listWindow,
		ruleText,
		rulesWindow
	} from './pda-conversion.ts';
	import type { PdaConversionShown } from './pda-conversion.ts';
	import type { PdaDocument } from './pda-document.ts';
	import { transitionLabel } from './diagram/pda-diagram.ts';
	import PlayerControls from './PlayerControls.svelte';

	// The Konversi tab: RNF (pdaToRnf) and the grammar (pdaToCfg on the RNF result). One engine
	// call per button; the stepper is local after that. The exact removed/added transitions and
	// rules live here; the canvas only lights the states and the from>to group (T-038b R3).
	let {
		doc,
		onshow,
		onopenpda,
		onopengrammar
	}: {
		doc: PdaDocument;
		onshow: (shown: PdaConversionShown | null) => void;
		onopenpda?: (doc: PdaDocument, title: string) => Promise<boolean>;
		onopengrammar?: (title: string, text: string) => void;
	} = $props();

	const converter = createPdaConverter({
		engine,
		currentDoc: () => doc
	});

	const read = () => ({
		status: converter.status(),
		view: converter.view(),
		refusal: converter.refusal(),
		stage2Refusal: converter.stage2Refusal(),
		problem: converter.problem()
	});
	let snap = $state.raw(read());
	let opening = $state(false);
	let note = $state<string | null>(null);

	$effect(() => {
		const stop = converter.subscribe(() => (snap = read()));
		snap = read();
		return stop;
	});
	$effect(() => {
		onshow(snap.view?.canvas ?? null);
		return () => onshow(null);
	});

	// Any change of the document closes the conversion, as the FSM's panel does.
	let lastDoc = untrack(() => doc);
	$effect(() => {
		const current = doc;
		if (current === lastDoc) return;
		lastDoc = current;
		note = null;
		converter.close();
	});
	onDestroy(() => converter.dispose());

	const rnfDoc = $derived(snap.view ? converter.rnfDocument() : undefined);
	const labels = $derived(snap.view ? converter.ruleLabels() : undefined);
	const fallbackTitle = $derived(t('editor.untitled'));

	// The engine's keys are strings; every key it returns is in the dictionary.
	const say = (message: Message) => t(message.key as MessageKey, message.params);

	function start() {
		note = null;
		void converter.start(doc);
	}
	function toGrammar() {
		note = null;
		void converter.toGrammar();
	}
	async function openPda() {
		if (!onopenpda || opening) return;
		const target = converter.rnfDocument(conversionTitle(doc.title, 'RNF', fallbackTitle));
		if (target === undefined) return;
		opening = true;
		note = null;
		const opened = await onopenpda(target, target.title);
		opening = false;
		if (!opened) note = t('pda_convert.save_failed');
	}
	function openGrammar() {
		if (!onopengrammar) return;
		const text = converter.grammarText();
		if (text === undefined) return;
		onopengrammar(conversionTitle(doc.title, 'CFG', fallbackTitle), text);
	}
	function close() {
		note = null;
		converter.close();
	}
</script>

<div class="convert">
	{#if snap.view}
		{@const view = snap.view}
		<section aria-labelledby="pda-convert-heading">
			<h3 id="pda-convert-heading">
				{t(view.stage === 1 ? 'pda_convert.stage_rnf_long' : 'pda_convert.stage_cfg_long')}
			</h3>
			<ol class="chips" aria-label={t('convert.stages')}>
				<li>
					<button
						type="button"
						class="chip"
						class:current={view.stage === 1}
						aria-current={view.stage === 1 ? 'step' : undefined}
						aria-label={t('convert.stage_chip', {
							n: 1,
							name: t('pda_convert.stage_rnf_long')
						})}
						disabled={view.working !== null}
						onclick={() => converter.toStage(1)}
					>
						1 {t('pda_convert.stage_rnf')}
					</button>
				</li>
				<li>
					<button
						type="button"
						class="chip"
						class:current={view.stage === 2}
						aria-current={view.stage === 2 ? 'step' : undefined}
						aria-label={t('convert.stage_chip', {
							n: 2,
							name: t('pda_convert.stage_cfg_long')
						})}
						disabled={!view.hasCfg || view.working !== null}
						title={!view.hasCfg ? t('pda_convert.stage2_need_rnf') : undefined}
						onclick={() => converter.toStage(2)}
					>
						2 {t('pda_convert.stage_cfg')}
					</button>
				</li>
			</ol>
			<p class="muted">{t('convert.step_of', { n: view.index + 1, total: view.total })}</p>
			<p class="sentence" role="status">{t(view.frame.sentence.key, view.frame.sentence.params)}</p>

			{#if view.stage === 1 && rnfDoc}
				{@const removedShown = listWindow(view.frame.removed)}
				{#if removedShown.shown.length > 0}
					<h4>{t('pda_convert.removed')}</h4>
					<ul class="diff removed">
						{#if removedShown.hidden > 0}
							<li class="muted">{t('run.earlier', { count: removedShown.hidden })}</li>
						{/if}
						{#each removedShown.shown as transition, i (i)}
							<li><span class="mono">{transitionLabel(rnfDoc, transition)}</span></li>
						{/each}
					</ul>
				{/if}
				{@const addedShown = listWindow(view.frame.added)}
				{#if addedShown.shown.length > 0}
					<h4>{t('pda_convert.added')}</h4>
					<ul class="diff added">
						{#if addedShown.hidden > 0}
							<li class="muted">{t('run.earlier', { count: addedShown.hidden })}</li>
						{/if}
						{#each addedShown.shown as transition, i (i)}
							<li><span class="mono">{transitionLabel(rnfDoc, transition)}</span></li>
						{/each}
					</ul>
				{/if}
			{:else if view.stage === 2 && labels}
				{@const addedRulesShown = listWindow(view.frame.addedRules)}
				{#if addedRulesShown.shown.length > 0}
					<h4>{t('pda_convert.added')}</h4>
					<ul class="rules">
						{#if addedRulesShown.hidden > 0}
							<li class="muted">{t('run.earlier', { count: addedRulesShown.hidden })}</li>
						{/if}
						{#each addedRulesShown.shown as rule, i (i)}
							<li><span class="mono">{ruleText(rule, labels)}</span></li>
						{/each}
					</ul>
				{/if}
				<h4>
					{t('pda_convert.rules_so_far')}
					<span class="muted">{t('pda_convert.rules_count', { count: view.rules.length })}</span>
				</h4>
				{@const rulesShown = rulesWindow(view.rules)}
				<ol class="rules">
					{#if rulesShown.hidden > 0}
						<li class="muted">{t('run.earlier', { count: rulesShown.hidden })}</li>
					{/if}
					{#each rulesShown.shown as rule, i (i)}
						<li><span class="mono">{ruleText(rule, labels)}</span></li>
					{/each}
				</ol>
			{/if}

			<PlayerControls
				index={view.index}
				total={view.total}
				playing={view.playing}
				playLabel={t('pda_convert.play')}
				ongo={(to) => converter.go(to)}
				ontoggle={() => (view.playing ? converter.pause() : converter.play())}
			/>

			{#if snap.stage2Refusal}
				<p class="note" role="status">{say(snap.stage2Refusal)}</p>
			{/if}
			{#if snap.problem}
				<EngineNotice problem={snap.problem} onretry={() => void converter.start(doc)} />
			{/if}

			<div class="end">
				{#if view.atEnd && view.stage === 1}
					<button type="button" class="primary" disabled={!onopenpda || opening} onclick={openPda}>
						{opening ? t('convert.working') : t('pda_convert.open_pda')}
					</button>
					<button
						type="button"
						disabled={view.working === 'cfg'}
						aria-busy={view.working === 'cfg'}
						onclick={toGrammar}
					>
						{view.working === 'cfg' ? t('convert.working') : t('pda_convert.to_cfg')}
					</button>
				{:else if view.atEnd && view.stage === 2 && onopengrammar}
					<button type="button" class="primary" onclick={openGrammar}>
						{t('pda_convert.open_grammar')}
					</button>
				{/if}
				<button type="button" class="plain" onclick={close}>{t('pda_convert.close')}</button>
			</div>
			{#if view.stage === 2 && onopengrammar}
				<p class="muted">{t('pda_convert.names_note')}</p>
			{/if}
			{#if note}
				<p class="note" role="status">{note}</p>
			{/if}
		</section>
	{:else}
		<h3>{t('convert.title')}</h3>
		<p class="muted">{t('pda_convert.intro')}</p>
		{#if snap.problem}
			<EngineNotice problem={snap.problem} onretry={() => void converter.start(doc)} />
		{/if}
		{#if snap.refusal}
			<p class="note" role="status">{say(snap.refusal)}</p>
		{/if}
		<button
			type="button"
			class="primary start"
			disabled={snap.status === 'working'}
			aria-busy={snap.status === 'working'}
			onclick={start}
		>
			{snap.status === 'working' ? t('convert.working') : t('convert.start')}
		</button>
	{/if}
</div>

<style>
	.convert {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	h3,
	h4,
	p {
		margin: 0;
	}
	h3 {
		font-size: var(--text-base);
	}
	h4 {
		font-size: var(--text-sm);
		font-weight: var(--weight-strong);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
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
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
	}
	.chip.current {
		border: 2px solid var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.chip:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.sentence {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
	}
	.diff,
	.rules {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		min-width: 0;
	}
	.diff li,
	.rules li {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		overflow-wrap: anywhere;
	}
	.diff.removed li {
		background: var(--color-danger-subtle);
		color: var(--color-danger);
		text-decoration: line-through;
	}
	.diff.added li,
	.rules li {
		background: var(--color-success-subtle);
		color: var(--color-success);
	}
	.rules li.muted {
		background: transparent;
		color: var(--color-muted);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
	.end {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
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
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
	.plain {
		border-color: transparent;
		background: transparent;
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.start {
		align-self: flex-start;
	}
</style>
