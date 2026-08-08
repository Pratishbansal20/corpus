# Corpus

Corpus is a personal finance app for one person. It brings together stocks,
mutual funds, bank accounts, credit cards, SIPs and a credit score into one
net worth number, plus a view into what's inside your mutual funds.

**Live:** https://finance-manager-17xp.vercel.app

## Read this first

| File | What it tells you |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the app is built and why. Start here. |
| [`PLAN.md`](PLAN.md) | What's been built so far, and what problem each part solved. |
| [`TODO.md`](TODO.md) | What's planned next. |

## Built with

Next.js, TypeScript, PostgreSQL (via Neon), Prisma, and Tailwind for the
styling. Sign-in is Google, with an extra passphrase on top. Prices refresh
once a day automatically. More detail is in `ARCHITECTURE.md`.

## Run it yourself

```bash
npm install
npx prisma generate
npm run dev
```

You'll need a `.env` file. Copy `.env.example` and fill in the values:
a database URL, Google sign-in keys, your own email as the allowed owner,
and an encryption key for sensitive fields.

```bash
npm test               # run the tests
npx tsc --noEmit        # check types
npm run build            # build for production
npx prisma db push        # apply schema changes
```
