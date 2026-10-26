# Editor interactions

The rules for the diagram editor: what each mouse, touch and keyboard action does, which command it sends, and what the user hears and sees. S4 (the diagram view) is built from this file. The wireframes ("Automata Tool Wireframes", 2026-10-21) give the layout and the tool names. The commands are in [`web/src/lib/editor/commands.ts`](../../web/src/lib/editor/commands.ts), the history in [`history.ts`](../../web/src/lib/editor/history.ts) ([ADR 0017](../decisions/0017-document-commands-history.md)).

Words: the UI says **state** (not "status", which the first wireframes used), as in the course slides; see `docs/glossary.md`.

## Rules for the whole editor

1. **One rule per interaction.** Mouse, touch and keyboard are three ways to the same rule, in the same row of the table below.
2. **Every document change is a command** sent through the history. The view never edits the document.
3. **One user action is one undo step.** Dragging is previewed in the view and sent as one command when the pointer is released. Typing in a field is sent when the user presses Enter or leaves the field.
4. **A refused command shows its message** next to the control that caused it. The document does not change. Messages are keys with parameters; the engine and the document never produce sentences.
5. **The editor never blocks a machine that is wrong.** Two transitions on one symbol in a DFSM, or a missing start state, are allowed while editing. Validation shows them (S6).
6. **Positions are whole numbers** in canvas units (1 unit is 1 px at 100% zoom). A pointer position is turned into canvas units, then rounded.
7. **Selection, tool, pan and zoom are not in the document and not in the history.** They are lost when the page closes.
8. **Targets are at least 44 × 44 px** (`--target-min`). A thin line (an edge) has an invisible hit area that is 44 px wide on touch and 24 px wide on mouse.
9. **Every action has a keyboard way**, and every result is announced to screen readers (see "Announcements"). The table view is still the accessible alternative to the diagram.
10. **Colors and sizes are tokens.** Strokes use `--color-neutral-ink`, fills `--color-surface`, selection and focus `--color-accent`, label backgrounds `--color-surface`. A wrong edge is dashed `--color-warning` (S6).

## Words used here

- **State**: a circle, with an id (never reused), a name and a place.
- **Edge**: all transitions from one state to one state, drawn as one arrow with one label. An edge exists only if it has at least one transition. The document stores transitions; the view groups them by (from, to). Selecting an edge selects the pair.
- **Self-loop**: an edge whose from and to are the same state.
- **Tool**: Pilih (V), Tambah state (S), Tambah transisi (T), Hapus (Del). The tool stays until the user picks another one, or presses Esc (back to Pilih).
- **Label field**: the small text box on an edge, where symbols are typed.

## Drawing conventions (follow the textbook)

| Part | Rule |
| --- | --- |
| State | Circle, radius 32, fill `--color-surface`, stroke 1.5 `--color-neutral-ink`. The name is centered, in the UI font, semi-bold (as in the wireframes). A name of up to 4 characters is 16 px; a longer one shrinks to at least 11 px, and if it still does not fit it is cut with "…" and the full name is the tooltip (`<title>`). |
| Accepting state | A second circle, radius 26, inside. The outer circle does not change. |
| Start | One arrow of length 40 that ends at the rim of the start state, with the label "mulai" at its tail (beyond the end of the arrow, as in the wireframes). Only one state can be the start. |
| Edge | Arrow from rim to rim, stroke 1.5, arrowhead 10 long. The label is at the middle of the edge, on the left of the direction of travel (above a rightward edge), with its nearest side 4 from the line, and a halo 4 wide in the color of the canvas (`--color-ground`) so a line never cuts the text. |
| Label text | `--font-mono`. Symbols in alphabet order, then `ε` last, separated by `, `. |
| Opposite edges | If A→B and B→A both exist, both are drawn as curves: the middle of each curve is 24 to the right of the straight line, looking in its direction of travel. They are on different sides, and each label goes outside its curve. An edge with no opposite edge is straight, **unless it would pass within 8 of the circle of another state** (100 from the center of a state that has a self-loop, to leave room for the loop and its label): then it curves too, on the side where the smaller bulge clears every state (the right if both are equal). |
| Self-loop | A loop that leaves the rim at 30° left of its angle and comes back 30° right of it, reaching 40 above the rim. The label is beyond the top of the loop, 4 away. The angle is chosen by the rule below. |
| Selected | A ring of stroke 2, `--color-accent`, at radius 37 (4 outside the circle) for a state; the edge line in `--color-accent` and stroke 2.6 for an edge. |
| Focus | The focus ring of the tokens, around the selection ring if both are there. |

These numbers are starting values from the wireframes. S4 may change a number if the rules still hold: no label covers another label or a state in the cases of the test below, and every part is still 44 px to hit.

**Angle of the start arrow and of self-loops.** A state has a set of busy angles: the direction in which each edge leaves or arrives, the direction to every other state within 150 (even without an edge, because an arrow or a loop would run into it), the direction to an edge of another state that passes within 90 of its center, and (for a loop) the angle of its start arrow. Candidates are every 15°.

- **The start arrow** is placed first. It keeps to the left (180°) while the left has at least 90° of room to every busy angle. If not, the free angle nearest to the left wins (a tie goes clockwise); if no angle has 90° of room, the angle with the biggest gap wins.
- **A self-loop** takes the angle with the biggest gap to the busy angles. A tie goes to the top (−90°), then clockwise. A loop spans 60° (30° each side of its angle).

The angle is computed from the document, never stored, so the same document always looks the same.

**Tests for S4a (pure functions, no browser).** `edgeGeometry(document)` returns the path, the points and the label box of every edge (`web/src/lib/editor/diagram/geometry.ts`). The tests check: the ends of edges on the circles, the side of the labels, opposite pairs, the choice of angles, edges that curve around a state, long names, the bounds, determinism, speed (200 states and 421 edges in about 9 ms), and the property that **no two labels overlap and no label covers a state** in 300 random machines on a grid. A label is not wrapped: one that is wider than the space between two circles (three symbols are 75 px, and two circles 130 apart leave 66) cannot fit. The user moves a state. The random machines therefore have at most two symbols per edge.

## Interactions

Notation: **Cmd** is the command of S3. "Step" is one undo step.

### Add a state

| Way | Rule |
| --- | --- |
| Mouse | With **Tambah state**, a click on empty canvas adds a state centered there. In any tool, a double-click on empty canvas does the same. |
| Touch | With **Tambah state**, a tap on empty canvas adds a state. (In **Pilih**, a tap on empty canvas only clears the selection.) |
| Keyboard | `N`, with the canvas focused, adds a state at the center of the visible area, in any tool. If a state is within 72 of that spot, the new state goes to the nearest free spot on a grid of 80, searched in a spiral. |
| Cmd | `addState {x, y}` (the name is `q<k>`) |
| Step | One |
| After | The new state is selected and focused. The tool does not change. |
| Announce | `editor.state_added {name}` |

Where the pointer is on a state (inside radius 32 plus the 8 px ring for touch), the click is a click on that state, never a new one.

### Rename a state

