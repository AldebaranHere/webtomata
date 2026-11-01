# Verification output

## Format
```
pnpm.exe : $ pnpm --filter web format:check && cargo fmt --check
At C:\Users\admin\AppData\Roaming\npm\pnpm.ps1:14 char:3
+   & "$basedir/node_modules/pnpm/pnpm.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ pnpm --filter...rgo fmt --check:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!

```

## Typecheck
```
pnpm.exe : Error: ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL
At C:\Users\admin\AppData\Roaming\npm\pnpm.ps1:14 char:3
+   & "$basedir/node_modules/pnpm/pnpm.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Error: ERR_PNPM...EXEC_FIRST_FAIL:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 

  ├ù "pnpm recursive exec" failed in D:\dev\webtomata\web


```

## Lint
```
pnpm.exe : $ eslint .
At C:\Users\admin\AppData\Roaming\npm\pnpm.ps1:14 char:3
+   & "$basedir/node_modules/pnpm/pnpm.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ eslint .:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 

```

## Unit tests
```
pnpm.exe : $ vitest run
At C:\Users\admin\AppData\Roaming\npm\pnpm.ps1:14 char:3
+   & "$basedir/node_modules/pnpm/pnpm.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ vitest run:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 

[1m[30m[46m RUN [49m[39m[22m [36mv5.0.3 [39m[90mD:/dev/webtomata/web[39m

 [32mÔ£ô[39m src/lib/editor/conversion.wasm.test.ts [2m([22m[2m49 tests[22m[2m)[22m[33m 599[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/compare.wasm.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 534[2mms[22m[39m
   [32mÔ£ô[39m Bandingkan with the real engine [2m(6)[22m
     [33m[2mÔ£ô[22m[39m is right for random machines and random expressions: the verdict, the witness and both lists[33m 419[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/editor.test.ts [2m([22m[2m41 tests[22m[2m)[22m[33m 611[2mms[22m[39m
   [32mÔ£ô[39m add a state [2m(7)[22m
     [33m[2mÔ£ô[22m[39m says why when the document refuses (the limit of states)[33m 545[2mms[22m[39m
 [32mÔ£ô[39m src/lib/share/link.test.ts [2m([22m[2m15 tests[22m[2m)[22m[33m 896[2mms[22m[39m
   [32mÔ£ô[39m a link that would expand to something huge is stopped while it is read [2m(2)[22m
     [33m[2mÔ£ô[22m[39m refuses a small link that inflates to far more than a document may hold[32m 300[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/diagram/geometry.test.ts [2m([22m[2m37 tests[22m[2m)[22m[33m 894[2mms[22m[39m
   [32mÔ£ô[39m the whole drawing [2m(7)[22m
     [33m[2mÔ£ô[22m[39m draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured)[33m 553[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/check.wasm.test.ts [2m([22m[2m27 tests[22m[2m)[22m[33m 482[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/document.test.ts [2m([22m[2m32 tests[22m[2m)[22m[32m 113[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-compile.wasm.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 125[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/commands.test.ts [2m([22m[2m26 tests[22m[2m)[22m[33m 328[2mms[22m[39m
   [32mÔ£ô[39m states [2m(10)[22m
     [33m[2mÔ£ô[22m[39m refuses the 2001st state[33m 312[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-simplify.wasm.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 221[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/load.test.ts [2m([22m[2m32 tests[22m[2m)[22m[33m 420[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-conversion.wasm.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 93[2mms[22m[39m
 [32mÔ£ô[39m src/lib/share/files.wasm.test.ts [2m([22m[2m6 tests[22m[2m | [22m[33m1 skipped[39m[2m)[22m[32m 102[2mms[22m[39m
 [32mÔ£ô[39m src/lib/i18n/i18n.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/grade.wasm.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 257[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/table.test.ts [2m([22m[2m22 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/run.wasm.test.ts [2m([22m[2m29 tests[22m[2m)[22m[32m 175[2mms[22m[39m
 [32mÔ£ô[39m src/lib/engine/handlers.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 63[2mms[22m[39m
 [32mÔ£ô[39m src/lib/guides/load.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 42[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/editor.link.test.ts [2m([22m[2m19 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/history.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/autosave.tests-field.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 47[2mms[22m[39m
 [32mÔ£ô[39m src/lib/engine/client.test.ts [2m([22m[2m30 tests[22m[2m)[22m[32m 30[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/history.property.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 1656[2mms[22m[39m
   [32mÔ£ô[39m random sequences of commands [2m(6)[22m
     [33m[2mÔ£ô[22m[39m keep every rule of the document after every step, and a refused command changes nothing[33m 306[2mms[22m[39m
     [33m[2mÔ£ô[22m[39m a random walk of undo and redo always shows the document that was recorded for that step[33m 630[2mms[22m[39m
   [32mÔ£ô[39m speed [2m(1)[22m
     [33m[2mÔ£ô[22m[39m moves a state of a document with 2,000 states 300 times in well under a second[33m 458[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/editor.states.test.ts [2m([22m[2m17 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/library.test.ts [2m([22m[2m21 tests[22m[2m)[22m[32m 33[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/summaries.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 138[2mms[22m[39m
 [32mÔ£ô[39m src/lib/share/image.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/tester.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/example.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/autosave.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 24[2mms[22m[39m
 [32mÔ£ô[39m src/lib/share/files.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/keys.test.ts [2m([22m[2m49 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÔ£ô[39m src/lib/share/open-file.wasm.test.ts [2m([22m[2m8 tests[22m[2m | [22m[33m1 skipped[39m[2m)[22m[32m 19[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/machines.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/grade.test.ts [2m([22m[2m20 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32mÔ£ô[39m src/lib/share/open-file.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/camera.test.ts [2m([22m[2m25 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/autosave.progress.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/progress.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/editor.edges.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/conversion-text.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/question.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 39[2mms[22m[39m
 [32mÔ£ô[39m src/lib/examples/examples.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-compile.test.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/editor.apply.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/machine.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/layout-client.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/tests-field.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/question-work.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/selection.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/answer.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 43[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/run-text.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/statement.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-conversion.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/checks.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/feedback-text.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/checker.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 18[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/migrate.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/examples/examples.wasm.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/panel-height.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/test-list.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/canvas.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/panel-tab.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/tour.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-math.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/regex-simplify.test.ts [2m([22m[2m12 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/label.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/guides/list.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/compare.test.ts [2m([22m[2m11 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/list.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/seo.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/menu.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 1[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/placement.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/statement-fold.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32mÔ£ô[39m src/lib/language/language-math.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/memory.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/table-grid.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/panel-width.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32mÔ£ô[39m src/lib/questions/feedback-view.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/definition.test.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 3[2mms[22m[39m
 [32mÔ£ô[39m src/lib/engine/problem.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 2[2mms[22m[39m
 [32mÔ£ô[39m src/lib/storage/titles.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 1[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/document.wasm.test.ts [2m([22m[2m10 tests[22m[2m)[22m[33m 2456[2mms[22m[39m
   [32mÔ£ô[39m the rules for symbols are the rules of the engine [2m(3)[22m
     [33m[2mÔ£ô[22m[39m agree on every character of the Basic Multilingual Plane[33m 1898[2mms[22m[39m
   [32mÔ£ô[39m a document becomes a machine that the engine accepts [2m(5)[22m
     [33m[2mÔ£ô[22m[39m is accepted at the limits of the engine[33m 360[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/layout.test.ts [2m([22m[2m16 tests[22m[2m)[22m[33m 2428[2mms[22m[39m
   [32mÔ£ô[39m placing the states [2m(10)[22m
     [33m[2mÔ£ô[22m[39m property: any machine of up to 40 states is placed inside the limits with no overlap[33m 2307[2mms[22m[39m
 [32mÔ£ô[39m src/lib/editor/interaction/editor.property.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 2470[2mms[22m[39m
   [32mÔ£ô[39m random sequences of actions in the editor [2m(4)[22m
     [33m[2mÔ£ô[22m[39m keep every rule after every step[33m 2385[2mms[22m[39m
 [32mÔ£ô[39m src/lib/lint.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 2729[2mms[22m[39m
   [32mÔ£ô[39m the lint rule for {@html} [2m(2)[22m
     [33m[2mÔ£ô[22m[39m refuses a component that shows text as markup[33m 2711[2mms[22m[39m

[2m Test Files [22m [1m[32m87 passed[39m[22m[90m (87)[39m
[2m      Tests [22m [1m[32m1117 passed[39m[22m[2m | [22m[33m2 skipped[39m[90m (1119)[39m
[2m   Start at [22m 12:09:56
[2m   Duration [22m 3.59s[2m (tests 65%, transform 22%, import 12%)[22m


```

