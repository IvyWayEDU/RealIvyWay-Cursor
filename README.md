This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Pricing + Stripe (Source of Truth)

- Pricing/payouts are defined **only** in `lib/pricing/catalog.ts` (integer cents).
- Checkout selects Stripe **Price IDs** by pricing key and must use Stripe Tax so the customer pays: **service price (catalog)** + **Stripe-calculated tax**.
- Stripe `amount_subtotal` must match `purchase_price_cents` from the catalog (base price), while `amount_total` includes tax.
- Provider earnings are derived from **`provider_payout_cents`** (never from Stripe charge minus fees).

### Required environment variables

- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `STRIPE_PRICE_IDS_JSON`: JSON map from pricing key → Stripe `price_...` id.
- `NEXT_PUBLIC_BASE_URL`: Base URL for redirects (e.g. `http://localhost:3000` in dev, your production URL in prod)
- `STRIPE_TAX_CODE_EDUCATION` (optional): Stripe Tax code to apply to education services products.
- `STRIPE_TAX_CODE_DIGITAL` (optional): Stripe Tax code to apply to digital services products (AI plans).

Example:

`STRIPE_PRICE_IDS_JSON='{"tutoring_single":"price_...","tutoring_monthly":"price_...","counseling_single":"price_...","counseling_monthly":"price_...","testprep_single":"price_...","testprep_monthly":"price_...","virtual_tour_single":"price_...","ai_basic_monthly":"price_...","ai_pro_monthly":"price_...","ai_pro_yearly":"price_..."}'`

For local dev only (non-production), you can alternatively create `data/stripe-price-ids.local.json` with the same key/value shape.

### Rebuild Stripe Products/Prices (one-time)

Run (with network access):

```bash
npm run stripe:rebuild-prices
```

This prints an updated `STRIPE_PRICE_IDS_JSON=...` value to paste into your environment.

### Validate pricing (local)

```bash
npm run pricing:validate
```

### Backfill historical session money fields (one-time)

```bash
npm run pricing:backfill
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
