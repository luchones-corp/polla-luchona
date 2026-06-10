-- Group chat messages table.
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_group_messages_group_created
  on public.group_messages(group_id, created_at desc);

alter table public.group_messages enable row level security;

-- Members can read messages in their groups
create policy group_messages_select_member
on public.group_messages
for select
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_messages.group_id
      and gm.user_id = auth.uid()
  )
);

-- Members can insert messages in their groups
create policy group_messages_insert_member
on public.group_messages
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.group_members gm
    where gm.group_id = group_messages.group_id
      and gm.user_id = auth.uid()
  )
);

-- Enable Supabase Realtime on this table
alter publication supabase_realtime add table public.group_messages;
