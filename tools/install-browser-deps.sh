#!/bin/bash
# Installs the system libraries that a Playwright browser needs (CI, the job cross-browser), and does
# not let a slow Ubuntu mirror hold the job. Tested in install-browser-deps.test.mjs.
#
# `playwright install-deps` runs `apt-get update` and `apt-get install` with no time limit, and some
# runners have a mirror (azure.archive.ubuntu.com) that is slow without hanging: 8 to 36 minutes in
# some runs, against 30 seconds normally. A network timeout of apt never fires then, because data
# keeps coming, and `timeout` on playwright does not stop the apt that it started as root. So this
# asks Playwright which packages are missing (`--dry-run`), and runs apt itself, as root, under
# `timeout`: a try that is too slow is stopped (and killed a moment later if it does not stop).
# apt keeps the packages that it has downloaded, so the next try goes on where the one before
# stopped, and from the second try on the main archive (archive.ubuntu.com) replaces the mirror.
#
# Usage: tools/install-browser-deps.sh <browser>      (firefox, webkit, chromium)
# Settings, for the tests: TRIES (3), TRY_SECONDS (150), KILL_SECONDS (10), APT_SOURCES.
set -u

browser="${1:?usage: install-browser-deps.sh <browser>}"
tries="${TRIES:-3}"
seconds="${TRY_SECONDS:-150}"
kill_after="${KILL_SECONDS:-10}"
sources="${APT_SOURCES:-/etc/apt/sources.list /etc/apt/sources.list.d/*.sources}"

# Runs a command as root under a time limit.
limited() {
  sudo timeout -k "$kill_after" "$seconds" "$@"
}

# The packages that Playwright says are missing, one for each line of its list.
missing_packages() {
  pnpm --filter web exec playwright install-deps --dry-run "$browser" 2>&1 |
    sed -n 's/^  \([a-z0-9][a-z0-9.+-]*\)$/\1/p'
}

for attempt in $(seq 1 "$tries"); do
  if [ "$attempt" -gt 1 ]; then
    echo "Try $attempt: using archive.ubuntu.com in place of the mirror of the runner."
    # shellcheck disable=SC2086  # the list of files is meant to be split and expanded
    sudo sed -i -E 's#mirror\+file:/etc/apt/apt-mirrors\.txt|https?://azure\.archive\.ubuntu\.com/ubuntu/?#http://archive.ubuntu.com/ubuntu/#' $sources 2>/dev/null || true
  fi
  # The index first: the list of what is missing is made from it.
  if ! limited apt-get update -qq; then
    echo "Try $attempt: apt-get update did not finish."
    continue
  fi
  packages="$(missing_packages)"
  if [ -z "$packages" ]; then
    echo "No system library is missing for $browser."
    exit 0
  fi
  echo "Try $attempt: installing $(echo "$packages" | wc -l | tr -d ' ') packages for $browser."
  # shellcheck disable=SC2086  # one argument for each package
  if limited apt-get install -y --no-install-recommends $packages; then
    exit 0
  fi
  echo "Try $attempt did not finish."
done

echo "The system libraries for $browser could not be installed in $tries tries."
exit 1
