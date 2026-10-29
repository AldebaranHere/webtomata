<script lang="ts">
	import { getLocale, t } from '#lib/i18n/index.svelte.ts';
	import { OG_TYPE_WEBSITE, ogLocale } from '#lib/seo.ts';

	const pageTitle = $derived(`${t('tentang.title')} · ${t('app.name')}`);
	const description = $derived(t('tentang.description'));
	const localeTag = $derived(ogLocale(getLocale()));
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={OG_TYPE_WEBSITE} />
	<meta property="og:locale" content={localeTag} />
</svelte:head>

<div class="page">
	<article class="container">
		<header class="head">
			<h1>{t('tentang.title')}</h1>
			<p class="lead">{t('tentang.description')}</p>
		</header>

		<div class="sections">
			<section>
				<h2>{t('tentang.what_title')}</h2>
				<p>{t('tentang.what_body')}</p>
			</section>

			<section>
				<h2>{t('tentang.textbooks_title')}</h2>
				<p>{t('tentang.textbooks_body')}</p>
			</section>

			<section>
				<h2>{t('tentang.privacy_title')}</h2>
				<p>{t('tentang.privacy_body')}</p>
			</section>

			<section>
				<h2>{t('tentang.license_title')}</h2>
				<p>{t('tentang.license_body')}</p>
			</section>

			<section>
				<h2>{t('tentang.integrity_title')}</h2>
				<p>{t('tentang.integrity_body')}</p>
			</section>

			<section>
				<h2>{t('tentang.bugs_title')}</h2>
				<p>{t('tentang.bugs_body')}</p>
				<ul class="links">
					<li>
						<a
							href="https://github.com/AldebaranHere/webtomata"
							target="_blank"
							rel="noopener noreferrer"
						>
							{t('tentang.link_github')}
						</a>
					</li>
					<li>
						<a
							href="https://github.com/AldebaranHere/webtomata/issues"
							target="_blank"
							rel="noopener noreferrer"
						>
							{t('tentang.link_issues')}
						</a>
					</li>
					<li>
						<a
							href="https://github.com/AldebaranHere/webtomata/blob/main/CONTRIBUTING.md"
							target="_blank"
							rel="noopener noreferrer"
						>
							{t('tentang.link_contributing')}
						</a>
					</li>
				</ul>
			</section>
		</div>
	</article>
</div>

<style>
	.page {
		padding: var(--space-8) var(--space-6) var(--space-16);
	}

	.container {
		max-width: 48rem;
		margin: 0 auto;
	}

	.head {
		margin-bottom: var(--space-8);
		border-bottom: 1px solid var(--color-border);
		padding-bottom: var(--space-6);
	}

	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--color-ink);
		line-height: var(--leading-tight);
	}

	.lead {
		margin: 0;
		font-size: var(--text-base);
		color: var(--color-muted);
		line-height: var(--leading-relaxed);
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	h2 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--color-ink);
	}

	p {
		margin: 0;
		line-height: var(--leading-relaxed);
		color: var(--color-ink);
		font-size: var(--text-base);
	}

	.links {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.links a {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.links a:hover {
		color: var(--color-accent-hover, var(--color-accent));
	}
</style>