| Way | Rule |
| --- | --- |
| Mouse | Select the state, press `Enter` or `F2`; or use the menu (right-click) → "Ubah nama". |
| Touch | Long-press the state → menu → "Ubah nama". |
| Keyboard | `Enter` or `F2` on the selected state. |
| Field | A text box over the state with the name selected. `Enter` sends, `Esc` cancels. Size 16 px or more (no zoom on phones). |
| Cmd | `renameState {id, name}` |
| Step | One, when `Enter` is pressed |
| Error | If the document refuses (`document.duplicate_name`, `document.invalid_name`), the field stays open, the message shows under it and is announced. Nothing changes until a valid name is sent. |

A double-click is **not** rename. It toggles accepting (next row).

### Start state and accepting states

| Way | Rule |
| --- | --- |
| Mouse | Double-click a state in **Pilih**: toggle accepting. Menu: "Jadikan start state", "Accepting state". |
| Touch | Long-press → menu (same items). |
| Keyboard | On the selected state: `A` toggles accepting, `M` makes it the start (on the start state, `M` clears the start). |
| Cmd | `setAccepting {id, accepting}`; `setStart {id}` or `setStart {id: null}` |
| Step | One each |
| Several selected | The menu items and keys act on the selected states for accepting (a batch of `setAccepting`: all become accepting unless all already are, then all become not accepting). `M` needs exactly one selected state; otherwise it does nothing and announces `editor.need_one_state`. |
| Announce | `editor.accepting_on {name}`, `editor.accepting_off {name}`, `editor.start_set {name}`, `editor.start_cleared` |

### Move states

| Way | Rule |
| --- | --- |
| Mouse | In **Pilih**, press on a state and drag. The drag starts after 4 px. If the state is selected, all selected states move; if it is not, it becomes the only selected one first. While dragging, the view shows the new places (the document is not changed). On release, one command is sent. `Esc` during the drag cancels it. `Shift` held at release snaps each place to a grid of 20. |
| Touch | Same, with 8 px before the drag starts. One finger on a state drags it; one finger on empty canvas pans. |
| Keyboard | `Alt+Arrow` moves the selected states by 10; `Alt+Shift+Arrow` by 50. |
| Cmd | Drag: `batch` of `moveState` (one per moved state; one `moveState` when only one moves). Keyboard: `moveState` per state in a `batch`, with `coalesce: "nudge"`. |
| Step | Drag: one. Keyboard: a series of arrow presses is one step; the series ends (`seal()`) when the selection changes, when any other key is pressed, when the canvas loses focus, or on `Esc`. |
| Limit | The place is kept inside ±1,000,000 (`LIMITS.coordinate`); a move beyond that is stopped at the edge. |
| Announce | `editor.moved {name, x, y}` after a keyboard move (not during a drag) |

### Add a transition

| Way | Rule |
| --- | --- |
| Mouse | With **Tambah transisi**, press on a source state, drag, and release on a target state. A click on the source then a click on the target works too (two-click mode). Releasing on empty canvas cancels: no state is created. |
| Touch | With **Tambah transisi**, tap the source, then tap the target. |
| Keyboard | Select the source state, press `T` (or pick the tool and press `Enter` on the source). Move focus to the target with the arrows or `Tab`, press `Enter`. `Esc` cancels at any point. |
| While choosing | The source has the selection ring. A preview arrow follows the pointer (mouse and touch drag) and snaps to a state when over it. A hint line says what to do: `editor.hint_pick_target`. |
| Then | The label field opens on the new edge with focus and an empty text. See "Edit the symbols of an edge". |
| Same target | The target can be the source: that is a self-loop (see below). |
| Edge exists | If the edge (source → target) already exists, no new edge is made: its label field opens with its current symbols. |
| Cmd | None until the label is sent; then see "Edit the symbols of an edge". An edge without symbols does not exist. |
| Step | One, when the label is sent. If the label is empty or `Esc` is pressed, nothing is done and there is no step. |

### Add a self-loop

It is a transition whose target is the source. Mouse: in **Tambah transisi**, release on the source itself (drag and return), or click the source twice. Touch: tap the source, tap it again. Keyboard: `T`, then `Enter` on the same state. The loop is drawn at the angle chosen by the rule above. Everything after that is the same as for any edge.

### Edit the symbols of an edge

| Way | Rule |
| --- | --- |
| Open | Select an edge and press `Enter` or `F2`; or double-click the label (or the edge); or long-press → "Ubah simbol"; or it opens by itself after "Add a transition". |
| Field | A text box on the label, filled with the current symbols (`a, b, ε`), all selected. Size 16 px or more. |
| Typing | Symbols are separated by commas or spaces. Each part is one symbol (`num` is one symbol). Empty parts are ignored. The same symbol twice counts once. |
| ε | The word `eps`, the character `ε`, `Ctrl+E` (`Cmd+E` on a Mac) and the **Ketik ε** button (on the phone, in the dock, always shown while the field is open) all write `ε`. `ε` is stored as `on: null`. The key `E` alone is **not** a shortcut. A symbol named `eps` cannot be typed (it is ε); that is the only word with a special meaning. |
| A long symbol | If the alphabet has only one-character symbols, and a part has several characters and is not in the alphabet (for example `ab`), the field asks before it sends: `editor.ask_split {text}` with two buttons: "a, b" (split into one-character symbols) and "satu simbol ab". Otherwise `ab` is one symbol, with no question. |
| Send | `Enter` sends. `Esc` cancels. Leaving the field (blur) sends if the text is valid and changed, and cancels otherwise. |
| What is sent | The new set of symbols is compared with the symbols the edge has now. One `batch`: `addSymbol` for each symbol not in the alphabet, `addTransition` for each added symbol, `removeTransition` for each symbol that is gone. For a new edge the "current" set is empty. |
| Empty text | On an existing edge, `Enter` with empty text deletes the edge (a batch of `removeTransition`) and announces it. On a new edge it cancels. |
| Unused symbols | A symbol that no transition uses stays in the alphabet (a DFSM may need it for its table). Removing a symbol from the alphabet is done on its column header in the table (S5-2), with `removeSymbol`; that command also removes the transitions that use the symbol, as one undo step, and a toast with Urungkan says so. The Definisi tab is read only. |
| Errors | `document.invalid_symbol` (spaces and control characters cannot be here because spaces split the text; too long or `ε` inside a longer text can), `document.limit_exceeded`. The field stays open and shows the message. |
| Step | One |
| Announce | `editor.edge_changed {from, to, symbols}`, `editor.edge_removed {from, to}` |

### Delete

