create table public.themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  owner uuid default auth.uid() references auth.users (id) on delete cascade,
  author text not null check (char_length(author) between 1 and 40),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 280),
  swatch text[] not null check (
    cardinality(swatch) = 3
    and array_to_string(swatch, ',') ~ '^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6}){2}$'
  ),
  appearance jsonb not null check (
    jsonb_typeof(appearance) = 'object'
    and appearance <> '{}'::jsonb
    and octet_length(appearance::text) <= 2048
  ),
  tags text[] not null default '{}' check (
    cardinality(tags) <= 6
    and array_to_string(tags, ',') ~ '^([a-z0-9-]{1,24}(,[a-z0-9-]{1,24})*)?$'
  ),
  likes integer not null default 0,
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index themes_owner_created on public.themes (owner, created_at);

create table public.theme_likes (
  theme uuid not null references public.themes (id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (theme, owner)
);

create table public.theme_edits (
  owner uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('publish', 'edit')),
  at timestamptz not null default now()
);

create index theme_edits_owner_kind_at on public.theme_edits (owner, kind, at);

create table public.theme_downloads (
  theme uuid not null references public.themes (id) on delete cascade,
  client text not null,
  day date not null default current_date,
  primary key (theme, client, day)
);

create index theme_downloads_day on public.theme_downloads (day);

alter table public.themes enable row level security;
alter table public.theme_likes enable row level security;
alter table public.theme_edits enable row level security;
alter table public.theme_downloads enable row level security;

revoke all on public.themes, public.theme_likes, public.theme_edits, public.theme_downloads
  from anon, authenticated;

grant select on public.themes to anon, authenticated;
grant insert (slug, author, name, description, swatch, appearance, tags) on public.themes to authenticated;
grant update (slug, author, name, description, swatch, appearance, tags) on public.themes to authenticated;
grant delete on public.themes to authenticated;
grant select, delete on public.theme_likes to authenticated;
grant insert (theme) on public.theme_likes to authenticated;

create policy "themes are public" on public.themes
  for select using (true);

create policy "owners publish themes" on public.themes
  for insert to authenticated with check (owner = (select auth.uid()));

create policy "owners edit themes" on public.themes
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "owners remove themes" on public.themes
  for delete to authenticated using (owner = (select auth.uid()));

create policy "users see their likes" on public.theme_likes
  for select to authenticated using (owner = (select auth.uid()));

create policy "users like" on public.theme_likes
  for insert to authenticated with check (owner = (select auth.uid()));

create policy "users unlike" on public.theme_likes
  for delete to authenticated using (owner = (select auth.uid()));

create function public.themes_publish_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.theme_edits
  where owner = new.owner and kind = 'publish' and at < now() - interval '24 hours';

  if (
    select count(*) from public.theme_edits where owner = new.owner and kind = 'publish'
  ) >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.theme_edits (owner, kind) values (new.owner, 'publish');

  return new;
end;
$$;

create trigger themes_publish_limit
  before insert on public.themes
  for each row when (new.owner is not null)
  execute function public.themes_publish_limit();

create function public.themes_edit_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.theme_edits
  where owner = new.owner and kind = 'edit' and at < now() - interval '1 hour';

  if (
    select count(*) from public.theme_edits where owner = new.owner and kind = 'edit'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.theme_edits (owner, kind) values (new.owner, 'edit');
  new.updated_at := now();

  return new;
end;
$$;

create trigger themes_edit_limit
  before update on public.themes
  for each row when (
    new.owner is not null
    and (old.slug, old.author, old.name, old.description, old.swatch, old.appearance, old.tags)
      is distinct from
      (new.slug, new.author, new.name, new.description, new.swatch, new.appearance, new.tags)
  )
  execute function public.themes_edit_limit();

create function public.theme_likes_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.themes set likes = likes + 1 where id = new.theme;
  else
    update public.themes set likes = greatest(likes - 1, 0) where id = old.theme;
  end if;

  return null;
end;
$$;

create trigger theme_likes_count
  after insert or delete on public.theme_likes
  for each row execute function public.theme_likes_count();

create function public.count_download(target uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  forwarded text := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
  who text := coalesce(
    (select auth.uid())::text,
    'ip:' || md5(coalesce(split_part(forwarded, ',', 1), 'unknown'))
  );
  total integer;
begin
  delete from public.theme_downloads where day < current_date - 1;

  insert into public.theme_downloads (theme, client) values (target, who)
  on conflict do nothing;

  if found then
    update public.themes set downloads = downloads + 1 where id = target
    returning downloads into total;
  else
    select downloads into total from public.themes where id = target;
  end if;

  return total;
end;
$$;

revoke execute on function public.count_download (uuid) from public;
grant execute on function public.count_download (uuid) to anon, authenticated;

revoke execute on function public.themes_publish_limit () from public, anon, authenticated;
revoke execute on function public.themes_edit_limit () from public, anon, authenticated;
revoke execute on function public.theme_likes_count () from public, anon, authenticated;

insert into public.themes (slug, owner, author, name, description, swatch, appearance, tags)
values
  (
    'polar-night', null, 'Eris', 'Polar Night',
    'Cool arctic blues on a flat night surface, from the Nord preset.',
    array['#2e3440', '#88c0d0', '#eceff4'],
    '{"mode":"dark","background":"solid","useSystemAccent":false,"accentHue":230,"accentSpread":30,"vividness":0.05,"texture":0.1,"radius":0.5,"blur":0.8}',
    array['official', 'cool', 'minimal']
  ),
  (
    'paper-amber', null, 'Eris', 'Paper Amber',
    'Warm paper with an amber accent, from the Solarized preset.',
    array['#fdf6e3', '#b58900', '#586e75'],
    '{"mode":"light","background":"solid","useSystemAccent":false,"accentHue":80,"accentSpread":20,"vividness":0.1,"texture":0.35,"radius":0.5,"blur":0.6}',
    array['official', 'warm', 'paper']
  ),
  (
    'glass-dock', null, 'Eris', 'Glass Dock',
    'A frosted, rounded dock that keeps the rest of your theme, from the Glass preset.',
    array['#f3f5fb', '#6f97f5', '#dbe4ff'],
    '{"dockBackground":"glass","dockOpacity":0.85,"dockBlur":1.6,"dockRadius":1.8,"dockTint":0.2,"dockBorder":false}',
    array['official', 'glass', 'dock']
  )
on conflict (slug) do nothing;
