// The state that every player of the Konversi tab has: the step it is at, play and pause (one step
// each 0.8 s, stopping at the end), and the "Konversi selesai!" message that shows for two seconds
// each time the last step is reached. Call it while a component starts, because it makes effects.

export function createPlayer(total: () => number) {
	let index = $state(0);
	let playing = $state(false);
	let justDone = $state(false);
	let wasAtEnd = false;

	const atEnd = $derived(index >= total() - 1);

	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			if (index >= total() - 1) playing = false;
			else index += 1;
		}, 800);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (!atEnd) {
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

	return {
		get index() {
			return index;
		},
		get playing() {
			return playing;
		},
		get justDone() {
			return justDone;
		},
		get atEnd() {
			return atEnd;
		},
		go(to: number) {
			playing = false;
			index = Math.min(Math.max(to, 0), total() - 1);
		},
		toggle() {
			if (atEnd) index = 0;
			playing = !playing;
		}
	};
}