| Way | Rule |
| --- | --- |
| Mouse | `Delete` or `Backspace` (only when the canvas has focus, not in a field) deletes the selection. With **Hapus**, a click on a state or an edge deletes it, and the tool stays. Menu → "Hapus". |
| Touch | Select, then the **Hapus** button of the dock; or **Hapus** tool, then tap. Long-press → "Hapus". |
| Keyboard | `Delete` or `Backspace` on the selection. |
| Cmd | One `batch`. For each selected state, `removeState` (it removes its transitions, start and accepting mark). For each selected edge, `removeTransition` for every one of its symbols, **except** edges that touch a selected state, because `removeState` has already removed them (a `removeTransition` after that is refused, and a refused command refuses the whole batch). |
| Step | One for the whole selection. |
| Confirm | No dialog. A message appears for 6 seconds: `editor.deleted {what}` with a button **Urungkan** (44 px) that undoes. It is a polite live region, so a screen reader says it. The message stays while the pointer or focus is on it. |
| After | The selection is empty. Focus goes to the nearest remaining state, or to the canvas. |
| Not deleted | The alphabet, the title and the kind. |

### Select

| Way | Rule |
| --- | --- |
| Mouse | In **Pilih**, click a state or an edge to select only it. `Shift+click` or `Ctrl/Cmd+click` adds or removes it. `Shift+drag` on empty canvas draws a rectangle and selects the states fully inside it (edges between two selected states are selected too). Click on empty canvas clears. `Ctrl/Cmd+A` selects all. |
| Touch | Tap selects one. Long-press opens the menu. Selecting several is not in v1 on touch (it is a decision for after the usability tests, U5). |
| Keyboard | `Tab` and `Shift+Tab` go through the states (by id), then the edges (by from, then to), then leave the canvas. The arrow keys move focus to the nearest state in that direction. `Space` toggles the selection of the focused item, `Esc` clears the selection. Focus and selection are the same for one item; `Space` is for adding to a selection. |
| Selection after a change | After undo and redo, ids that no longer exist are dropped from the selection. Nothing else changes. |
| Announce | `editor.selected {count}` or the name of the single item. |

### Pan and zoom

| Way | Rule |
| --- | --- |
| Pan, mouse | Drag on empty canvas (in **Pilih**; in other tools, hold `Space` and drag, or use the middle button). The mouse wheel and a trackpad scroll pan. |
| Pan, touch | One finger on empty canvas. |
| Pan, keyboard | `Shift+Arrow` moves the view by 100. |
| Zoom, mouse | `Ctrl/Cmd + wheel`, around the pointer. |
| Zoom, touch | Two-finger pinch, around the middle of the fingers. |
| Zoom, keyboard | `+` and `−` change by a step (×1.25 and ÷1.25); `0` sets 100%; `1` fits the whole machine in the view. |
| Control | The zoom control of the wireframe: − , "100%", + , and a button "Pas" (fit). Targets 44 px. |
| Range | 25% to 400%. |
| First view | On opening a document, fit the machine; if it is empty, 100% at the origin. After that, the view changes only when the user changes it. A new state added off-screen scrolls the view just enough to show it. |
| Cmd | None. The view is not in the document. |

### Undo and redo

| Rule | |
| --- | --- |
| Keys | `Ctrl/Cmd+Z` undo, `Ctrl+Y` and `Ctrl/Cmd+Shift+Z` redo. The buttons "Urungkan" and "Ulangi" do the same, and are disabled when there is nothing to do. |
| Scope | The document only: states, transitions, symbols, names, places, start, accepting, kind, title. Not selection, tool, pan or zoom. |
| One history | The diagram, the table and the definition views share one history. An edit in any view can be undone in any view. |
| When a field is open | In a text field, `Ctrl+Z` is the text undo of the field, not the document's. |
| Life | The history lives in memory. Reloading the page starts a new history from the saved document. The depth is 200 steps. |
| After | Focus and tool stay. The selection loses ids that are gone. |
| Announce | `editor.undone` and `editor.redone` (no detail: the history does not store a description of a step) |

### Auto layout

The button "Tata letak otomatis" (S9) sends one `batch` of `moveState`, so it is one step and can be undone.

## Phone dock and menu

The dock has **Pilih**, **State**, **Transisi**, **Ketik ε** (shown only while a label field is open) and **Hapus**, each 44 × 44 or more. The menu (long-press, or right-click) shows items by what was pressed:

| Pressed | Items |
| --- | --- |
| A state | Ubah nama · Jadikan start state · Accepting state (check mark when on) · Tambah transisi dari sini · Hapus |
| An edge | Ubah simbol · Hapus |
| Empty canvas | Tambah state di sini |

Each item is a button with an accessible name, reachable with the arrows, closed with `Esc`.

## Keys

| Key | Action |
| --- | --- |
| `V` `S` `T` | Tools Pilih, Tambah state, Tambah transisi |
| `Esc` | Cancel the open field, drag or transition; then clear selection; then back to **Pilih** |
| `N` | New state at the center of the view |
| `Enter` / `F2` | Rename a state, or edit the symbols of an edge |
| `A` / `M` | Toggle accepting / make start |
| `Delete` / `Backspace` | Delete the selection |
| `Alt+Arrow` | Move the selected states by 10 (`Shift`: 50) |
| `Arrow` | Move focus to the nearest state |
| `Shift+Arrow` | Pan |
| `+` `−` `0` `1` | Zoom in, out, 100%, fit |
| `Ctrl/Cmd+A` | Select all |
| `Ctrl/Cmd+Z`, `Ctrl+Y`, `Ctrl/Cmd+Shift+Z` | Undo, redo, redo |
| `Ctrl/Cmd+E` | Write ε (in a label field) |

Single-letter keys work only when the canvas has focus and no field is open, so typing a symbol never changes the tool.

## Announcements

Messages are keys with parameters, spoken through one polite live region (`role="status"`). The Indonesian text is a draft until the feedback guide (U4); every key needs `id` and `en`.

| Key | Parameters | Draft text (id) |
| --- | --- | --- |
| `editor.state_added` | name | "State {name} ditambahkan." |
| `editor.deleted` | what, count | "{what} dihapus." (with **Urungkan**) |
| `editor.edge_changed` | from, to, symbols | "Transisi {from} ke {to}: {symbols}." |
| `editor.edge_removed` | from, to | "Transisi {from} ke {to} dihapus." |
| `editor.accepting_on` / `_off` | name | "{name} menjadi accepting state." / "{name} bukan lagi accepting state." |
| `editor.start_set` / `_cleared` | name | "{name} menjadi start state." / "Start state dihapus." |
| `editor.moved` | name, x, y | "{name} dipindah." |
| `editor.selected` | count or name | "{count} dipilih." |
| `editor.undone` / `editor.redone` | none | "Dibatalkan." / "Diulang." |
| `editor.hint_pick_target` | none | "Pilih state tujuan." |
| `editor.need_one_state` | none | "Pilih satu state." |
| `editor.ask_split` | text | "Maksud Anda simbol terpisah atau satu simbol?" |

Errors from the document keep their own keys (`document.duplicate_name` and so on) and are shown by the same region. The tone follows U4.

## Decisions made while building S4b-1

