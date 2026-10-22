# API keys — what you need, where to get them, where to put them

Every value below fits the **$0 / no-free-trial** rule: Clerk, Neon and Groq all have
permanent free plans that need no credit card. Nothing here expires into a bill.

## 1. The list

**Six of these are required** for the app to work as designed. Only `ADMIN_EMAILS` and
`VITE_CLERK_PROXY_URL` are genuinely optional.

| # | Variable | Status | Needed for | If it's missing |
|---|---|---|---|---|
| 1 | `DATABASE_URL` | **Required** | Postgres, every read/write | API exits: `DATABASE_URL must be set` |
| 2 | `CLERK_PUBLISHABLE_KEY` | **Required** | Server-side Clerk middleware, admin checks | Auth state never resolves; admin endpoints 403 |
| 3 | `VITE_CLERK_PUBLISHABLE_KEY` | **Required** | Sign-in UI in the browser | Blank page / Clerk JS never loads |
| 4 | `CLERK_SECRET_KEY` | **Required** | Session verification, Clerk user lookups, prod proxy | Sign-in never completes; `getAuth()` has no user |
| 5 | `GROQ_API_KEY` | **Required** | Receipt/photo scanning — the core AI feature | `500 Failed to parse receipt`; scanning dead |
| 6 | `VITE_API_URL` | **Required for local dev** | Frontend → API routing | Every fetch 404s against the Vite origin |
| 7 | `ADMIN_EMAILS` | Optional | Developer panel + admin routes | Feature is simply absent — nothing else breaks |
| 8 | `VITE_CLERK_PROXY_URL` | Production only | Clerk JS proxy on a custom domain | Clerk JS loads from `clerk.<domain>` instead |

**Where to get each one:**

