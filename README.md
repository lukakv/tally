# Tally

A small, private finance tracker for a phone. Income, daily spending by category,
budgets against reality, shared costs with other people, and savings kept in as many
currencies as you hold — always separate from spending.

Everything lives on the device. No account, no server, no network calls.

---

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. In a desktop browser, switch to a phone viewport
(DevTools → device toolbar) — the layout is built for a narrow screen.

### On your actual phone

The dev server listens on the local network, so with the phone on the same Wi-Fi
open the `Network:` address Vite prints (something like `http://192.168.1.20:5173`).

That is enough to use the app, but **plain HTTP is not a secure context**, so
"Add to Home Screen" and offline support will not work from the dev server. For a
real install, use one of the two delivery routes below.

---

## Getting it onto a phone properly

### Route 1 — installable web app (fastest)

Push to GitHub and enable **Settings → Pages → Source: GitHub Actions**. The
`Deploy PWA` workflow publishes on every push to `main`.

Open the resulting HTTPS URL on Android, then **⋮ → Add to Home screen**. It gets
its own icon, opens full-screen with no browser chrome, and works offline.

Any static host works just as well — Netlify, Vercel, Cloudflare Pages. Build with
`npm run build` and serve `dist/`.

### Route 2 — a real `.apk` file

The `Android APK` workflow wraps the same code with Capacitor and builds a
sideloadable APK in the cloud. Nothing needs to be installed locally.

Push to `main` (or run the workflow manually from the Actions tab), wait a few
minutes, then download `tally-apk` from the run's **Artifacts** section and send
them the file.

It is a *debug* APK, which installs fine after allowing "install from unknown
sources". If you ever want a Play Store build, that needs a signing keystore —
worth doing only if it actually goes to the store.

**Why bother with the APK at all?** In a browser, Android can in principle clear
IndexedDB when storage runs low. Settings → *Make storage permanent* asks the
browser to prevent that, but inside an APK the data is app-private and simply never
gets touched. If this becomes someone's real ledger, the APK is the safer home.

### Building the Android project locally

Only if you want to. It needs JDK 21 and the Android SDK:

```bash
npm run build
npx cap add android
npx @capacitor/assets generate --android
npx cap sync android
cd android && ./gradlew assembleDebug
```

`android/` is gitignored — CI regenerates it, so the repo stays a plain web app.

---

## How the numbers work

Two rules explain every figure in the app.

**1. A split expense costs you your share, not the whole bill.**

Dinner is ₾100 and you halve it with someone:

| | |
|---|---|
| Your `Eating out` total for the month | **₾50** — that is what dinner cost you |
| Cash that actually left your pocket | ₾100 |
| They owe you | ₾50, tracked on the **Shared** tab |

If *they* paid instead, your `Eating out` total is still ₾50 — you owe them for it.
Spending is recorded when it happens, and the Shared ledger tracks who is out of
pocket in the meantime. Settling up clears the balance and is **never** counted as
income or expense.

**2. Savings is a transfer between your own pots, not spending.**

Savings live in **pots**, and a pot holds exactly one currency — so lari, dollars
and euros are tracked side by side rather than mashed together. Money moves
through a pot in one of two ways, and the difference is the only thing the rest
of the app cares about:

| | What it does |
|---|---|
| **Money you already had** | Recorded straight on the pot, in the pot's own currency. Does not touch any monthly total. This is how you enter savings you already hold, or move money in from elsewhere. |
| **Out of this month's money** | Leaves this month's cash and shows as **Saved**, never as **Spent**. Only possible for a pot in your main currency — the ledger has no other. |

Taking money out works the same way in reverse. If you actually *spent* it, log
that as a normal expense and tick **From savings**: it counts as real spending,
but comes out of the pot rather than this month's income.

Each pot separates **what was already in it** from **what has been added since**,
which is what the two figures at the top of the Savings screen report.

**Combined totals are at rates you set yourself.** Tally never goes online, so
there are no live exchange rates. Enter one per currency under *Rates*; a pot
with no rate keeps its own balance but stays out of the combined total, and says
so, rather than being folded in at a number nobody chose.

So the headline figure on the home screen is:

```
Left = Income − Spent − Saved + (whatever was funded from savings)
```

…and if no income has been recorded for the month, the headline simply reports
what you have spent instead. Plenty of people only track spending, and showing
them a large negative "left" would be alarming and useless.

Every running total — the per-day figures on Activity included — goes through the
same `cashFlow` rule, so no two screens can disagree about the same month.

Every amount is stored as a whole number of tetri/cents, so totals never drift the
way floating-point money does. Split shares always add back up to the exact total —
₾10.00 three ways is 3.34 / 3.33 / 3.33, never 9.99.

The rules above are pinned down by tests:

```bash
npm test
```

---

## Your data

- Stored in IndexedDB on the device, and nowhere else.
- **Settings → Export a backup** writes a JSON file with everything in it.
- **Restore from backup** reads one back — that is also how you move to a new phone.
- **Erase all data** wipes the device clean.

Worth exporting occasionally. There is no cloud copy to fall back on, which is
the point, but it does mean a lost phone is a lost ledger.

---

## Layout

```
src/
  lib/
    types.ts        the shape of everything
    store.ts        zustand + IndexedDB persistence, all mutations
    selectors.ts    every derived number — the accounting core
    money.ts        integer-minor-unit maths and formatting
    date.ts         month keys and labels
    icons.ts        category icon registry + palette
    seed.ts         default categories, currencies
    accounting.test.ts
  ui/               reusable pieces (Sheet, Money, Segmented, toasts…)
  components/       app-specific pieces (entry sheet, keypad, split editor,
                    savings movement + pot sheets…)
  screens/          Home, Activity, Report, Split, Savings, Settings, Onboarding
```

`selectors.ts` is the file to read first — it defines what every number on screen
actually means.

## Scripts

| | |
|---|---|
| `npm run dev` | dev server, reachable on the LAN |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm test` | accounting test suite |
| `npm run icons` | regenerate app icons from `scripts/icon.svg` |
| `npm run lint` | oxlint |

Set `VITE_BASE=/subpath/` when building for a host that serves from a subdirectory
(the Pages workflow does this automatically).