- **Tools:** Pilih, Tambah state and **Hapus** (a press on a state deletes it). The transition tool comes with S4c.
- **Canvas:** a world of 1600 × 1000 units shown at 100%, scrolled by the browser. Pan and zoom replace this in S4d.
- **Add by double-click:** a double-click on empty canvas adds a state in every tool except Tambah state, where one click already adds.
- **Selection and focus:** `Tab` moves focus and the selection together. `Ctrl+Arrow` moves focus only, and `Space` toggles the focused state in the selection.
- **Drag:** the drag is a preview; one batch of `moveState` is committed on release, and `Esc` cancels. A nudge with `Alt+Arrow` is one undo step until the selection changes or the canvas loses focus.
- **Thresholds:** a drag starts after 4 px with a mouse and 8 px with a finger.
- **Layout:** on a laptop the tools and undo/redo are a column at the left. On a phone the tools are a bar at the bottom and undo/redo are in the title bar. Targets are at least 44 px.
- **Sandbox page:** it fills the screen and has no footer. A "leave the page?" warning protects changes that are not saved on the device yet (S10a-1).

## Decisions made while building S4b-2

- **Focus follows a press:** pressing a state with the mouse or a finger also gives it the keyboard focus, so `A`, `M`, `Enter` and `Delete` act on it at once.
- **Name field:** a text box in canvas units (it scrolls with the canvas), 44 px high, text 16 px, the name selected when it opens. Leaving the box without `Enter` (a tap elsewhere) cancels. The field closes by itself if its state is gone. While it is open, the other editing is blocked and the keys of the canvas do not reach it.
- **Refused names:** `document.duplicate_name` and `document.invalid_name` have their own texts, shown under the box and said by the live region.
- **Menu:** opens with a right-click, the menu key, or a long-press of 500 ms (cancelled when the finger moves 8 px). Pressing a state that is not selected selects it first. For one state: Ubah nama, Jadikan start state, Accepting state, Hapus. For several: Accepting state, Hapus. For empty canvas: Tambah state di sini, at the press, and Tata letak otomatis (S9) when the machine has states. A finger lifted within 350 ms of a long-press does not choose an item.
- **Toast:** it is not a live region itself, because the live region of the editor already says the same words. It stays while the pointer or the focus is on it. After **Urungkan**, the focus goes back to the canvas. Any change to the document removes it.
- **Double-click** reads the state under the pointer, not the event target, because the browser reports the captured svg as the target.
- **Not yet:** the menu item "Tambah transisi dari sini" and the items for an edge come with S4c, and the Transisi button of the dock too.

## Decisions made while building S4c-1

- **Tool and key:** Tambah transisi is the fourth tool (`T`). With one state selected, `T` also makes that state the source. A drag from a state in this tool is an arrow, never a move.
- **Two ways with the mouse and one with the finger:** press, drag and release on the target; or click the source and then the target; on touch, tap the source and then the target (a drag works too). A release on empty canvas, `Esc`, another tool, an undo, a new state or a delete cancels the half-made transition. A click on empty canvas cancels it too.
- **Keyboard:** with the tool, `Enter` on the selected state chooses the source. The arrows or `Tab` move the focus to the target while the selection stays on the source, and `Enter` chooses it.
- **While choosing:** the source has the selection ring, a dashed preview arrow follows the mouse and ends at the circle of a state under it, and a hint line (`editor.hint_pick_source`, `editor.hint_pick_target`) says what to do. The same words are said by the live region.
- **Label box:** it sits on the label of the edge, or above the source for a loop, or over the middle of the new edge. The edge text is in the order of the alphabet with ε last, as it is drawn. An edge that exists opens its box with its symbols; an empty text then removes it (one step).
- **ε:** the **Ketik ε** button is in the box, not in the dock (the dock is hidden behind the keyboard on some phones; the box is scrolled into view). A press on it does not take the focus from the text. `Ctrl/Cmd+E` and the words `eps` and `ε` work too.
- **Leaving the box:** a text that changed is sent; a text that did not change, or is refused, or needs an answer, cancels.
- **A finger on a state (found on a real phone):** the editor cancels the browser's own handling of that touch (a non-passive `touchstart`), so a drag is not taken over by a scroll and the browser does not send the mouse events that follow a tap. Those events landed on the state under the finger and took the focus from a box that the tap had just opened. As a second defence, a name box or label box takes the focus back if it loses it in its first 400 ms. Playwright's `tap()` does not send those mouse events; the tests use real touch events (`e2e/touch.ts`).
- **Not yet (S4c-2):** selecting, editing and deleting an edge, the menu items for an edge, and "Tambah transisi dari sini".

## Decisions made while building S4c-2

- **One edge at a time (a decision to revisit after U5):** the selection is either states or one edge, never both. A rectangle selects states only. So the rule "leave out edges of deleted states" in the delete batch is not needed: an edge is deleted alone, as one `batch` of `removeTransition`, one for each symbol.
- **Hit areas:** every edge has an invisible line 44 units wide (and a box over its label) under the circles, so a state always wins where they overlap. In the State and Transisi tools the edges are part of the empty canvas (a click near a line still adds a state or cancels a choice).
- **Keyboard:** each edge is a button ("Transisi dari q0 ke q1: a, b"). `Tab` reaches the states first and then the edges, and an edge that gets the focus by `Tab` is selected. `Enter` or `F2` edits it, `Delete` removes it, `Esc` clears it. After an edit the focus returns to the edge, or to its source state if the edge is gone.
- **Pointer:** a click, a tap or a double-click on the line or its label selects it or edits it. In Hapus a click removes it. A touch that starts on an edge is the editor's (no scroll), as for a state, in Pilih and Hapus.
- **Menu:** an edge has "Ubah simbol" and "Hapus". A state has "Tambah transisi dari sini" (one state only), which switches to Transisi with that state as the source.
- **Delete toast:** deleting an edge shows the same toast with **Urungkan** ("Transisi dari q0 ke q1 dihapus.").

## Decisions made while building S4d-1

- **No edge to the canvas.** The 1600 × 1000 area is gone. A state may be anywhere within ±1,000,000 of the origin (the limit of the document). The view is a camera (`interaction/camera.ts`): `screen = world × scale + offset`. It is not part of the document or the history.
- **Zoom** is 25% to 400%, around the pointer for the wheel, and around the middle of the view for the keys and buttons. A step is ×1.25. One turn of a mouse wheel zooms by a modest step, and a trackpad pinch (which arrives as Ctrl and wheel) zooms smoothly.
- **Pan:** the wheel and the trackpad scroll (without Ctrl or Cmd), a drag on empty canvas in Pilih, `Space` and drag in any tool, the middle button, one finger on empty canvas, and `Shift+Arrow` (100 px; the content moves the other way). A drag that pans never adds a state or clears the selection.
- **Keys:** `+` and `=` zoom in, `-` and `_` zoom out, `0` is 100%, `1` fits the machine. With Ctrl, Cmd or Alt they belong to the browser.
- **First view:** on opening, the whole machine is fitted (never enlarged beyond 100%, never below 25%), centered, with 48 px around it. An empty canvas opens at 100% at the origin. A state that gets the focus (a new one, or one reached with the arrows) and is off the screen moves the view just enough to show its whole circle.
- **Zoom control (laptop):** −, the percentage (a press sets 100%), +, and Pas (fit), each 44 px, at the bottom right. The percentage is said by a polite live region. **A phone has no control but a Pas button in the title bar** (44 px), so that a user who pinched or panned away can come back. This adds one button to the wireframe.
- **Boxes and menus** are placed by screen position and keep their own size (16 px text) at every zoom. The hit line of an edge is 44 px on the screen at every zoom (a non-scaling stroke).
- **Distances on the screen:** the 4 px and 8 px thresholds for a drag are screen pixels, whatever the zoom; a drag of a state moves it by the distance in the world.
- **No inline style attribute:** the page's security policy blocks one, so the background dots (they move with the camera) are set through the CSS object model.

