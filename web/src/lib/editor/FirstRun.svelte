<script lang="ts">
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { Example } from '#lib/examples/examples.ts';

	// "Coba contoh": what an empty Sandbox shows. A short list of examples (one click each), a way to
	// start from an empty canvas, and the optional tour. It sits over the empty canvas on a laptop and
	// is a sheet at the bottom on a phone. It goes away by itself when a state is added.
	let {
		examples,
		tourSeen,
		failed,
		onexample,
		onblank,
		ontour
	}: {
		examples: readonly Example[];
		/** The tour was seen on this device: it is no longer offered here (the "?" button has it). */
		tourSeen: boolean;
		/** The last example could not be opened. */
		failed: boolean;
		onexample: (id: string) => void;
		onblank: () => void;
		ontour: () => void;
	} = $props();
</script>

<div class="layer">
	<section class="card" aria-labelledby="first-title">
		<h2 id="first-title">{t('first.title')}</h2>
		<p class="subtitle">{t('first.subtitle')}</p>

		<ul class="examples">
			{#each examples as example (example.id)}
				<li>
					<button type="button" class="example" onclick={() => onexample(example.id)}>
						<span class="text">
							<span class="name">{example.title[getLocale()]}</span>
							<span class="about">{example.description[getLocale()]}</span>
						</span>
						<span class="kind"
							>{t(example.kind === 'dfsm' ? 'first.kind_dfsm' : 'first.kind_ndfsm')}</span
						>
					</button>
				</li>
			{/each}
		</ul>

		{#if failed}<p class="note" aria-live="polite">{t('first.failed')}</p>{/if}

		<button type="button" class="blank" onclick={onblank}>{t('first.blank')}</button>

		<div class="foot">
			{#if !tourSeen}
				<button type="button" class="tour" onclick={ontour}>{t('first.tour')}</button>
			{/if}
			<p class="privacy">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path d="M3 8.5l3.2 3L13 4.5" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				{t('first.privacy')}
			</p>
		</div>
	</section>
</div>

<style>
	.layer {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		pointer-events: none;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(34rem, 100%);
		max-height: 100%;
		padding: var(--space-5);
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-2xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-popover);
		pointer-events: auto;
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: var(--text-xl);
	}
	.subtitle {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.examples {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.example {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		min-height: var(--target-min);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.example:hover {
		background: var(--color-neutral-tint);
	}
	.text {
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: var(--weight-strong);
	}
	.about {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.kind {
		flex: none;
		padding: 0 var(--space-2);
		border-radius: var(--radius-pill);
		background: var(--color-neutral-tint);
		color: var(--color-neutral-ink);
		font-size: var(--text-xs);
		font-weight: var(--weight-strong);
	}
	.note {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-warning);
		border-radius: var(--radius-md);
		background: var(--color-warning-tint);
		color: var(--color-warning-ink);
		font-size: var(--text-sm);
	}
	.blank {
		min-height: var(--target-min);
		border: 0;
		border-radius: var(--radius-lg);
		background: var(--color-accent);
		color: var(--color-on-accent);
		font: inherit;
		font-weight: var(--weight-strong);
		cursor: pointer;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
	}
	.tour {
		min-height: var(--target-min);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-accent-ink);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.privacy {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-success);
		font-size: var(--text-sm);
	}
	.privacy svg {
		flex: none;
		margin-top: 0.2em;
		stroke: currentColor;
		stroke-width: 1.8;
	}
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	/* A phone: a sheet at the bottom of the canvas. */
	@media (max-width: 39.99rem) {
		.layer {
			align-items: flex-end;
			padding: 0;
		}
		.card {
			width: 100%;
			border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
			border-bottom: 0;
			padding: var(--space-4);
		}
	}
</style>