| Variable | Source |
|---|---|
| `DATABASE_URL` | [neon.com](https://neon.com) — free plan, no card |
| `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | [dashboard.clerk.com](https://dashboard.clerk.com/sign-in) → your app → **API keys** |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `ADMIN_EMAILS` | The verified email(s) on your Clerk account |
| `VITE_API_URL` | You decide — `http://localhost:8080` for local dev |
| `VITE_CLERK_PROXY_URL` | `https://<your-domain>/api/__clerk` once you have a domain |

`PORT` and `LOG_LEVEL` are runtime config, not keys. `ONBOARDING_BASE_URL` and
`CHROME_BIN` are only used by the onboarding smoke-test script.

### The four keys that look optional but aren't

- **`GROQ_API_KEY`** — scanning a receipt or photograph is the app's headline feature. Without the
  key the scan path 500s after the OCR finishes, so the feature is not degraded, it's broken.
- **`CLERK_SECRET_KEY`** — this is not just for the production proxy. `@clerk/express` falls back to
  `process.env.CLERK_SECRET_KEY` when it authenticates a request, so without it `getAuth()`
  finds no user and every session-dependent route behaves as signed-out.
- **`VITE_API_URL`** — there is **no `server.proxy` in `artifacts/fridge-tracker/vite.config.ts`**.
  The frontend calls `${VITE_API_URL}/api/...`, so with the variable empty those requests hit Vite
  itself on port 3000 and 404. It only becomes optional when the frontend and API are served from
  one origin (e.g. behind Replit's `/api` routing).
- **`VITE_CLERK_PUBLISHABLE_KEY`** — same value as #2, but a separate variable: the server and the
  browser read different env keys, so both must be set or one half of the auth flow fails.


## 2. Getting each one (free plans only)

### 1 — `DATABASE_URL` → Neon (free, no card, no expiry)

1. Go to **[neon.com](https://neon.com)** → **Sign up** (GitHub or email). No card is requested.
2. Create a project. Pick the region closest to you; the default Postgres 17 is fine.
3. In the project, click **Connect** in the top navigation.
4. Keep **Connection pooling** on and copy the whole `postgresql://…` string — it already
   includes `?sslmode=require` and the `-pooler` host, which is exactly what this app wants.
5. That string **is** `DATABASE_URL`. Paste it verbatim, quotes and all.

Free plan: 1 GB storage, 100 compute-hours per project per month, scales to zero when idle.
Reference: [Neon pricing](https://neon.com/pricing), [Neon connection docs](https://neon.com/docs/connect/connect-from-any-app).

> Alternative free option: **Supabase** ([supabase.com/pricing](https://supabase.com/pricing)) — 500 MB,
> 2 projects, also no card. Its catch is that a free project **pauses after 7 days of inactivity**,
> and a paused project returns connection errors until you resume it in the dashboard.
> Neon's free plan doesn't pause like that, so Neon is the better default.
>
> **Do not** use Railway, Render's paid instances, or anything that starts with trial credits —
> those are free *trials*, which the $0 rule excludes.

### 2, 3, 4 — Clerk keys (free Hobby plan, 50k monthly users, no card)

1. Go to **[dashboard.clerk.com/sign-in](https://dashboard.clerk.com/sign-in)** and sign up (no card).
2. **Create application** → name it `Fridge Tracker` → choose the sign-in options you want
   (email + Google is enough) → create.
3. Open **API keys**: inside the app, the sidebar item *API keys* (older dashboards: *Configure
   → API keys*). The URL after sign-in is `https://dashboard.clerk.com/last-active?path=api-keys`.
4. Copy:
   - **Publishable key** (`pk_test_…`) → use it for **both** `CLERK_PUBLISHABLE_KEY` and
     `VITE_CLERK_PUBLISHABLE_KEY`. It's public by design and safe to ship to the browser.
   - **Secret key** → click **Create secret key** / reveal, copy `sk_test_…` → `CLERK_SECRET_KEY`.
     Clerk shows it **once**; if you lose it, create a new one and update `.env`.
5. Test vs live: `pk_test_`/`sk_test_` come from the **Development** instance. For a real domain,
   switch the dashboard to **Production**, create the production instance, and use
   `pk_live_`/`sk_live_` instead. Don't mix test and live keys.

Reference: [Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables),
[Clerk pricing](https://clerk.com/pricing).

### 5 — `GROQ_API_KEY` (free tier, no card)

1. Go to **[console.groq.com](https://console.groq.com)** and sign in (no card).
2. Open **API Keys** — direct link: **https://console.groq.com/keys**
3. **Create API Key** → name it `fridge-tracker` → copy the `gsk_…` value immediately.
4. Paste it into `GROQ_API_KEY`. It is **server-only** — never give it a `VITE_` prefix.

This key is **required** for the app's core feature: the OCR text is sent to
`POST /api/ai/parse-receipt`, which returns 500 without it. Typing items in by hand still works,
but scanning a receipt or product photo does not.

Reference: [Groq quickstart](https://console.groq.com/docs/quickstart), [Groq billing](https://console.groq.com/docs/billing-faqs).

> Receipt parsing calls `openai/gpt-oss-20b` (`artifacts/api-server/src/routes/ai.ts`), a current
> production model on Groq's free tier — the small variant is enough for text to JSON and is faster
> and cheaper than 120B. The previously used `llama-3.3-70b-versatile` was shut down
> on 2026-08-16 ([deprecation page](https://console.groq.com/docs/deprecations)), which is why the
> model ID matters: if parsing starts failing with no obvious cause, check that page and
> [the model list](https://console.groq.com/docs/models) before assuming the key is wrong.

## 3. Where the keys go

**One file: `.env` at the repository root.** It is already git-ignored.

```bash
cp .env.example .env
# open .env and fill in the values from step 2
```

Nothing else needs editing. The app is wired to read that single file:

| Consumer | How it reads `.env` |
|---|---|
| API server | `node --env-file-if-exists=../../.env …` in `artifacts/api-server/package.json` |
| Frontend (Vite) | `envDir` is set to the repo root in `artifacts/fridge-tracker/vite.config.ts` |
| Drizzle CLI | reads `process.env.DATABASE_URL` only, so export the file first (see below) |

Schema changes are pushed by hand, and the CLI does **not** load `.env` itself:

```bash
set -a; . ./.env; set +a; pnpm --filter @workspace/db run push
```

You rarely need it: the API runs its own `CREATE TABLE IF NOT EXISTS` migrations on startup.

### Rules that matter

- **Never** commit `.env`. `.gitignore` already blocks `.env` and `.env.*`, and only
  `.env.example` is tracked — keep it that way, and keep `.env.example` filled with fake values.
- **Only `VITE_`-prefixed variables reach the browser.** Anything with that prefix is compiled
  into public JavaScript. `CLERK_SECRET_KEY` and `GROQ_API_KEY` must never get one.
- **Deployed on Replit?** Put the same keys in **Secrets** (padlock icon → *Secrets*), not in a
  file. Replit injects them as environment variables, and `--env-file-if-exists` simply finds no
  file and carries on.
- **Leaked a key?** Rotate it at the source (Clerk → API keys → revoke; Groq → delete key) and
  update `.env`. That's the only real fix.

## 4. Check it worked

```bash
# API: should log "Migrations applied" and "Server listening", then answer healthz
pnpm --filter @workspace/api-server run dev
curl -s http://localhost:8080/api/healthz

# Frontend: sign-in screen instead of an auth error means the Clerk key loaded
PORT=3000 pnpm --filter @workspace/fridge-tracker dev
```

Expected failures and what they mean:

| Symptom | Cause |
|---|---|
| `DATABASE_URL must be set. Did you forget to provision a database?` | `.env` missing or not at the repo root |
| `ECONNREFUSED` / `ENOTFOUND` at startup | `DATABASE_URL` wrong, or Neon project paused |
| Blank page / Clerk "publishable key" error | `VITE_CLERK_PUBLISHABLE_KEY` missing — restart Vite after editing `.env` |
| `500 Failed to parse receipt` | `GROQ_API_KEY` missing or invalid, or the free-tier rate limit is hit |
| Developer panel absent | `ADMIN_EMAILS` empty, or the email isn't *verified* in Clerk |

## 5. Cost summary

| Service | Plan | Card needed | Limit you'll realistically hit |
|---|---|---|---|
| Clerk | Hobby | No | 50,000 monthly retained users |
| Neon | Free | No | 1 GB storage, 100 compute-hours/project/month |
| Groq | Free | No | Rate limits on requests/tokens per minute |
