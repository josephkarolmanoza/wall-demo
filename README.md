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

## Supabase setup

The feed uses the existing `public.posts` table in Supabase. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql). It adds author, avatar, and image URL columns; creates the likes and comments tables and their access policies; configures the public `avatars` and `post-images` storage buckets; and inserts the example posts.

In **Project Settings → API Keys**, copy the Project URL and a Publishable key. Put them in a local `.env.local` file using the names shown in [`.env.example`](.env.example).

Add the same values to your Vercel project under **Settings → Environment Variables** for Production and Preview, then redeploy. Do not use a Supabase Secret or `service_role` key. The current public wall allows visitors to read and post messages; RLS policies in the SQL file enforce that access and the 280-character limit.

Editable profile details and a random visitor ID are stored in each visitor's browser. Uploaded profile photos, post images, posts, likes, and comments are stored in Supabase. A browser can add one like per post and toggle it off again; comments use the visitor's current profile name and photo.
