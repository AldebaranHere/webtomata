<script lang="ts">
	import { getLocale, setLocale, t } from '#lib/i18n/index.svelte.ts';
	import { LOCALES } from '#lib/i18n/translate.ts';
</script>

<div class="switch" role="group" aria-label={t('lang.label')}>
	{#each LOCALES as code (code)}
		<button
			type="button"
			lang={code}
			aria-pressed={getLocale() === code}
			aria-label={t(`lang.${code}_name`)}
			onclick={() => setLocale(code)}
		>
			{t(`lang.${code}`)}
		</button>
	{/each}
</div>

<style>
	.switch {
		display: flex;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	button {
		min-width: var(--target-min);
		min-height: var(--target-min);
		padding: 0 var(--space-3);
		border: 0;
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	button[aria-pressed='true'] {
		background: var(--color-ink);
		color: var(--color-on-ink);
		font-weight: var(--weight-strong);
	}
</style>
