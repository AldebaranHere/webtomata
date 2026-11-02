# Workstation switcher: as built

Status: **as-built spec**, written on 2026-11-02 from `web/src/lib/components/WorkstationSwitcher.svelte` and `web/src/routes/sandbox/+page.svelte`. It describes what exists. It is not a redesign. The owner approves it by merging the PR.

## What it is
A button under the site header on the page `/sandbox`, in a strip called `mode-bar` (white, with a hairline under it). It reads "Mode Kerja: **Tata Bahasa (CFG & CNF)** ▾". It opens a **popover** that lists the workstations in groups. The choice is kept in the address (`?mode=language` or `?mode=grammar`; the FSM editor has no parameter) and in `localStorage` (`webtomata_sandbox_mode`).

## The popover

| Group | Items |
|---|---|
| Otomata & Mesin | **Mesin FSM** (the editor), **Otomata Pushdown (PDA)** (disabled, badge "Segera Hadir"), **Mesin Turing (TM)** (disabled, badge "Segera Hadir") |
| Bahasa & Teori Formal | Bahasa & Enumerasi |
| Tata Bahasa (Grammar) | Tata Bahasa (CFG & CNF) |

- The group names are small headers. The chosen item has a check mark and a selected style.
- The disabled items are `aria-disabled` and cannot be reached with the arrow keys.

## Behavior and accessibility
- The trigger has `aria-haspopup="listbox"` and `aria-expanded`. The popover is `role="listbox"`, each group is `role="group"` with a label, and each item is `role="option"` with `aria-selected`.
- Opening moves focus to the selected item. ArrowDown and ArrowUp move through the enabled items and wrap around. Escape closes and returns focus to the trigger. A pointer press outside closes it.
- Choosing an item closes the popover, returns focus to the trigger, and loads the workstation (the FSM editor, or the grammar or language workstation, loaded on demand).
- The items are at least 44 px high.

## Phone (640 px or narrower)
The strip has a smaller padding. The trigger and the popover keep the same form. The pictures of 2026-11-02 show the trigger fits in one row on a 360 px phone.

## Notes for the future
- PDA and Turing machine are already in the list as disabled items. When they are built (tasks T-030 to T-048), they replace the badge. A fourth group is not needed.
- The list is hard-coded in the component. A new workstation needs a new message key for its name in both languages.