## Build
```
pnpm.exe : $ vite build
At C:\Users\admin\AppData\Roaming\npm\pnpm.ps1:14 char:3
+   & "$basedir/node_modules/pnpm/pnpm.exe"   $args
+   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ vite build:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
[36mvite v8.3.4 [32mbuilding ssr environment for production...[36m[39m
transforming...
Ô£ô 322 modules transformed.
rendering chunks...
computing gzip size...
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-greek-400-normal.C190GLew.woff2       4.22 kB
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-greek-600-normal.H7WoG9Et.woff2       4.30 kB
.svelte-kit/output/server/_app/immutable/assets/plus-jakarta-sans-latin-400-normal.Dhut76fR.woff2   11.81 kB
.svelte-kit/output/server/_app/immutable/assets/plus-jakarta-sans-latin-600-normal.DLTa1BUW.woff2   12.18 kB
.svelte-kit/output/server/.vite/manifest.json                                                       15.70 kB Ôöé gzip:  1.83 kB
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-latin-400-normal.V6pRDFza.woff2      21.16 kB
.svelte-kit/output/server/_app/immutable/assets/jetbrains-mono-latin-600-normal.C8RAYTDA.woff2      21.86 kB
.svelte-kit/output/server/_app/immutable/assets/problem.DP-X_MrA.css                                 0.62 kB Ôöé gzip:  0.29 kB
.svelte-kit/output/server/_app/immutable/assets/_page.D2I1JaFn.css                                   1.14 kB Ôöé gzip:  0.41 kB
.svelte-kit/output/server/_app/immutable/assets/_page.Bj9Ti1Q1.css                                   1.21 kB Ôöé gzip:  0.39 kB
.svelte-kit/output/server/_app/immutable/assets/ShareDialog.uXp6zjwI.css                             2.68 kB Ôöé gzip:  0.82 kB
.svelte-kit/output/server/_app/immutable/assets/DiagramDrawing.DWl0Vyju.css                          2.71 kB Ôöé gzip:  0.63 kB
.svelte-kit/output/server/_app/immutable/assets/_page.eTCs7hbJ.css                                   3.50 kB Ôöé gzip:  0.87 kB
.svelte-kit/output/server/_app/immutable/assets/_page.DNIhdgjq.css                                   3.81 kB Ôöé gzip:  1.01 kB
.svelte-kit/output/server/_app/immutable/assets/_page.D7oFu7y0.css                                   4.42 kB Ôöé gzip:  0.98 kB
.svelte-kit/output/server/_app/immutable/assets/TourDialog._Uh7tub6.css                              4.61 kB Ôöé gzip:  1.03 kB
.svelte-kit/output/server/_app/immutable/assets/_page.Dbpd2WAk.css                                   5.93 kB Ôöé gzip:  1.32 kB
.svelte-kit/output/server/_app/immutable/assets/_page.D_YFoG2s.css                                   6.97 kB Ôöé gzip:  1.29 kB
.svelte-kit/output/server/_app/immutable/assets/_layout.BqgOgyhY.css                                 7.45 kB Ôöé gzip:  2.07 kB
.svelte-kit/output/server/_app/immutable/assets/Editor.CpZQ0Eo8.css                                 30.16 kB Ôöé gzip:  4.47 kB
.svelte-kit/output/server/chunks/paths.js                                                            0.03 kB Ôöé gzip:  0.05 kB
.svelte-kit/output/server/entries/pages/_layout.ts.js                                                0.12 kB Ôöé gzip:  0.12 kB Ôöé map:   0.18 kB
.svelte-kit/output/server/chunks/server.js                                                           0.22 kB Ôöé gzip:  0.15 kB Ôöé map:   0.64 kB
.svelte-kit/output/server/env.js                                                                     0.31 kB Ôöé gzip:  0.19 kB Ôöé map:   0.57 kB
.svelte-kit/output/server/entries/hooks.server.js                                                    0.33 kB Ôöé gzip:  0.23 kB Ôöé map:   1.03 kB
.svelte-kit/output/server/chunks/titles.js                                                           0.35 kB Ôöé gzip:  0.23 kB Ôöé map:   0.91 kB
.svelte-kit/output/server/entries/pages/soal/_page.server.ts.js                                      0.37 kB Ôöé gzip:  0.24 kB Ôöé map:   0.91 kB
.svelte-kit/output/server/chunks/index-server.js                                                     0.50 kB Ôöé gzip:  0.31 kB Ôöé map:   1.70 kB
.svelte-kit/output/server/entries/fallbacks/error.svelte.js                                          0.53 kB Ôöé gzip:  0.34 kB Ôöé map:   0.54 kB
.svelte-kit/output/server/entries/pages/panduan/_page.server.ts.js                                   0.53 kB Ôöé gzip:  0.28 kB Ôöé map:   0.97 kB
.svelte-kit/output/server/entries/endpoints/sitemap.xml/_server.ts.js                                0.64 kB Ôöé gzip:  0.38 kB Ôöé map:   1.07 kB
.svelte-kit/output/server/chunks/navigation.js                                                       0.67 kB Ôöé gzip:  0.33 kB Ôöé map:   1.27 kB
.svelte-kit/output/server/entries/pages/panduan/_id_/_page.server.ts.js                              0.77 kB Ôöé gzip:  0.40 kB Ôöé map:   1.26 kB
.svelte-kit/output/server/chunks/state.js                                                            0.84 kB Ôöé gzip:  0.37 kB Ôöé map:   2.30 kB
.svelte-kit/output/server/entries/pages/soal/_id_/_page.server.ts.js                                 1.00 kB Ôöé gzip:  0.49 kB Ôöé map:   1.97 kB
.svelte-kit/output/server/chunks/seo.js                                                              1.01 kB Ôöé gzip:  0.61 kB Ôöé map:   1.82 kB
.svelte-kit/output/server/entries/endpoints/soal/_id_/jawaban.json/_server.ts.js                     1.05 kB Ôöé gzip:  0.54 kB Ôöé map:   4.63 kB
.svelte-kit/output/server/chunks/progress.js                                                         2.14 kB Ôöé gzip:  0.93 kB Ôöé map:  10.24 kB
.svelte-kit/output/server/chunks/list2.js                                                            2.38 kB Ôöé gzip:  0.94 kB Ôöé map:   5.57 kB
.svelte-kit/output/server/index.js                                                                   2.38 kB Ôöé gzip:  0.97 kB Ôöé map:   3.41 kB
.svelte-kit/output/server/entries/pages/_page.svelte.js                                              2.82 kB Ôöé gzip:  1.01 kB Ôöé map:   4.78 kB
.svelte-kit/output/server/chunks/list.js                                                             2.88 kB Ôöé gzip:  1.20 kB Ôöé map:   5.92 kB
.svelte-kit/output/server/entries/pages/tentang/_page.svelte.js                                      3.19 kB Ôöé gzip:  0.83 kB Ôöé map:   5.23 kB
.svelte-kit/output/server/chunks/storage.js                                                          3.39 kB Ôöé gzip:  1.29 kB Ôöé map:   7.95 kB
.svelte-kit/output/server/chunks/ShareDialog.js                                                      3.74 kB Ôöé gzip:  1.22 kB Ôöé map:  15.85 kB
.svelte-kit/output/server/chunks/TourDialog.js                                                       4.68 kB Ôöé gzip:  1.35 kB Ôöé map:  12.53 kB
.svelte-kit/output/server/entries/pages/_layout.svelte.js                                            4.89 kB Ôöé gzip:  1.46 kB Ôöé map:  11.34 kB
.svelte-kit/output/server/entries/pages/panduan/_page.svelte.js                                      4.91 kB Ôöé gzip:  1.54 kB Ôöé map:  10.57 kB
.svelte-kit/output/server/entries/pages/sandbox/_page.svelte.js                                      7.24 kB Ôöé gzip:  2.14 kB Ôöé map:  25.73 kB
.svelte-kit/output/server/chunks/problem.js                                                          7.80 kB Ôöé gzip:  2.94 kB Ôöé map:  19.64 kB
.svelte-kit/output/server/entries/pages/soal/_page.svelte.js                                         7.91 kB Ôöé gzip:  2.12 kB Ôöé map:  20.32 kB
.svelte-kit/output/server/entries/pages/soal/_id_/_page.svelte.js                                    9.69 kB Ôöé gzip:  2.82 kB Ôöé map:  30.77 kB
.svelte-kit/output/server/entries/pages/panduan/_id_/_page.svelte.js                                11.41 kB Ôöé gzip:  2.74 kB Ôöé map:  22.09 kB
.svelte-kit/output/server/chunks/link.js                                                            13.49 kB Ôöé gzip:  4.49 kB Ôöé map:  25.77 kB
.svelte-kit/output/server/chunks/library.svelte.js                                                  18.50 kB Ôöé gzip:  5.34 kB Ôöé map:  45.74 kB
.svelte-kit/output/server/chunks/uneval.js                                                          19.42 kB Ôöé gzip:  5.37 kB Ôöé map:  40.87 kB
.svelte-kit/output/server/chunks/guides.js                                                          19.50 kB Ôöé gzip:  6.27 kB Ôöé map:  34.65 kB
.svelte-kit/output/server/chunks/test-list.js                                                       21.77 kB Ôöé gzip:  6.03 kB Ôöé map:  50.68 kB
.svelte-kit/output/server/chunks/DiagramDrawing.js                                                  22.22 kB Ôöé gzip:  6.98 kB Ôöé map:  47.66 kB
.svelte-kit/output/server/chunks/server-errors.js                                                   24.17 kB Ôöé gzip:  4.57 kB Ôöé map:  34.90 kB
.svelte-kit/output/server/chunks/questions.js                                                       27.52 kB Ôöé gzip:  7.58 kB Ôöé map:  30.36 kB
.svelte-kit/output/server/chunks/server2.js                                                         46.65 kB Ôöé gzip: 12.67 kB Ôöé map: 128.50 kB
.svelte-kit/output/server/remote-entry.js                                                           54.98 kB Ôöé gzip: 11.89 kB Ôöé map:  90.36 kB
.svelte-kit/output/server/chunks/Editor.js                                                          99.05 kB Ôöé gzip: 24.60 kB Ôöé map: 301.42 kB
.svelte-kit/output/server/chunks/index.svelte.js                                                   106.34 kB Ôöé gzip: 28.80 kB Ôöé map: 136.12 kB
.svelte-kit/output/server/chunks/internal.js                                                       113.56 kB Ôöé gzip: 29.94 kB Ôöé map: 242.10 kB
.svelte-kit/output/server/chunks/instance.js                                                       129.58 kB Ôöé gzip: 34.78 kB Ôöé map: 258.32 kB

[32mÔ£ô built in 1.00s[39m
Analysing routes
Building app
[36mvite v8.3.4 [32mbuilding client environment for production...[36m[39m
transforming...
Ô£ô 387 modules transformed.
rendering chunks...
computing gzip size...
.svelte-kit/output/client/_app/version.json                                                          0.02 kB Ôöé gzip:   0.04 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-greek-400-normal.C190GLew.woff2       4.22 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-greek-600-normal.H7WoG9Et.woff2       4.30 kB
.svelte-kit/output/client/_app/immutable/assets/plus-jakarta-sans-latin-400-normal.Dhut76fR.woff2   11.81 kB
.svelte-kit/output/client/_app/immutable/assets/plus-jakarta-sans-latin-600-normal.DLTa1BUW.woff2   12.18 kB
.svelte-kit/output/client/_app/immutable/workers/worker-DQBpx1_O.js                                 13.24 kB
.svelte-kit/output/client/.vite/manifest.json                                                       17.30 kB Ôöé gzip:   2.12 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-latin-400-normal.V6pRDFza.woff2      21.16 kB
.svelte-kit/output/client/_app/immutable/assets/jetbrains-mono-latin-600-normal.C8RAYTDA.woff2      21.86 kB
.svelte-kit/output/client/_app/immutable/workers/layout.worker-DvXNapDG.js                          47.23 kB
.svelte-kit/output/client/_app/immutable/workers/assets/engine_wasm_bg-BpMQzz4d.wasm               492.31 kB Ôöé gzip: 210.80 kB
.svelte-kit/output/client/_app/immutable/assets/problem.DP-X_MrA.css                                 0.62 kB Ôöé gzip:   0.29 kB
.svelte-kit/output/client/_app/immutable/assets/2.D2I1JaFn.css                                       1.14 kB Ôöé gzip:   0.41 kB
.svelte-kit/output/client/_app/immutable/assets/8.Bj9Ti1Q1.css                                       1.21 kB Ôöé gzip:   0.39 kB
.svelte-kit/output/client/_app/immutable/assets/ShareDialog.uXp6zjwI.css                             2.68 kB Ôöé gzip:   0.82 kB
.svelte-kit/output/client/_app/immutable/assets/DiagramDrawing.DWl0Vyju.css                          2.71 kB Ôöé gzip:   0.63 kB
.svelte-kit/output/client/_app/immutable/assets/3.eTCs7hbJ.css                                       3.50 kB Ôöé gzip:   0.87 kB
.svelte-kit/output/client/_app/immutable/assets/5.DNIhdgjq.css                                       3.81 kB Ôöé gzip:   1.01 kB
.svelte-kit/output/client/_app/immutable/assets/TableView.xpL8CO50.css                               4.61 kB Ôöé gzip:   1.00 kB
.svelte-kit/output/client/_app/immutable/assets/TourDialog._Uh7tub6.css                              4.61 kB Ôöé gzip:   1.03 kB
.svelte-kit/output/client/_app/immutable/assets/LibraryDialog.BY6b98Gg.css                           4.82 kB Ôöé gzip:   1.19 kB
.svelte-kit/output/client/_app/immutable/assets/6.Dbpd2WAk.css                                       5.93 kB Ôöé gzip:   1.32 kB
.svelte-kit/output/client/_app/immutable/assets/4.D_YFoG2s.css                                       6.97 kB Ôöé gzip:   1.29 kB
.svelte-kit/output/client/_app/immutable/assets/7.CkhJ12Zs.css                                       7.35 kB Ôöé gzip:   1.29 kB
.svelte-kit/output/client/_app/immutable/assets/0.BqgOgyhY.css                                       7.45 kB Ôöé gzip:   2.07 kB
.svelte-kit/output/client/_app/immutable/assets/LanguageWorkstation.CYWMbSV9.css                    12.21 kB Ôöé gzip:   2.10 kB
.svelte-kit/output/client/_app/immutable/assets/ConversionPanel.D6_GpYE9.css                        15.05 kB Ôöé gzip:   1.91 kB
.svelte-kit/output/client/_app/immutable/assets/GrammarWorkstation.m8CAIXK2.css                     21.56 kB Ôöé gzip:   3.26 kB
.svelte-kit/output/client/_app/immutable/assets/Editor.DJcVKrUx.css                                 30.42 kB Ôöé gzip:   4.51 kB
.svelte-kit/output/client/_app/immutable/chunks/BPVwp-J3.js                                          0.02 kB Ôöé gzip:   0.04 kB
.svelte-kit/output/client/_app/immutable/chunks/DIgHpIFL.js                                          0.02 kB Ôöé gzip:   0.04 kB
.svelte-kit/output/client/_app/immutable/chunks/BxQG6IBk.js                                          0.05 kB Ôöé gzip:   0.06 kB
.svelte-kit/output/client/_app/immutable/entry/payload.DSmR2FwN.js                                   0.06 kB Ôöé gzip:   0.07 kB
.svelte-kit/output/client/_app/immutable/chunks/CZonfyO3.js                                          0.08 kB Ôöé gzip:   0.09 kB
.svelte-kit/output/client/_app/immutable/chunks/DK3Fl9T5.js                                          0.15 kB Ôöé gzip:   0.15 kB
.svelte-kit/output/client/_app/immutable/nodes/1.CTRrEFOJ.js                                         0.35 kB Ôöé gzip:   0.25 kB
.svelte-kit/output/client/_app/immutable/entry/start.rxJlbQJO.js                                     0.57 kB Ôöé gzip:   0.32 kB
.svelte-kit/output/client/_app/immutable/chunks/Ihgk-fnS.js                                          0.94 kB Ôöé gzip:   0.54 kB
.svelte-kit/output/client/_app/immutable/chunks/D1tszMii.js                                          0.95 kB Ôöé gzip:   0.63 kB
.svelte-kit/output/client/_app/immutable/chunks/Bjy-W4x2.js                                          1.36 kB Ôöé gzip:   0.65 kB
.svelte-kit/output/client/_app/immutable/chunks/CRzLMJPS.js                                          1.53 kB Ôöé gzip:   0.80 kB
.svelte-kit/output/client/_app/immutable/chunks/BvEIQBIe.js                                          1.60 kB Ôöé gzip:   0.70 kB
.svelte-kit/output/client/_app/immutable/chunks/ChayO4h9.js                                          2.11 kB Ôöé gzip:   0.99 kB
.svelte-kit/output/client/_app/immutable/chunks/D0H5LO5n.js                                          2.12 kB Ôöé gzip:   1.03 kB
.svelte-kit/output/client/_app/immutable/nodes/2.rrQE62rd.js                                         2.23 kB Ôöé gzip:   1.04 kB
.svelte-kit/output/client/_app/immutable/entry/app.mcpkIX5R.js                                       2.72 kB Ôöé gzip:   1.07 kB
.svelte-kit/output/client/_app/immutable/nodes/8.C-rsCzkR.js                                         3.37 kB Ôöé gzip:   1.18 kB
.svelte-kit/output/client/_app/immutable/chunks/DvTktrFW.js                                          3.73 kB Ôöé gzip:   1.73 kB
.svelte-kit/output/client/_app/immutable/chunks/Cyt8LZpN.js                                          3.80 kB Ôöé gzip:   1.69 kB
.svelte-kit/output/client/_app/immutable/nodes/0.Cwp0cBHv.js                                         4.26 kB Ôöé gzip:   1.84 kB
.svelte-kit/output/client/_app/immutable/nodes/3.Be8kCa9F.js                                         4.48 kB Ôöé gzip:   1.88 kB
.svelte-kit/output/client/_app/immutable/chunks/DVBFMp1X.js                                          4.88 kB Ôöé gzip:   1.79 kB
.svelte-kit/output/client/_app/immutable/chunks/CVBQYMwQ.js                                          6.16 kB Ôöé gzip:   2.47 kB
.svelte-kit/output/client/_app/immutable/chunks/MvsrUAjh.js                                          7.36 kB Ôöé gzip:   2.53 kB
.svelte-kit/output/client/_app/immutable/chunks/BATFg811.js                                          8.15 kB Ôöé gzip:   3.35 kB
.svelte-kit/output/client/_app/immutable/nodes/4.C_686kgB.js                                         8.41 kB Ôöé gzip:   3.06 kB
.svelte-kit/output/client/_app/immutable/nodes/6.fbb-kkCb.js                                         8.87 kB Ôöé gzip:   3.38 kB
.svelte-kit/output/client/_app/immutable/chunks/CLRV5URg.js                                         11.52 kB Ôöé gzip:   4.65 kB
.svelte-kit/output/client/_app/immutable/chunks/Dv9yxh75.js                                         12.28 kB Ôöé gzip:   4.44 kB
.svelte-kit/output/client/_app/immutable/chunks/DvmFIDWB.js                                         14.55 kB Ôöé gzip:   4.98 kB
.svelte-kit/output/client/_app/immutable/chunks/CGQqhCXS.js                                         16.65 kB Ôöé gzip:   5.55 kB
.svelte-kit/output/client/_app/immutable/nodes/5.BudS2oeC.js                                        17.71 kB Ôöé gzip:   6.54 kB
.svelte-kit/output/client/_app/immutable/nodes/7.D6-SjoOT.js                                        19.71 kB Ôöé gzip:   7.20 kB
.svelte-kit/output/client/_app/immutable/chunks/BxL-eAdJ.js                                         28.80 kB Ôöé gzip:   8.11 kB
.svelte-kit/output/client/_app/immutable/chunks/D7VRuSZt.js                                         33.91 kB Ôöé gzip:  10.71 kB
.svelte-kit/output/client/_app/immutable/chunks/C700-W4m.js                                         37.48 kB Ôöé gzip:  11.21 kB
.svelte-kit/output/client/_app/immutable/chunks/VWQ1smrR.js                                         42.35 kB Ôöé gzip:  15.61 kB
.svelte-kit/output/client/_app/immutable/chunks/Rs8CaRec.js                                         46.80 kB Ôöé gzip:  18.03 kB
.svelte-kit/output/client/_app/immutable/chunks/FbwsrAr6.js                                         87.09 kB Ôöé gzip:  28.19 kB
.svelte-kit/output/client/_app/immutable/chunks/DyqVeVm5.js                                        100.47 kB Ôöé gzip:  28.21 kB

[32mÔ£ô built in 931ms[39m
Prerendering

Run npm run preview to preview your production build locally.

> Using @sveltejs/adapter-static
Wrote site to "build"
Ô£ö done

```

