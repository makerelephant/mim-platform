# MiM Brain — Stripe KPI Integration
**Status:** Spec complete · Implementation pending  
**Last updated:** March 12, 2026

---

## What Was Decided

### Architecture
- Stripe connects via **server-side API route** — secret key never exposed to client
- UI polls `/api/stripe/kpis` every 60 seconds via a custom hook
- KPI containers on the My Brain view are wired to live data, not replaced — surgical edit only

### KPIs Selected
| KPI | Stripe Source | Format |
|-----|--------------|--------|
| Total Revenue (all time) | `balanceTransactions.list({ type: 'charge' })` → sum of `net` | `$X,XXX` |
| Order Count | `charges.list()` → filter `status === 'succeeded'` | `X,XXX` |
| Average Order Value | Total Revenue ÷ Order Count | `$X.XX` |

---

## Files to Create

### 1. `/app/api/stripe/kpis/route.ts`
Server-side API route. Fetches Stripe data and returns computed KPIs.

```typescript
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function GET() {
  try {
    const [charges, balanceTxns] = await Promise.all([
      stripe.charges.list({ limit: 100 }),
      stripe.balanceTransactions.list({ limit: 100, type: 'charge' }),
    ]);

    const totalRevenue = balanceTxns.data.reduce(
      (sum, txn) => sum + txn.net, 0
    ) / 100;

    const orderCount = charges.data.filter(
      (c) => c.status === 'succeeded'
    ).length;

    const aov = orderCount > 0 ? totalRevenue / orderCount : 0;

    return NextResponse.json({
      totalRevenue,
      orderCount,
      aov,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Stripe KPI fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch Stripe data' },
      { status: 500 }
    );
  }
}
```

---

### 2. `/hooks/useStripeKPIs.ts`
Client-side hook. Handles loading, error state, and auto-refresh.

```typescript
import { useState, useEffect } from 'react';

interface StripeKPIs {
  totalRevenue: number;
  orderCount: number;
  aov: number;
  lastUpdated: string;
}

export function useStripeKPIs(refreshInterval = 60000) {
  const [data, setData] = useState<StripeKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = async () => {
    try {
      const res = await fetch('/api/stripe/kpis');
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError('Unable to load Stripe data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
    const interval = setInterval(fetchKPIs, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { data, loading, error, refetch: fetchKPIs };
}
```

---

### 3. My Brain View — Wire KPI Containers
Find the existing Brain view file (likely `/app/brain/page.tsx` or similar).  
**Do not change layout or styling — swap values only.**

```tsx
import { useStripeKPIs } from '@/hooks/useStripeKPIs';

// Inside the Brain component:
const { data, loading, error } = useStripeKPIs();

// Replace static values in existing KPI containers:
<KPIContainer
  label="Total Revenue"
  value={loading ? '—' : `$${data?.totalRevenue.toLocaleString()}`}
  error={error}
/>

<KPIContainer
  label="Order Count"
  value={loading ? '—' : data?.orderCount.toLocaleString()}
  error={error}
/>

<KPIContainer
  label="Avg Order Value"
  value={loading ? '—' : `$${data?.aov.toFixed(2)}`}
  error={error}
/>
```

---

## Environment Setup

### `.env.local` — add:
```
STRIPE_SECRET_KEY=sk_live_...
```
> Use `sk_test_...` for development. Never commit this file.

---

## Dependencies

```bash
npm install stripe
```

Verify `stripe` is in `package.json` dependencies after install.

---

## Implementation via Claude Code

Open terminal in platform root and run:

```bash
claude
```

Paste this prompt:

```
Implement Stripe KPI integration on the My Brain view:

1. Create /app/api/stripe/kpis/route.ts — server-side Stripe fetch returning
   { totalRevenue, orderCount, aov, lastUpdated }. Use stripe SDK,
   STRIPE_SECRET_KEY from env. Fetch balance transactions for revenue,
   charges for order count, compute AOV.

2. Create /hooks/useStripeKPIs.ts — hook that fetches /api/stripe/kpis,
   returns { data, loading, error, refetch }, auto-refreshes every 60s.

3. Find the My Brain view file. Locate the existing static KPI containers.
   Wire useStripeKPIs() into them replacing static values with:
   - Total Revenue → $data.totalRevenue formatted
   - Order Count → data.orderCount
   - Average Order Value → $data.aov toFixed(2)
   Show loading state as "—" and surface errors inline.

4. Add stripe to package.json if not present and run npm install.

Do not change any layout, styling, or other components. Surgical changes only.
```

---

## Validation Checklist

- [ ] `STRIPE_SECRET_KEY` added to `.env.local`
- [ ] `npm install stripe` completed
- [ ] `/app/api/stripe/kpis/route.ts` created
- [ ] `/hooks/useStripeKPIs.ts` created
- [ ] Brain view imports `useStripeKPIs`
- [ ] KPI containers show live values (not static)
- [ ] Loading state shows `—` not blank
- [ ] No layout or styling regressions

---

## Future Enhancements
- Paginate Stripe calls beyond 100 records for full all-time accuracy
- Add MRR (requires subscription data from `stripe.subscriptions.list`)
- Add revenue sparkline using `balanceTransactions` with date filtering
- Cache API route response in Redis to reduce Stripe API calls at scale