## Decisions made while building S4d-2

- **Pinch:** two fingers on the canvas zoom by the distance between them, and the point of the world that was between them stays between them as they move, so the fingers also pan. The zoom stays between 25% and 400%.
- **A second finger ends what the first one began:** a state drag goes back to where it was (no undo step), an arrow that was being drawn is cancelled, a rectangle is dropped, and a long-press that has not opened its menu never will. Until every finger is lifted, no finger starts anything new (a third finger, or the finger that is left after a pinch).
- **The first view refits** when the view gets its final size a moment after the first draw (fonts, the bars), or when the phone turns, until the user moves the camera. After **Pas**, it refits again.
- **The key table is a test:** `keys.test.ts` lists every row of the table "Keys" above. A key of the spec that stops working fails it.
- **The acceptance of S4** is `e2e/editor-flows.spec.ts`: a 4-state DFSM is built from nothing, by mouse and keyboard on a laptop and by touch (real touch events) on a phone, and axe finds no violation. On a phone the start and accepting marks are made with the long-press menu.

## Decisions made while building S10a-1

- **Status next to the title:** "Tersimpan di perangkat ini" (the wording of the glossary, not "Disimpan" of the wireframe), "Menyimpan…", "Belum tersimpan" (a write was refused) or "Tidak tersimpan" (the browser gives no storage). On a phone the good states are only a mark (the words are for a screen reader). A problem also has a strip of text under the bar that is an alert.
- **The editor opens a moment after the page:** the prerendered page has an empty frame of the same size, and the editor takes its place when the saved machine has been read. A reload shows no sample first.
- **A machine that cannot be read** is skipped and kept, and a message above the editor says so and can be closed. See ADR 0023.

## Decisions made while building S10a-2

- **"Mesin saya (n)"** is in the header on a laptop, and an icon button (44 px, with the same name) in the title bar on a phone, where the header has no room. A phone also hides the number of states in the title bar. This differs a little from the wireframe, which puts the button in the header only.
- **The list** is a native `<dialog>` (a sheet from the bottom on a phone), loaded only when it is first opened. A row opens a machine; the "…" button shows **Ubah nama**, **Duplikat** and **Hapus**. "Buka file" and "Ekspor .jff" are not there: they are S10b. The footer says that clearing site data deletes the machines.
- **Open:** the machine that is left is saved first. **Mesin baru** is an empty DFSM called "Tanpa judul", saved and opened. **Duplikat** makes "… (salinan)" right under the original and does not open it.
- **Rename:** the open machine through the editor (one undo step); another machine in its record. A title that the document refuses is shown under the field.
- **Delete:** the row goes away at once and the machine is removed for good after six seconds, with a toast and **Urungkan**. Closing the page inside the six seconds keeps the machine. Deleting the open machine opens another one first (a new empty one if it was the only one), and the list stays open.
- **A machine that cannot be read** is in the list, marked "Tidak bisa dibuka", with only **Hapus**.
- **Safari and a field that is added later:** the attribute `autofocus` does not work, so the rename field takes the focus in code.

## Decisions made while building S6-1

- **The panel:** a column of 22 rem at the right of the canvas on a laptop. On a phone it is under the canvas with a fixed share of the height (40%), so that the canvas does not change its size when the checks arrive (that would move the view under a finger), and a bar of 44 px hides it; the choice is remembered on the device. For now it holds "Simulasi" and the checks. The tabs of the wireframe come with S5, S9 and S7.
- **The checks** are asked of the engine (in its worker) 200 ms after the last change, never on the main thread, and an answer for an older machine is thrown away. A failed engine shows the calm notice with a way to try again, and the editor goes on.
- **Calm:** "Pemeriksaan" shows one line (a count, or "lengkap") and the list only when asked for. A half-built DFSM always has something to look at: that is not an alarm. A check about a state puts a small mark on it (the name of the state also says "ada hal yang perlu dilihat"), and pressing the check selects and focuses that state.
- **The texts** (`check.*`) are a draft with `TODO(review)` until the feedback guide (U4). A test reads the keys from the Rust source, so a new check cannot be added without a text.

## Decisions made for the titles of machines from content

- A machine from our content has its title in both languages, and the page shows the one of the language that is active, in the title bar and in "Mesin saya". A title that the user chose is shown as it is, in any language. See ADR 0023.

## What each interaction needs from S3

Every interaction uses an existing command. No new command is needed for S4.

| Interaction | Commands | Checked |
| --- | --- | --- |
| Add a state | `addState` | S3 tests |
| Rename | `renameState` | S3 tests |
| Move (one or more) | `moveState` (in a `batch`) | one batch is one step, undo restores all (checked for this spec) |
| Keyboard move | `moveState` with `coalesce: "nudge"` | a series is one step (checked for this spec) |
| Start, accepting | `setStart`, `setAccepting` | S3 tests |
| Edit the symbols of an edge | `batch` of `addSymbol`, `addTransition`, `removeTransition` | atomic, undo also removes the new symbol (checked for this spec) |
| Delete the selection | `batch` of `removeState`, `removeTransition` | an edge of a deleted state must be left out of the batch (checked for this spec) |
| Auto layout | `batch` of `moveState` | S3 tests |

Two checks decide what S4 must test again in the browser: that a dragged state is previewed and not sent until release, and that the delete batch leaves out edges of deleted states.

## Not in v1

Copy and paste, dragging an edge to change its ends, editing an edge's curve by hand, selecting several items on touch, labels that wrap or move to find room (the user moves a state), and grid snap that stays on. Each is a decision after the usability tests (U5).

## Decisions made while building S6-2

- **One call, then local steps.** "Jalankan" asks the engine once (`simulate`, in the worker, with the web budget of 10,000 steps) and the page steps through the whole answer: play (700 ms a step), pause, forward, back, and back to the start. The engine gives the active states of each step, not the edges, so the page works the taken edges out from the document (the transitions on the symbol read, from the states before, and the ε transitions that followed). Only the active states and the taken edges are drawn on the diagram (a filled state with a thick line, and an accent edge); no color is the only sign.
- **Jalankan is also Jeda.** While it plays the same button says "Jeda". Pressing it after a pause goes on from the same step; at the last step it starts again from the first.
- **The next-step button starts a run too.** With no run yet, "Langkah berikutnya" asks the engine and shows step one, and waits for the next press (it does not play). A student who types a string and presses it wants to go one step at a time; a disabled button gave no answer (found in the phone test of PR 50). Back and "Kembali ke awal" stay off until there is something to go back to.
- **A run is not part of the document or of the history.** Any change of the document, or of the text in the field, clears the run (and its timer). The text stays in the field. An answer of an older call is thrown away.
- **Calm.** A rejection is a neutral sentence with the reason ("Tidak ada state aktif yang accepting."), not an error. The verdict shows only at the last step, so a student cannot read the answer from the first step. The computation list shows the lines up to the current step (the last 50 when it is long). A symbol outside the alphabet, no start state, and a run that the budget stopped each have their own sentence.
- **Screen readers.** A live region (`aria-live`, not a second `role="status"`) says each step: "Membaca 0 (1 dari 2). State aktif: q1." and the verdict at the end.
- **The texts** (`run.*`, `sim.*`, `input.unknown_symbol`) are a draft with `TODO(review)` until the feedback guide (U4). A test reads the engine's keys from the Rust source, so a new key cannot be added without a text.

