This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Build Notes

### Mar 12, 2026 - My Brain UI Redesign (Figma Implementation)

Implemented two Figma designs for the My Brain dashboard page (`src/app/page.tsx`):

**Design #1 - My Brain UI Master (Figma node 57-2118)**
- Full-width white header with "My Brain" title (4xl), welcome subtitle, and blue pill badge showing last visit time
- 5 KPI metric cards (Revenue, Items Sold, AOV, Links Created, Convert to Buy) with custom PNG icons from Figma
- Chat prompt panel (left): white card with inner grey area, MiMBrain logo, "How can i help?" heading, rounded input with blue border, calendar/paperclip/mic/send icons, "Launch a Gopher" and "Schedule a Meeting" action buttons
- Important Conversations panel (right): scrollable feed with Update button, filter pills (Slack/Gmail), conversation cards with status icons, source badges, priority dots, suggested action boxes with Add To Tasks/MiM Brain buttons and thumbs up/down

**Design #2 - Chat Detail View (Figma node 44-1874)**
- White card container wrapping entire chat experience
- Top bar with "Back" pill button and "Share this Conversation" link
- Prior Conversations sidebar (287px, cream #f3f2ed background) with conversation list
- Chat thread area with user messages in light purple/grey boxes (#f1eff3) and brain text responses
- Bottom input bar with blue border, "Launch a Gopher" (blue) and "Add To Knowledge" (purple) action buttons, paperclip/mic/send icons

**New icon assets**: `revenue.png`, `items-sold.png`, `aov.png`, `links-created.png`, `convert-to-buy.png`, `brain-icon-small.png`, `mimbrain-logo.png` in `/public/icons/`

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
