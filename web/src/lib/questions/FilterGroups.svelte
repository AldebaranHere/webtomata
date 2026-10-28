<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Filters, facets } from './list.ts';

	// The three groups of filters (week, type, difficulty). One choice in each group, and "Semua" for no
	// filter. Native radio buttons, so the keyboard and a screen reader work with no extra code; the
	// chip is the label. The groups are drawn twice (in the page on a laptop, in the sheet on a phone),
	// so `name` keeps the radio groups of the two apart.
	let {
		name,
		available,
		value,
		onchange
	}: {
		name: string;
		available: ReturnType<typeof facets>;
		value: Filters;
		onchange: (next: Filters) => void;
	} = $props();
</script>

{#snippet group<T extends number | string>(
	field: 'week' | 'type' | 'difficulty',
	label: string,
	options: readonly T[],
	text: (option: T) => string
)}
	<fieldset>
		<legend>{label}</legend>
		<div class="chips">
			<label class="chip">
				<input
					type="radio"
					name="{name}-{field}"
					checked={value[field] === null}
					onchange={() => onchange({ ...value, [field]: null })}
				/>
				<span>{t('soal.filter.all')}</span>
			</label>
			{#each options as option (option)}
				<label class="chip">
					<input
						type="radio"
						name="{name}-{field}"
						checked={value[field] === option}
						onchange={() => onchange({ ...value, [field]: option })}
					/>
					<span>{text(option)}</span>
				</label>
			{/each}
		</div>
	</fieldset>
{/snippet}

<div class="groups">
	{@render group('week', t('soal.filter.week'), available.weeks, (week) => String(week))}
	{@render group('type', t('soal.filter.type'), available.types, (type) => t(`soal.type.${type}`))}
	{@render group('difficulty', t('soal.filter.difficulty'), available.difficulties, (d) =>
		t(`soal.difficulty.${d}`)
	)}
</div>

<style>
	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		float: left;
		min-width: 4.5rem;
		padding: 0;
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		position: relative;
		display: inline-flex;
	}
	.chip input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.chip span {
		display: inline-flex;
		align-items: center;
		min-height: var(--target-min);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--text-base);
	}
	.chip input:checked + span {
		border-color: var(--color-accent);
		background: var(--color-accent-tint);
		color: var(--color-accent-ink);
		font-weight: var(--weight-strong);
	}
	.chip input:focus-visible + span {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
</style>
