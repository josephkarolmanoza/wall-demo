-- The existing Supabase table is public.posts with id, body, and created_at.
-- This adds the author field and an idempotency key for the sample posts.
alter table public.posts
  add column if not exists name text not null default 'Someone';

alter table public.posts
  add column if not exists seed_key text;

create unique index if not exists posts_seed_key_unique
  on public.posts (seed_key);

alter table public.posts enable row level security;
grant select, insert on public.posts to anon, authenticated;

do $$
declare
  posts_sequence regclass;
begin
  posts_sequence := pg_get_serial_sequence('public.posts', 'id');
  if posts_sequence is not null then
    execute format('grant usage, select on sequence %s to anon, authenticated', posts_sequence);
  end if;
end;
$$;

drop policy if exists "Wall posts are public to read" on public.posts;
create policy "Wall posts are public to read"
  on public.posts for select
  to anon, authenticated
  using (true);

drop policy if exists "Visitors can add short wall posts" on public.posts;
create policy "Visitors can add short wall posts"
  on public.posts for insert
  to anon, authenticated
  with check (
    char_length(btrim(name)) between 1 and 40
    and char_length(btrim(body)) between 1 and 280
  );

insert into public.posts (name, body, created_at, seed_key)
values
  ('Anna', 'Hey Greg, did you debug your coffee maker yet? Last cup tasted like JavaScript errors.', now() - interval '2 hours', 'example-anna'),
  ('Adelaida', 'Greg, saw your last coding session - pretty sure you broke Stack Overflow again!', now() - interval '3 hours', 'example-adelaida'),
  ('Juho', 'Greg, are you still coding in pajamas, or have you upgraded to full-time sweatpants mode?', now() - interval '4 hours', 'example-juho'),
  ('Maija', 'Greg, rumor has it your computer has more stickers than code running on it. Confirm?', now() - interval '5 hours', 'example-maija'),
  ('Alex', 'Yo Greg, just pulled an all-nighter on the assignment. Turns out sleep deprivation doesn''t improve coding skills. Weird!', now() - interval '6 hours', 'example-alex'),
  ('Sheryl', 'Greg, when are we gonna deploy your latest dance moves to production? #AgileDancer', now() - interval '8 hours', 'example-sheryl')
on conflict (seed_key) do nothing;