## Decisions made while building S6-3

- **The block "Uji banyak string"** sits in the side panel under the run: a row for each string (the string, a badge, a remove button of 44 px), then a field with "Tambah". The empty string is added with an empty field and shown as ε. Strings are trimmed at the ends (a phone keyboard adds a space); a string that is there already, or is too long, or one too many gets a calm sentence and stays in the field.
- **The results follow the machine.** One call to the engine (`simulateMany`, a loop in the worker handlers: no Rust change, one call for all the strings) runs the strings that have no answer yet. A change of the machine forgets every badge at once (it shows "Memeriksa…", never a badge for an older machine) and asks again 300 ms later; a new string is asked at once and alone. An answer for an older machine is thrown away.
- **Not "Ditolak" when it cannot run.** A string with a symbol that is not in the alphabet, a machine without a start state, and a run that the budget stopped have their own badge ("Tidak bisa dijalankan", "Dihentikan") and the same calm sentence as the run.
- **Saved with the machine** (the record, see ADR 0023), not in the undo history. Removing a row has no Urungkan: the list is small and cheap to type again.
- **The panel scrolls inside itself.** The canvas and the panel keep their size when the list grows (a test checks it).
- **The texts** (`test.*`) are a draft with `TODO(review)` until the feedback guide (U4).

## Decisions made while building X1

- **First run.** The first visit makes an empty machine and shows "Coba contoh" over the canvas (a sheet at the bottom on a phone): a card for each example (title, one line, DFSM or NDFSM), "Mulai dari kanvas kosong", the optional "Tur 1 menit", and "Tersimpan di perangkat ini. Tanpa akun, tanpa pelacakan." The card goes away for good, in that editor, when a state is added or the blank canvas is chosen, so it never covers the canvas of a student who deleted everything. It is not drawn over the bar.
- **One click opens an example** in the place of the empty machine (a new machine when the open one has any work), with its strings in "Uji banyak string". "Buka file .jff atau JSON" is not there yet (S10b), and the regex example comes with S7.
- **The "?" button** (44 px, in the bar, also on a phone) opens the tour at any time. The tour is five steps in a dialog: add states, connect with transitions and ε, mark start and accepting, run one string, test many strings. It links to Panduan.
- **Each step draws the control that it is about** (suggested in the phone test of PR 53): a picture of the real tool (its icon, its name and its key come from the same list as the tool bar, `tools.ts`), the key `M`, the double-click, the Jalankan and Langkah berikutnya buttons, or the field "Tambah string", and a sentence that says where it is (the tool bar is at the left of the canvas on a laptop and at the bottom on a phone; the panel is at the right or under the canvas). The pictures are not buttons and are hidden from screen readers; the text of the step names the same control in words, and a test requires that the text uses the name of the button. A ring on the real button was left for later (U5a will say whether it is needed): the tour is a modal dialog, and on a phone it would cover the tool bar.
- **Seen.** The tour is seen when it is closed in any way; the card then stops offering it, and "?" still opens it.
- **The run field trims the ends** of the string, as the list of test strings does (a phone keyboard likes to add a space after the last symbol).

## Decisions made while building S5-1

- **Tabs.** The side panel has three tabs: Simulasi (the run, the test strings and the checks), Tabel and Definisi (Konversi joins at S7). They follow the ARIA tabs pattern: one Tab stop, the arrows go round, Home and End go to the ends. The panel is named "Panel" for assistive technology; the old name "Simulasi" is now the first tab. A hidden heading "Panel" keeps the order of the headings. The last tab is remembered on the device (`webtomata.panel.tab`; blocked storage means Simulasi). Simulasi stays in the page when another tab is open, so what was typed in it is not lost. Tabel and Definisi are made when they open. Each tab starts where it was left (the first time at the top), so the scroll of one tab is not inherited by another. The tab bar stays in view; what is under it scrolls.
- **Definisi is read only.** It shows the tuple in the notation of Rich: M = (K, Σ, δ, s, A) for a DFSM and (K, Σ, Δ, s, A) for an NDFSM, the sets of states, symbols and accepting states, the start state (— when there is none), and each transition as δ(q, a) = p (or (q, a, p) ∈ Δ, with ε). "Salin" copies the same text, and says plainly when the browser refuses. The names of states are shown as text, never as markup. The letters of the tuple are message keys (`notation.*`), so that the notation switch of the roadmap can change them.
- **DFSM or NDFSM** is a switch of two radio buttons at the top of the Tabel and the Definisi tabs (not a chip in the bar: the phone bar is full). It is one undo step through `editor.apply`, it is announced, and a wrong choice only gives the calm remarks of the checks.
- **`editor.apply(command, note)`** runs any command of the document as one step of the one history, with an announcement and, if asked, a toast with Urungkan. It is how the table (S5-2) and the switch change the machine.
- **Undo from the panel** is by the Urungkan buttons; the keys Ctrl+Z and Ctrl+Y work on the canvas.

## Decisions made while building S5-2

- **The table is a grid and a way to build a machine.** A row for each state and a column for each symbol, and an ε column for an NDFSM (and for a DFSM only if it has an ε transition). The columns before the symbols are the name, Start and Terima. The first column stays when the table scrolls sideways, and the table scrolls inside the panel, never the page. It is made when its tab opens (the code is loaded then).
- **Cells.** In a DFSM a cell is a native picker of the states, so a finger gets the picker of the phone and a screen reader gets a normal control. An empty cell says "belum ada" in the calm warning colors (derived from the document, so it does not wait for the checks). In an NDFSM, and in the ε column, a cell holds a chip for each state, each with a button that removes it, and a picker "Tambah…". A DFSM that has two targets for one symbol (the diagram allows it, and the checks say so) shows both as chips with a note, so that the table is true.
- **One edit is one command, so it is one step of the one history.** Setting a cell removes what should not be there and adds what is missing, in one batch (`setCellTargets`). Start, Terima, rename, "+ State" (a new state to the right of the others, in the row of the last one) and "Tambah simbol" are single commands. All go through `editor.apply`, which says the result to a screen reader. A refusal of the document (a name that is taken, a bad symbol) is shown under the table and nothing changes.
- **Removing a symbol** (the × on its header, or Delete on the header cell) also removes the transitions that use it, as one step; the message says how many ("Simbol 0 dihapus, beserta 3 transisi.") and has Urungkan, like deleting a state.
- **Keyboard.** One cell of the table is a Tab stop (roving tabindex). The arrows move between cells and stop at the edge, Home and End go to the ends of the row, Ctrl with them to the first and the last cell. Enter or F2 edits the cell: the picker (or the name field) takes the focus, and Escape gives the focus back to the cell. Delete empties a cell, and removes the symbol on a header cell. Space or Enter on Start or Terima toggles it. Keys inside a picker or a field are the control's own.
- **The table and the diagram share the selection.** A row that gets the focus selects that state on the diagram, and a state selected on the diagram marks its row.
- **A machine without states** says "Belum ada state." and "+ State" starts it.

