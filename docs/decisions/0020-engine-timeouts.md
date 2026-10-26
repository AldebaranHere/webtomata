# 0020. Timeouts for engine calls, and what the user sees when the engine fails

Status: accepted

## Context

The engine runs in a Web Worker, so the page stays responsive. But a call could still wait forever: the budgets bound the steps of the engine, not the time (`minimize` on 2,000 states takes about 1.4 s in the browser of a laptop, and the budget does not bound that). The only way to stop a running WASM call is to end the worker. The client already survives a crash (`EngineCrashed`) and a cancel (`EngineCancelled`).

## Decision

- **A call has 10 seconds** (`WEB_TIMEOUTS.callMs`). The worst call we measured takes about 1.4 s on a laptop; 10 s leaves room for a cheap phone and is still a wait that a person accepts. It is one number, in one place. We measure on a real phone in G4.
- **Before the worker has answered once, a call has 30 seconds** (`startMs`), because it may also wait for the WASM file to load. The client learns that the worker is ready from its first answer, so there is no new message type.
- **On a timeout the worker is ended and the call fails with `EngineTimeout`.** The other calls that were waiting are **sent again** to the new worker with a new clock, because they did nothing wrong and a call has no side effect. A call that also hangs times out by itself, so this ends. A worker starts again only on the next call.
- **The clock of a call stops when the call is answered, canceled or crashed** (no timer is left behind).
- **The user sees a calm notice** (`EngineNotice`, in the style of the feedback boxes of the Soal wireframe: warning tint, a title, one sentence, a "Coba lagi" button). `engineProblem(error)` chooses the text: a timeout says how many seconds, anything else that is not a cancel counts as a crash, so there is always a way to try again. A cancel that the app made itself shows nothing. The home page is the first user (its version call); S4, S6 and S7 reuse the notice.
- **"Stopped" answers** (a budget ran out, with a partial trace) are part of the answers of the conversions. Their display belongs to S6 and S7.
- **Tests:** unit tests with a fake worker and fake timers cover each rule above. Two browser tests check what a fake cannot: with the real WASM, the main thread is never blocked for more than 250 ms while a 2,000-state `minimize` runs for over 600 ms in a worker (we measured 2.6 s and a biggest gap of 12 ms), a canary proves that the measurement sees a blocked thread, and a blocked WASM file shows the notice and recovers with "Coba lagi".

## Consequences

- A device that sleeps during a call can make the timeout fire on waking. The user sees the notice and presses "Coba lagi".
- A legitimate call longer than 10 s on a very slow phone fails. If G4 shows this, we raise the number or give `minimize` its own limit (see the decision about large machines in S7).
- The text of the notice is a draft until the feedback guide (U4).
