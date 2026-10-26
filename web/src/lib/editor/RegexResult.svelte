<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	// The result of a conversion that makes a regular expression: the text (it scrolls and can be reached
	// with the keyboard), the notation of Rich with one line for each sign, and "Salin". `onuse`, when it is
	// given, adds a button that puts the expression in the field of Sederhanakan.
	let { regex, onuse }: { regex: string; onuse?: () => void } = $props();

	let copy = $state<'copied' | 'failed' | null>(null);

	async function copyRegex() {
		try {
			await navigator.clipboard.writeText(regex);
			copy = 'copied';
		} catch {
			copy = 'failed';
		}
	}
</script>

<div class="result">
	<h4>{t('convert.regex_result')}</h4>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="scroll" role="region" aria-label={t('convert.regex_result')} tabindex="0">
		<code>{regex}</code>
	</div>
	<p class="muted">{t('convert.regex_notation')}</p>
	<ul class="notation">
		<li>{t('convert.regex_notation_union')}</li>
		<li>{t('convert.regex_notation_epsilon')}</li>
		<li>{t('convert.regex_notation_empty')}</li>
	</ul>
	<div class="end">
		<button type="button" class="primary" onclick={() => void copyRegex()}>
			{t('convert.copy')}
		</button>
		{#if onuse}
			<button type="button" onclick={onuse}>{t('convert.use_in_simplify')}</button>
		{/if}
		<p class="muted" role="status">
			{copy === 'copied' ? t('convert.copied') : copy === 'failed' ? t('convert.copy_failed') : ''}
		</p>
	</div>
</div>

<style>
	.result {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	h4,
	p {
		margin: 0;
	}
	h4 {
		font-size: var(--text-base);
	}
	.muted {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.muted:empty {
		display: none;
	}
	.scroll {
		max-height: 10rem;
		overflow: auto;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.scroll:focus-visible,
	button:focus-visible {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	code {
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
	}
	.notation {
		margin: 0;
		padding-left: var(--space-5);
		color: var(--color-muted);
		font-size: var(--text-sm);
	}
	.end {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
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
	.primary {
		border: 0;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font-weight: var(--weight-strong);
	}
</style>