## The width of the panel (S5-2, suggested in the phone test of PR 59)

- **A laptop can pull the panel wider** by its left edge, for a student who likes to fill in the table. The handle is 24 px across, over the border; it shows an accent line when it is hovered, focused or held. It is a separator that can be moved (the "window splitter" pattern): a tab stop with `aria-valuenow`, `aria-valuemin` and `aria-valuemax` in rem. Left and Right change the width by 1 rem (4 rem with Shift), Home and End go to the limits, and a double click or double tap puts it back to 22 rem. The pointer is captured, so a drag never selects text or reaches the canvas.
- **Limits.** At least 22 rem (the width before), at most 60% of the window and 56 rem, and the canvas keeps at least 20 rem. A window that gets smaller brings a wide panel back inside the limits. The width is remembered on the device (`webtomata.panel.width`, in rem); a missing, blocked, bad or out of range value is the default or the nearest limit.
- **The canvas** only gets narrower or wider: its left edge stays, so the machine does not slide under the pointer.
- **A phone has no handle.** The panel is under the canvas with its share of the height, and the table scrolls sideways inside it with its first column fixed. A taller phone panel can come later.

## Auto layout (S9)

- **Where.** "Tata letak otomatis" is in the menu of the empty canvas (a right-click or a long-press; the item is there only when the machine has states), and, on a laptop, as a button in the bar. The phone bar is full, so there it is only in the menu.
- **What it does.** The states are placed left to right, the start state first, with room for the edges and their labels; loops are ignored and a pair with several symbols counts once. The result is one step of the history (a batch of moves) centered where the machine was, then the view fits the machine. A message "Tata letak otomatis selesai." has Urungkan.
- **How.** The graph goes to a worker that holds the library (dagre, see ADR 0026), which starts on the first press. The page is never busy, and the library is never in the first load.
- **When it cannot.** A machine of more than 400 states, a layout that takes more than 5 s, a worker that fails, and a machine that changed while it was laid out each say so in a calm sentence under the bar and change nothing.
- **The hint under the table** (S5-2) is three short lines, one for each key, so that it is easy to read (suggested in the phone test of PR 59).

## Tooltips and the auto layout button (suggested in the phone and laptop test of PR 60)

- **The rail on a laptop shows icons only, so a pointer that rests on an icon shows its name and its key** (for example "Tambah state S", "Urungkan Ctrl+Z"), to the right of the icon, after 300 ms. The keyboard focus shows it at once. It follows WCAG 1.4.13: the pointer can go onto the tooltip and it stays, and Escape dismisses it (it comes back when the pointer enters the rail again). It is hidden from screen readers (the buttons have their names), and it is not drawn on a phone, where the names are under the icons and there is no hover.
- **The button "Tata letak otomatis" in the bar is drawn 36 px high**, so that it does not touch the lines of the bar; its hit area is still 44 px (an invisible extension of 4 px above and below).

## The Konversi tab (S7-1, wireframes approved on 2026-10-26)

