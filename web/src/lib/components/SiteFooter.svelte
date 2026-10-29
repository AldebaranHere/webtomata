<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<footer class="site-footer">
	<div class="inner">
		<div class="brand-row">
			<span class="brand-name">{t('app.name')}</span>
			<span class="brand-sep" aria-hidden="true">·</span>
			<span class="brand-tagline">{t('footer.tagline')}</span>
		</div>

		<nav class="footer-links" aria-label={t('footer.about')}>
			<a href={resolve('/tentang')}>{t('footer.about')}</a>
			<span aria-hidden="true">·</span>
			<a
				href="https://github.com/AldebaranHere/webtomata"
				target="_blank"
				rel="noopener noreferrer"
			>
				{t('footer.github')}
			</a>
		</nav>

		<div class="meta-row">
			<span>{t('footer.code_license')}</span>
			<span aria-hidden="true">·</span>
			<span>{t('footer.content_license')}</span>
			<span aria-hidden="true">·</span>
			<span>{t('app.privacy')}</span>
		</div>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-muted);
		font-size: var(--text-sm);
		padding: var(--space-6) var(--space-4);
	}

	.inner {
		max-width: 72rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.brand-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		color: var(--color-ink);
	}

	.brand-name {
		font-weight: 600;
	}

	.brand-sep {
		color: var(--color-muted);
	}

	.brand-tagline {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.footer-links a {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.footer-links a:hover {
		color: var(--color-accent-hover, var(--color-accent));
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-xs);
		color: var(--color-muted);
	}
</style>
