<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Announcement } from './interaction/editor.ts';

	// What the editor says to a screen reader: one polite live region. The text is rewritten for each
	// message (the key is its sequence number), so that the same message twice is said twice.
	let { announcement }: { announcement: Announcement | null } = $props();
</script>

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{#if announcement}
		{#key announcement.seq}{t(announcement.key, announcement.params)}{/key}
	{/if}
</div>
