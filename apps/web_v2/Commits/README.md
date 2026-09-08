# Commits (iOS standalone deploy repo)

This GitHub repo is **`alsetso/ftlomn-ios`**. Vercel deploys **`main`** to `ios2026.fortheloveofminnesota.com` — the one production iOS app (the old `alsetso/ios-ftlomn` v1 repo/project is retired).

| | |
|---|---|
| Local monorepo path | `apps/ios/` inside `alsetso/ftlomn` |
| Push target | **this** repo (`main`) — not `ftlomn` |
| Localhost | `pnpm dev` → http://localhost:3002 |

## Blocked deploy: git email

Author must be a verified GitHub email for `alsetso`:

```bash
git -c user.name="alsetso" -c user.email="alsetsolutionsinc@gmail.com" commit -m "Your message."
```

Never commit as `*@*.local` (Mac hostname). Full guide in the monorepo: `Commits/GIT_IDENTITY.md`.

## From the monorepo

```bash
./Commits/scripts/push-ios.sh "Your message."
```

That rsyncs `apps/ios/` → this repo root and pushes `main` with the correct author.
