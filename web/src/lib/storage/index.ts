// Saved machines: the store, opening the machine of the last visit, and saving after each change.

export { createMemoryStore } from './memory.ts';
export { createAutosave } from './autosave.ts';
export type {
	Autosave,
	BaseAutosave,
	DocumentCodec,
	FsmAutosave,
	PdaAutosave,
	SaveStatus
} from './autosave.ts';
export { createMachine, openLatest } from './machines.ts';
export type { Opened, Skipped } from './machines.ts';
export { createPdaMachine, openLatestPda, pdaDocumentCodec, readStoredPda } from './pda-work.ts';
export type { OpenedPda, PdaReadResult, SkippedPda } from './pda-work.ts';
export { isFsmRecord, isPdaRecord } from './store.ts';
export type {
	AnySavedMachine,
	MachineStore,
	SavedFsmMachine,
	SavedMachine,
	SavedPdaMachine
} from './store.ts';

export { openStore } from './open-store.ts';
export type { OpenedStore } from './open-store.ts';
