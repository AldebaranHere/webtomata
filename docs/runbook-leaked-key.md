# Runbook: the Cloudflare deploy key may have leaked

For the maintainer. Do the steps in order. Each step is one action. The key is the token `webtomata-github-deploy`, with the right "Account – Workers Scripts – Edit" on one account. With it, a thief can publish a new version of the site or delete it. It cannot touch domains, storage, secrets or billing.

## Stop the thief

1. Open `https://dash.cloudflare.com/profile/api-tokens`.
2. Click the "…" menu on `webtomata-github-deploy`.
3. Click **Roll**. The old value stops working at once.
4. Copy the new value. It is shown only once.
5. Open `https://github.com/AldebaranHere/webtomata/settings/secrets/actions`.
6. Click the pencil icon next to `CLOUDFLARE_API_TOKEN`.
7. Paste the new value and click **Update secret**.

## Find out what happened

8. Open the Cloudflare dashboard and click **Manage account**, then **Audit log**.
9. Set the date range to the last 30 days.
10. Compare each "Upload Version" or "Update script" row with the runs of `deploy.yml` on the **Actions** tab of the repository. The Cloudflare log can use another time zone than GitHub (UTC), so find the shift first. A row with no matching run is the thief.
11. Open **Workers & Pages**, then `webtomata`, then **Deployments**.
12. Look for a version that you do not recognize.

## Put back a clean site

13. Open the **Actions** tab of the repository.
14. Open the last green run of **Deploy** on `main`.
15. Click **Re-run all jobs**. This deploys the code from `main` again.
16. Open the site and check that the engine version appears. The smoke test in the run checks this too.

## Find the cause

17. List what changed in `Cargo.lock` and `pnpm-lock.yaml` in the last 30 days (`git log -p -- Cargo.lock pnpm-lock.yaml`).
18. Run `pnpm audit` and `cargo audit`.
19. Read the logs of the `deploy` job for a step that you do not recognize.
20. Write down what you found in a new decision record in `docs/decisions/`.

## Tell the users

21. If a bad version was live, put a short notice in the README and in the repository's **Security** tab (a draft security advisory). Say when the bad version was live and that machines saved in the browser could have been read by it.