- **A fourth tab, Konversi,** after Definisi. It is loaded when it opens, and it stays in the page after that (like Simulasi), so a conversion that is under way is not lost when the student looks at the Tabel tab.
- **The list.** Three operations in S7-1: NDFSM → DFSM, Minimalkan DFSM and Tambah dead state. Each has a one-line hint and a Mulai button. An operation that does not fit the machine is shown with the reason in the place of the hint, and its button is disabled ("Mesin ini sudah DFSM.", "Hanya untuk DFSM. Ubah jenis mesin di tab Tabel, atau lakukan NDFSM → DFSM dulu.", "Tentukan start state dulu."). The reasons are in the order: no states, no start state, wrong type, too big. Minimize refuses a machine of more than 500 states with a calm sentence; the engine's own budget stays as the second guard.
- **The player.** One call to the engine, then the page steps through the trace: "Langkah n dari N", a sentence for the step (built from the engine's message key; state names are the names of the machine, and the states of a determinized machine are named by their sets, `{q0, q1}`, and `∅`), a table that grows with the steps, and the controls ⏮ ◀ Putar ▶ ⏭ (names for screen readers: Ke awal, Mundur, Putar/Jeda, Maju, Ke hasil). Putar goes one step each 0.8 s and stops at the end. The focus goes to the heading of the player when it starts.
- **The canvas** shows the machine as it is built at the step, read-only and fitted, with the state that the step is about lit. While the result has no state yet (the ε-closures, or the classes of a minimization) it shows the machine we started from with the states of the step lit. "Hasil" and "Sumber" switch the canvas between the two. The editor stays under the canvas with its camera and its selection. The positions are those of an auto layout of the finished result (the same at every step, so that nothing moves while it grows); a machine that gets a dead state keeps its places and puts the new state below.
- **The tables.** ε-closures (one row each), the classes now (the examined class is marked), and the transition table of the result as it is built (the row of the step is marked with `aria-current`). A table that is wider than the panel scrolls inside itself and can be reached with the keyboard.
- **At the last step** the player offers "Buka sebagai mesin baru" and "Tutup". The result opens as a machine of its own (saved on the device, in "Mesin saya") with the title "DFSM dari …", "Minimal dari …" or "Lengkap dari …". The machine of the student is never changed. Tutup goes back to the list.
- **A change of the machine closes the player,** because its steps would be old (the machine is compared with the one the conversion started from).
- **When the engine cannot.** A stop of the budget, a machine that the engine calls invalid, and an engine that does not answer each say so in one calm sentence in the list; nothing is lost.

## Complement and union in the Konversi tab (S7-2a, picker approved on 2026-10-27)

- **Two more rows in the list:** Komplemen and Gabungan. Komplemen is for a complete DFSM; for a DFSM with a missing transition the row says "Mesin belum lengkap. Lengkapi dulu dengan Tambah dead state.", and for an NDFSM "Hanya untuk DFSM.".
- **Komplemen** steps through the states, one step each: "q1 tidak lagi menjadi accepting state" or "q0 menjadi accepting state". The machine keeps its places (the result is the same drawing with other accepting states), and the table has a column Terima that marks the accepting states as they change. The same column is in the table of the other operations.
- **Gabungan** takes a second machine from a list in its row ("Gabungkan dengan", a native select, 44 px high). The list holds the other saved machines. A machine that does not fit is shown and disabled with the reason after a dash ("alfabetnya beda", "belum punya start state", "tidak bisa dibuka"). With no other machine the row says "Simpan atau buat mesin lain dulu; daftarnya ada di Mesin saya." The button waits for a machine that fits. The second machine is read again when Mulai is pressed; if it is gone, a calm sentence says so.
- **The steps of a union:** copy the first machine, copy the second, add the new start state, and one ε-transition to each start state (5 steps). The states are named by their machine (`1.q0`, `2.q0`), and the new start state `s`, so that two machines with the same names stay apart. "Sumber" shows the machine that the step copies (the second machine for step 2). The result is an NDFSM, laid out by auto layout, and opens as "Gabungan A dan B".

- **Two short messages (suggested in the phone test of PR 62).** "Konversi sedang berlangsung…" shows in the list from the press of Mulai until the player opens (it is quick on a laptop and can be seen on a slow phone). "Konversi selesai!" shows in the player for two seconds each time the last step is reached, by Putar, by a step or by Ke hasil, and again after a step back and forward; a conversion of one step shows it at once. Both are live regions, so a screen reader says them.

## The height of the panel on a phone (suggested in the phone test of PR 62)

- **The bar at the top of the panel is dragged.** A finger that drags it up makes the panel taller, so that more of the Konversi list or of the table can be seen; a drag down makes it shorter. A finger that moves less than 8 px is a tap, and a tap still shows or hides the panel, as before. A drag up on a hidden panel shows it first.
- **Limits.** At least 30% of the editor, and at most 80%; 15 rem always stay for the canvas (7 rem), the bar over it and the tools under the panel, so on most phones the limit is about 65 to 73%. A phone that is turned or a window that gets lower brings the height back inside the limits.
- **Remembered.** The height is a share of the editor and is kept on the device (`webtomata.panel.height`); a missing, blocked or bad value is 40%.
- **Keys.** With the bar focused, Up and Down change the height by 5 points, Home goes to the smallest and End to the largest; Enter and Space still show or hide. This is an extra for a hardware keyboard; the named button stays "Sembunyikan panel" / "Tampilkan panel".
- **No double tap.** A double tap to go back to 40% was in the plan. It cannot work: the first tap hides the panel and the bar moves away, so the second tap does not land on it. A drag back is as easy.
- **The tabs** (suggested in the same test): the four tab names use the small text size and a small padding so that they share one line in the narrowest panel (22 rem) in both languages; a phone of 320 px wraps them onto a second line instead of running out of the panel.

## Intersection in the Konversi tab (S7-2b, wireframe approved on 2026-10-27)

- **A row "Irisan"** with the same second-machine list as Gabungan ("Irisan dengan"). The play button is named Irisan. The result opens as "Irisan A dan B".
- **Seven stages** (Rich's De Morgan route): make the first machine a complete DFSM, its complement, the same for the second machine, the union of the two complements, make the union a complete DFSM, and its complement, which is the intersection. Each stage is the operation that the engine already has (determinize, complement or union), shown with its own sentences, table and canvas.
- **The stage line and the chips.** "Tahap n dari 7 · name of the stage" is over a row of seven chips (44 px, they wrap on a narrow panel). A chip jumps to the first step of its stage; the open stage is marked (`aria-current=step`). A stage that has nothing to do (a machine that already is a complete DFSM) is kept, greyed and disabled, and its name for screen readers says "Tahap 1 dilewati: …. Tidak ada yang perlu dikerjakan." The player starts at the first stage that has steps.
- **The steps** are counted inside the stage ("Langkah n dari N di tahap ini"). The play button goes on across the stages, "Ke hasil" goes to the end of stage 7, and a step back at the start of a stage goes to the last step of the stage before it. "Konversi selesai!" shows at the end of stage 7.
- **Names and places** go from stage to stage: a state keeps its name through a complement; the "make complete" stages name the states by their sets (`{q0, q1}`); the union names them by machine (`1.…`, `2.…`, `s`); a name that would be longer than 32 characters becomes `S<id>`. A complement keeps the places of its source; a determinize and a union get an auto layout.
- **The engine tells what each stage starts from.** The marker of each stage carries the machine or the two machines that the stage starts from (a change to the engine in the same PR), so the page never has to guess the stage order or the "already complete" rule.

## XOR in the Konversi tab (S7-2c, approved on 2026-10-27)

- **A row "XOR"** with the same second-machine list as Gabungan and Irisan ("XOR dengan"); the hint says "Selisih simetris: string yang diterima tepat satu mesin." The play button is named XOR. The result opens as "XOR A dan B".
- **Three stages, in the stage view of the intersection** (the line "Tahap n dari 3" and three chips): make the first machine a complete DFSM, make the second one, and the product machine. A machine that already is a complete DFSM skips its stage, and the chip stays, greyed, with the reason. Any NDFSM is allowed.
- **The product** follows the cross-product machine of Rich's closure proofs. A state is a pair `(p, q)` of a state of each machine, named so on the canvas and in the table (a name longer than 32 characters becomes `S<id>`); only the pairs that some string reaches are built, in the order they are found, like the subset construction, and the sentence of the first step says so by showing the pairs as they appear. A pair accepts when exactly one of its two states accepts: the sentence of the step says which side ("hanya mesin pertama yang menerima"), and the table has the Terima column.
- **When the result accepts nothing**, a short line under the step count says "Hasilnya tidak menerima string apa pun: kedua mesin ekuivalen." This is the test of equivalence of Rich's chapter 9 (two machines are equivalent exactly when their XOR accepts nothing). It shows at the last step.
- **The engine** returns the stage markers with their input machines, a `pair` step for each pair, then start, transitions and accepting steps; the page does not repeat the method.

## Regular expressions in the Konversi tab (S7-3, approved on 2026-10-27)

S7-3 is three pull requests: Mesin → regex (A), Regex → NDFSM (B) and Sederhanakan (C). The list has a second group under the first one, headed "Ekspresi reguler".

- **Mesin → regex (S7-3a).** One row, for any machine that has a start state (DFSM or NDFSM). The player has the step count, the sentence of the step, the table of labels, and the same five buttons as the other players (`PlayerControls`). The table "Label: ekspresi untuk jalur antar state" has the columns Dari, Ke and Label. It appears at the step where the engine makes it (after the new start and accepting states, if any), and the rows that a step changes are marked. The canvas shows the machine of the student (it is not changed), with the state that is removed lit. A new start or accepting state is not drawn: the sentence names it `s` or `f` (`s_2`, `f_2` when the machine has a state with that name).
- **The result is text.** At the last step the player shows the expression in a block under the buttons (it scrolls and can be reached with the keyboard), a note that the notation is Rich's (`∪`, `ε`, `∅`), and a "Salin" button. If the browser refuses to copy, the line says so and asks the student to select the text. There is no "Buka sebagai mesin baru": the result is not a machine.
- **The limit.** The web budget stops a label at 500 parts. The list then says "Ekspresinya jadi terlalu besar, jadi perhitungan dihentikan." and offers "Naikkan batas", which runs again with 2,000 (the E13 decision). A second stop has no button.
