[CmdletBinding()]
param([string]$Baseline = "")

$ErrorActionPreference = "Continue"
$out = "docs/agent/HANDOFF-SNAPSHOT"
New-Item -ItemType Directory -Force -Path $out | Out-Null

if (-not $Baseline) {
    if (Test-Path ".agent-baseline-sha") {
        $Baseline = (Get-Content ".agent-baseline-sha" -Raw).Trim()
    } else {
        $Baseline = git describe --tags --abbrev=0 2>$null
        if (-not $Baseline) {
            $Baseline = (git rev-list --max-parents=0 HEAD | Select-Object -First 1)
        }
    }
}

$head = git rev-parse HEAD
Write-Host "Snapshot baseline: $Baseline"
Write-Host "Snapshot HEAD:     $head"
$f = '```'

function Append-Block {
    param([System.Text.StringBuilder]$Sb, [string]$Title, [string]$Body)
    [void]$Sb.AppendLine("")
    [void]$Sb.AppendLine("## $Title")
    [void]$Sb.AppendLine($f)
    foreach ($l in ($Body -split "`r?`n")) { [void]$Sb.AppendLine($l) }
    [void]$Sb.AppendLine($f)
}

function Append-Cmd {
    param([System.Text.StringBuilder]$Sb, [string]$Title, [string]$Cmd)
    [void]$Sb.AppendLine("")
    [void]$Sb.AppendLine("## $Title")
    [void]$Sb.AppendLine($f)

    $oldPref = $ErrorActionPreference
    $oldConsoleEnc = [Console]::OutputEncoding
    $ErrorActionPreference = 'Continue'
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $env:NO_COLOR = '1'
    $env:FORCE_COLOR = '0'
    $env:CI = '1'

    $raw = ""
    try {
        $raw = (& cmd.exe /c "chcp 65001 >nul && $Cmd 2>&1" 2>&1) -join "`n"
    } catch {
        $raw = "EXCEPTION: $_"
    } finally {
        $ErrorActionPreference = $oldPref
        [Console]::OutputEncoding = $oldConsoleEnc
    }

    $raw = [regex]::Replace($raw, [char]27 + '\[[0-9;]*[A-Za-z]', '')

    $lines = $raw -split "`r?`n"
    if ($lines.Count -gt 400) { $lines = $lines[-400..-1] }
    foreach ($l in $lines) { [void]$Sb.AppendLine($l) }

    [void]$Sb.AppendLine($f)
}

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Git")
Append-Block $sb "Current branch" (git branch --show-current)
Append-Block $sb "HEAD" $head
Append-Block $sb "Baseline" $Baseline
Append-Block $sb "Commits since baseline" (git log --oneline "$Baseline..HEAD")
Append-Block $sb "Diffstat since baseline" (git diff --stat "$Baseline..HEAD")
Append-Block $sb "Branches" (git branch -a)
Set-Content -Path "$out/01-git.md" -Value $sb.ToString() -Encoding utf8

$exclude = @('node_modules','.git','dist','build','.svelte-kit','coverage','test-results','playwright-report')
$root = (Get-Location).Path
$tree = Get-ChildItem -Recurse -File -Depth 3 |
    Where-Object {
        $parts = $_.FullName.Split([IO.Path]::DirectorySeparatorChar)
        -not ($parts | Where-Object { $exclude -contains $_ })
    } |
    ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\','/') } |
    Sort-Object
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# File tree (depth 3, excluding noise)")
[void]$sb.AppendLine($f)
foreach ($l in $tree) { [void]$sb.AppendLine($l) }
[void]$sb.AppendLine($f)
Set-Content -Path "$out/02-tree.md" -Value $sb.ToString() -Encoding utf8

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Package manifests")
foreach ($mf in @('package.json','web/package.json','pnpm-workspace.yaml','pnpm-lock.yaml')) {
    if (Test-Path $mf) {
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("## $mf")
        [void]$sb.AppendLine($f)
        [void]$sb.AppendLine((Get-Content $mf -Raw))
        [void]$sb.AppendLine($f)
    }
}
Set-Content -Path "$out/03-manifests.md" -Value $sb.ToString() -Encoding utf8

$markers = git grep -n -E 'TODO|FIXME|HACK|XXX' -- ':!node_modules' ':!pnpm-lock.yaml' 2>$null
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# TODOs, FIXMEs, HACKs, XXXs")
[void]$sb.AppendLine($f)
if ($markers) { foreach ($l in $markers) { [void]$sb.AppendLine($l) } }
[void]$sb.AppendLine($f)
Set-Content -Path "$out/04-markers.md" -Value $sb.ToString() -Encoding utf8

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Verification output")
Append-Cmd $sb "Format"                "pnpm format:check"
Append-Cmd $sb "Svelte check"          "pnpm --filter web check"
Append-Cmd $sb "Lint"                  "pnpm --filter web lint"
Append-Cmd $sb "Unit tests"            "pnpm --filter web test"
Append-Cmd $sb "Node tests (tools/)"   "node --test tools/*.test.mjs"
Append-Cmd $sb "Workflow guard rails"  "node tools/check-workflows.mjs"
Append-Cmd $sb "Contrast guard rails"  "node tools/check-contrast.mjs"
Append-Cmd $sb "Token usage"           "node tools/check-tokens-usage.mjs"
Append-Cmd $sb "Strings"               "node tools/check-strings.mjs"
Append-Cmd $sb "Questions"             "node tools/check-questions.mjs"
Append-Cmd $sb "Rust engine tests"     "cargo test -p engine-core"
Append-Cmd $sb "Build"                 "pnpm --filter web build"
Set-Content -Path "$out/05-verify.md" -Value $sb.ToString() -Encoding utf8

$diff = git diff "$Baseline..HEAD"
$lines = $diff -split "`r?`n"
if ($lines.Count -gt 5000) { $lines = $lines[0..4999] + "..." + "(truncated; run git diff for full)" }
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Full diff since baseline")
[void]$sb.AppendLine($f + "diff")
foreach ($l in $lines) { [void]$sb.AppendLine($l) }
[void]$sb.AppendLine($f)
Set-Content -Path "$out/06-diff.md" -Value $sb.ToString() -Encoding utf8

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("# Design artifacts currently in the repo")
[void]$sb.AppendLine($f)
if (Test-Path "design") {
    Get-ChildItem -Recurse -File design |
        ForEach-Object { [void]$sb.AppendLine($_.FullName.Substring($root.Length + 1).Replace('\','/')) }
} else {
    [void]$sb.AppendLine("(none)")
}
[void]$sb.AppendLine($f)
Set-Content -Path "$out/07-design.md" -Value $sb.ToString() -Encoding utf8

Write-Host "Snapshot written to $out"
Get-ChildItem $out | Format-Table Name, Length -AutoSize
