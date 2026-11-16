Wall is a React 19 and Next.js 15 message board.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Vercel database setup

The wall feed needs a Postgres database on Vercel. In your Vercel project, open **Storage**, add a **Neon Postgres** database from the Marketplace, and connect it to the Production and Preview environments. The integration provides the `DATABASE_URL` environment variable.

After connecting the database, redeploy the project. The app creates its `wall_posts` table and example posts automatically. Local development without `DATABASE_URL` continues to use the ignored `data/wall-posts.json` file.

Vercel integrations add credentials as environment variables to the project; changes to environment variables apply to new deployments, so a redeploy is required. See [Vercel Storage integrations](https://vercel.com/docs/marketplace-storage) and [Vercel environment variables](https://vercel.com/docs/environment-variables).
