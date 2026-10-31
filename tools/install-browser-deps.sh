#!/bin/bash
# Installs the system libraries that a Playwright browser needs (CI, the job cross-browser), and does
# not let a slow Ubuntu mirror or interrupted dpkg state hold the job. Tested in install-browser-deps.test.mjs.
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
# Settings, for the tests: TRIES (3), TRY_SECONDS (300), KILL_SECONDS (10), APT_SOURCES.
# A normal install for Firefox takes 25 to 40 seconds, while WebKit has 181 packages taking 90 to 120
# seconds. 300 seconds allows normal WebKit unpack and configuration to complete without being killed
# mid-dpkg, while still bounding a hung mirror (which can stall for 8 to 36 minutes).
set -u

browser="${1:?usage: install-browser-deps.sh <browser>}"
tries="${TRIES:-3}"
seconds="${TRY_SECONDS:-300}"
kill_after="${KILL_SECONDS:-10}"
sources="${APT_SOURCES:-/etc/apt/sources.list /etc/apt/sources.list.d/*.sources}"

# Runs a command as root under a time limit.
limited() {
  sudo timeout -k "$kill_after" "$seconds" "$@"
}

# Repairs an interrupted dpkg database and waits for locks from any killed processes to clear.
repair_dpkg() {
  # 1. Kill any stale apt or dpkg processes that may still be running from an interrupted attempt.
  # Use process-name matching only, not full command-line matching, so this script itself is not killed.
  sudo pkill -9 apt-get 2>/dev/null || true
  sudo pkill -9 dpkg 2>/dev/null || true

  # 2. Wait for the dpkg lock to be released (up to 120 seconds).
  if command -v fuser >/dev/null 2>&1; then
    local waited=0
    while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || sudo fuser /var/lib/dpkg/lock >/dev/null 2>&1; do
      if [ "$waited" -ge 120 ]; then
        echo "Timed out waiting for dpkg lock."
        break
      fi
      sleep 2
      waited=$((waited + 2))
    done
  fi

  # 3. Repair the interrupted dpkg database.
  sudo dpkg --configure -a 2>/dev/null || true
}

# The packages that Playwright says are missing, one for each line of its list.
missing_packages() {
  pnpm --filter web exec playwright install-deps --dry-run "$browser" 2>&1 |
    sed -n 's/^  \([a-z0-9][a-z0-9.+-]*\)$/\1/p'
}

for attempt in $(seq 1 "$tries"); do
  if [ "$attempt" -gt 1 ]; then
    echo "Try $attempt: repairing dpkg and using archive.ubuntu.com in place of the runner mirror."
    repair_dpkg
    # shellcheck disable=SC2086  # the list of files is meant to be split and expanded
    sudo sed -i -E 's#mirror\+file:/etc/apt/apt-mirrors\.txt|https?://azure\.archive\.ubuntu\.com/ubuntu/?#http://archive.ubuntu.com/ubuntu/#' $sources 2>/dev/null || true
  fi
  # The index first: the list of what is missing is made from it.
  if ! limited apt-get -o DPkg::Lock::Timeout=120 update -qq; then
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
  if limited apt-get -o DPkg::Lock::Timeout=120 install -y --no-install-recommends $packages; then
    exit 0
  fi
  echo "Try $attempt did not finish."
done

echo "The system libraries for $browser could not be installed in $tries tries."
exit 1
