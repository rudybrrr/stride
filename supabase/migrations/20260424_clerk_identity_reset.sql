-- Destructive Clerk identity reset.
-- This intentionally wipes existing app data and converts user-owned columns
-- from Supabase Auth UUIDs to Clerk user IDs stored as text.

drop trigger if exists trg_handle_new_user_bootstrap on auth.users;
drop function if exists public.handle_new_user_bootstrap();
drop view if exists public.weekly_leaderboard cascade;
drop trigger if exists trg_validate_todo_assignee_membership on public.todos;
drop trigger if exists trg_validate_todo_section_assignment on public.todos;
drop function if exists public.validate_todo_assignee_membership();
drop function if exists public.validate_todo_section_assignment();

do $$
declare
  table_list text;
begin
  select string_agg(format('%I.%I', table_schema, table_name), ', ')
  into table_list
  from (
    values
      ('public', 'todo_activity_events'),
      ('public', 'todo_comments'),
      ('public', 'weekly_commitments'),
      ('public', 'todo_label_links'),
      ('public', 'task_labels'),
      ('public', 'task_saved_views'),
      ('public', 'planner_saved_filters'),
      ('public', 'planned_focus_blocks'),
      ('public', 'focus_sessions'),
      ('public', 'todo_images'),
      ('public', 'todo_steps'),
      ('public', 'todos'),
      ('public', 'todo_sections'),
      ('public', 'todo_list_members'),
      ('public', 'todo_lists'),
      ('public', 'profiles')
  ) as app_tables(table_schema, table_name)
  where to_regclass(format('%I.%I', table_schema, table_name)) is not null;

  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;
end;
$$;

delete from auth.users;

create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'todo_lists',
        'todo_list_members',
        'todos',
        'todo_images',
        'focus_sessions',
        'planned_focus_blocks',
        'planner_saved_filters',
        'task_labels',
        'todo_label_links',
        'task_saved_views',
        'todo_sections',
        'todo_steps',
        'todo_comments',
        'todo_activity_events',
        'weekly_commitments'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select
      constraint_schema,
      table_schema,
      table_name,
      constraint_name
    from information_schema.table_constraints
    where constraint_type = 'FOREIGN KEY'
      and table_schema = 'public'
      and table_name in (
        'profiles',
        'todo_lists',
        'todo_list_members',
        'todos',
        'todo_images',
        'focus_sessions',
        'planned_focus_blocks',
        'planner_saved_filters',
        'task_labels',
        'todo_label_links',
        'task_saved_views',
        'todo_comments',
        'todo_activity_events',
        'weekly_commitments'
      )
      and (
        exists (
          select 1
          from information_schema.key_column_usage key_columns
          where key_columns.constraint_schema = table_constraints.constraint_schema
            and key_columns.constraint_name = table_constraints.constraint_name
            and key_columns.table_schema = table_constraints.table_schema
            and key_columns.table_name = table_constraints.table_name
            and key_columns.column_name in ('id', 'owner_id', 'user_id', 'assignee_user_id', 'actor_user_id')
        )
        or exists (
          select 1
          from information_schema.constraint_column_usage used_columns
          where used_columns.constraint_schema = table_constraints.constraint_schema
            and used_columns.constraint_name = table_constraints.constraint_name
            and (
              (used_columns.table_schema = 'auth' and used_columns.table_name = 'users')
              or (used_columns.table_schema = 'public' and used_columns.table_name = 'profiles')
            )
        )
      )
  loop
    execute format(
      'alter table %I.%I drop constraint if exists %I',
      constraint_row.table_schema,
      constraint_row.table_name,
      constraint_row.constraint_name
    );
  end loop;
end;
$$;

do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('public', 'profiles', 'id'),
        ('public', 'todo_lists', 'owner_id'),
        ('public', 'todo_list_members', 'user_id'),
        ('public', 'todos', 'user_id'),
        ('public', 'todos', 'assignee_user_id'),
        ('public', 'todo_images', 'user_id'),
        ('public', 'focus_sessions', 'user_id'),
        ('public', 'planned_focus_blocks', 'user_id'),
        ('public', 'planner_saved_filters', 'user_id'),
        ('public', 'task_labels', 'user_id'),
        ('public', 'todo_label_links', 'user_id'),
        ('public', 'task_saved_views', 'user_id'),
        ('public', 'todo_comments', 'user_id'),
        ('public', 'todo_activity_events', 'actor_user_id'),
        ('public', 'weekly_commitments', 'user_id')
    ) as columns_to_convert(table_schema, table_name, column_name)
    where exists (
      select 1
      from information_schema.columns
      where columns.table_schema = columns_to_convert.table_schema
        and columns.table_name = columns_to_convert.table_name
        and columns.column_name = columns_to_convert.column_name
    )
  loop
    execute format(
      'alter table %I.%I alter column %I drop default',
      target.table_schema,
      target.table_name,
      target.column_name
    );
    execute format(
      'alter table %I.%I alter column %I type text using %I::text',
      target.table_schema,
      target.table_name,
      target.column_name,
      target.column_name
    );
  end loop;
end;
$$;

alter table public.todo_lists drop constraint if exists todo_lists_owner_id_fkey;
alter table public.todo_lists
  add constraint todo_lists_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.todo_list_members drop constraint if exists todo_list_members_user_id_fkey;
alter table public.todo_list_members
  add constraint todo_list_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.todos drop constraint if exists todos_user_id_fkey;
alter table public.todos
  add constraint todos_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.todos drop constraint if exists todos_assignee_user_id_fkey;
alter table public.todos
  add constraint todos_assignee_user_id_fkey
  foreign key (assignee_user_id) references public.profiles(id) on delete set null;

alter table public.todo_images drop constraint if exists todo_images_user_id_fkey;
alter table public.todo_images
  add constraint todo_images_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.focus_sessions drop constraint if exists focus_sessions_user_id_fkey;
alter table public.focus_sessions
  add constraint focus_sessions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.planned_focus_blocks drop constraint if exists planned_focus_blocks_user_id_fkey;
alter table public.planned_focus_blocks
  add constraint planned_focus_blocks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.planner_saved_filters drop constraint if exists planner_saved_filters_user_id_fkey;
alter table public.planner_saved_filters
  add constraint planner_saved_filters_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.task_labels drop constraint if exists task_labels_user_id_fkey;
alter table public.task_labels
  add constraint task_labels_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.todo_label_links drop constraint if exists todo_label_links_user_id_fkey;
alter table public.todo_label_links
  add constraint todo_label_links_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.task_saved_views drop constraint if exists task_saved_views_user_id_fkey;
alter table public.task_saved_views
  add constraint task_saved_views_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.todo_comments drop constraint if exists todo_comments_user_id_fkey;
alter table public.todo_comments
  add constraint todo_comments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.todo_activity_events drop constraint if exists todo_activity_events_actor_user_id_fkey;
alter table public.todo_activity_events
  add constraint todo_activity_events_actor_user_id_fkey
  foreign key (actor_user_id) references public.profiles(id) on delete cascade;

alter table public.weekly_commitments drop constraint if exists weekly_commitments_user_id_fkey;
alter table public.weekly_commitments
  add constraint weekly_commitments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.todo_list_members drop constraint if exists todo_list_members_list_id_fkey;
alter table public.todo_list_members
  add constraint todo_list_members_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

alter table public.todos drop constraint if exists todos_list_id_fkey;
alter table public.todos
  add constraint todos_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

alter table public.todos drop constraint if exists todos_section_id_fkey;
alter table public.todos
  add constraint todos_section_id_fkey
  foreign key (section_id) references public.todo_sections(id) on delete set null;

alter table public.todo_images drop constraint if exists todo_images_todo_id_fkey;
alter table public.todo_images
  add constraint todo_images_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete cascade;

alter table public.todo_images drop constraint if exists todo_images_list_id_fkey;
alter table public.todo_images
  add constraint todo_images_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

alter table public.focus_sessions drop constraint if exists focus_sessions_list_id_fkey;
alter table public.focus_sessions
  add constraint focus_sessions_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete set null;

alter table public.focus_sessions drop constraint if exists focus_sessions_todo_id_fkey;
alter table public.focus_sessions
  add constraint focus_sessions_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete set null;

alter table public.focus_sessions drop constraint if exists focus_sessions_planned_block_id_fkey;
alter table public.focus_sessions
  add constraint focus_sessions_planned_block_id_fkey
  foreign key (planned_block_id) references public.planned_focus_blocks(id) on delete set null;

alter table public.planned_focus_blocks drop constraint if exists planned_focus_blocks_list_id_fkey;
alter table public.planned_focus_blocks
  add constraint planned_focus_blocks_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

alter table public.planned_focus_blocks drop constraint if exists planned_focus_blocks_todo_id_fkey;
alter table public.planned_focus_blocks
  add constraint planned_focus_blocks_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete set null;

alter table public.planner_saved_filters drop constraint if exists planner_saved_filters_list_id_fkey;
alter table public.planner_saved_filters
  add constraint planner_saved_filters_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete set null;

alter table public.task_saved_views drop constraint if exists task_saved_views_list_id_fkey;
alter table public.task_saved_views
  add constraint task_saved_views_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete set null;

alter table public.todo_sections drop constraint if exists todo_sections_list_id_fkey;
alter table public.todo_sections
  add constraint todo_sections_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

alter table public.todo_steps drop constraint if exists todo_steps_todo_id_fkey;
alter table public.todo_steps
  add constraint todo_steps_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete cascade;

alter table public.todo_label_links drop constraint if exists todo_label_links_todo_id_fkey;
alter table public.todo_label_links
  add constraint todo_label_links_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete cascade;

alter table public.todo_label_links drop constraint if exists todo_label_links_label_id_fkey;
alter table public.todo_label_links
  add constraint todo_label_links_label_id_fkey
  foreign key (label_id) references public.task_labels(id) on delete cascade;

alter table public.todo_comments drop constraint if exists todo_comments_todo_id_fkey;
alter table public.todo_comments
  add constraint todo_comments_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete cascade;

alter table public.todo_comments drop constraint if exists todo_comments_list_id_fkey;
alter table public.todo_comments
  add constraint todo_comments_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

alter table public.todo_activity_events drop constraint if exists todo_activity_events_todo_id_fkey;
alter table public.todo_activity_events
  add constraint todo_activity_events_todo_id_fkey
  foreign key (todo_id) references public.todos(id) on delete cascade;

alter table public.todo_activity_events drop constraint if exists todo_activity_events_list_id_fkey;
alter table public.todo_activity_events
  add constraint todo_activity_events_list_id_fkey
  foreign key (list_id) references public.todo_lists(id) on delete cascade;

create or replace function public.validate_todo_section_assignment()
returns trigger
language plpgsql
as $$
declare
  section_list_id uuid;
begin
  if new.section_id is null then
    return new;
  end if;

  select list_id
  into section_list_id
  from public.todo_sections
  where id = new.section_id;

  if section_list_id is null then
    raise exception 'Section % does not exist', new.section_id;
  end if;

  if section_list_id <> new.list_id then
    raise exception 'Section % does not belong to list %', new.section_id, new.list_id;
  end if;

  return new;
end;
$$;

create trigger trg_validate_todo_section_assignment
before insert or update of list_id, section_id on public.todos
for each row
execute function public.validate_todo_section_assignment();

create or replace function public.validate_todo_assignee_membership()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.todo_list_members
    where list_id = new.list_id
      and user_id = new.assignee_user_id
  ) then
    raise exception 'Assignee % is not a member of list %', new.assignee_user_id, new.list_id;
  end if;

  return new;
end;
$$;

create trigger trg_validate_todo_assignee_membership
before insert or update of list_id, assignee_user_id on public.todos
for each row
execute function public.validate_todo_assignee_membership();

drop function if exists public.is_list_member(uuid);
create function public.is_list_member(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.todo_list_members members
    where members.list_id = target_list_id
      and members.user_id = public.clerk_user_id()
  );
$$;

drop function if exists public.is_list_owner(uuid);
create function public.is_list_owner(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.todo_lists lists
    where lists.id = target_list_id
      and lists.owner_id = public.clerk_user_id()
  );
$$;

drop function if exists public.create_list_with_owner(text);
create function public.create_list_with_owner(list_name text)
returns table (
  id uuid,
  name text,
  owner_id text,
  inserted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id text := public.clerk_user_id();
  new_list public.todo_lists;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if list_name is null or btrim(list_name) = '' then
    raise exception 'List name cannot be empty';
  end if;

  insert into public.todo_lists (owner_id, name)
  values (current_user_id, btrim(list_name))
  returning * into new_list;

  insert into public.todo_list_members (list_id, user_id, role)
  values (new_list.id, current_user_id, 'owner')
  on conflict (list_id, user_id) do update set role = excluded.role;

  return query
  select new_list.id, new_list.name, new_list.owner_id, new_list.inserted_at;
end;
$$;

grant execute on function public.create_list_with_owner(text) to authenticated;

drop function if exists public.ensure_default_inbox();
drop function if exists public.ensure_user_bootstrap(uuid, text);
drop function if exists public.ensure_user_bootstrap(text, text);
create function public.ensure_user_bootstrap(
  target_user_id text,
  target_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inbox_list_id uuid;
begin
  if target_user_id is null or btrim(target_user_id) = '' then
    raise exception 'target_user_id is required';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    execute
      'insert into public.profiles (id, email)
       values ($1, $2)
       on conflict (id) do update
       set email = coalesce(public.profiles.email, excluded.email)'
    using target_user_id, nullif(btrim(target_email), '');
  else
    execute
      'insert into public.profiles (id)
       values ($1)
       on conflict (id) do nothing'
    using target_user_id;
  end if;

  select todo_lists.id
    into inbox_list_id
  from public.todo_lists
  where todo_lists.owner_id = target_user_id
    and lower(btrim(todo_lists.name)) = 'inbox'
  order by todo_lists.inserted_at nulls first, todo_lists.id
  limit 1;

  if inbox_list_id is null then
    insert into public.todo_lists (owner_id, name)
    values (target_user_id, 'Inbox')
    returning id into inbox_list_id;
  end if;

  insert into public.todo_list_members (list_id, user_id, role)
  values (inbox_list_id, target_user_id, 'owner')
  on conflict (list_id, user_id) do update
  set role = excluded.role;

  return inbox_list_id;
end;
$$;

create or replace function public.ensure_default_inbox()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id text := public.clerk_user_id();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return public.ensure_user_bootstrap(current_user_id, auth.jwt() ->> 'email');
end;
$$;

grant execute on function public.ensure_default_inbox() to authenticated;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'todo_lists',
        'todo_list_members',
        'todos',
        'todo_images',
        'focus_sessions',
        'planned_focus_blocks',
        'planner_saved_filters',
        'task_labels',
        'todo_label_links',
        'task_saved_views',
        'todo_sections',
        'todo_steps',
        'todo_comments',
        'todo_activity_events',
        'weekly_commitments'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.todo_lists enable row level security;
alter table public.todo_list_members enable row level security;
alter table public.todos enable row level security;
alter table public.todo_images enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.planned_focus_blocks enable row level security;
alter table public.planner_saved_filters enable row level security;
alter table public.task_labels enable row level security;
alter table public.todo_label_links enable row level security;
alter table public.task_saved_views enable row level security;
alter table public.todo_sections enable row level security;
alter table public.todo_steps enable row level security;
alter table public.todo_comments enable row level security;
alter table public.todo_activity_events enable row level security;
alter table public.weekly_commitments enable row level security;

create policy "Authenticated users can view profiles"
on public.profiles for select to authenticated
using (true);

create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (public.clerk_user_id() = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (public.clerk_user_id() = id)
with check (public.clerk_user_id() = id);

create policy "Members can view lists"
on public.todo_lists for select to authenticated
using (public.is_list_member(id));

create policy "Users can create owned lists"
on public.todo_lists for insert to authenticated
with check (public.clerk_user_id() = owner_id);

create policy "Owners can update lists"
on public.todo_lists for update to authenticated
using (public.clerk_user_id() = owner_id)
with check (public.clerk_user_id() = owner_id);

create policy "Owners can delete lists"
on public.todo_lists for delete to authenticated
using (public.clerk_user_id() = owner_id);

create policy "Members can view list memberships"
on public.todo_list_members for select to authenticated
using (public.is_list_member(list_id));

create policy "Owners can add list memberships"
on public.todo_list_members for insert to authenticated
with check (public.is_list_owner(list_id));

create policy "Owners can update list memberships"
on public.todo_list_members for update to authenticated
using (public.is_list_owner(list_id))
with check (public.is_list_owner(list_id));

create policy "Owners and members can delete list memberships"
on public.todo_list_members for delete to authenticated
using (public.is_list_owner(list_id) or public.clerk_user_id() = user_id);

create policy "Members can view todos"
on public.todos for select to authenticated
using (public.is_list_member(list_id));

create policy "Members can insert todos"
on public.todos for insert to authenticated
with check (
  public.clerk_user_id() = user_id
  and public.is_list_member(list_id)
  and (
    assignee_user_id is null
    or exists (
      select 1
      from public.todo_list_members members
      where members.list_id = todos.list_id
        and members.user_id = todos.assignee_user_id
    )
  )
);

create policy "Members can update todos"
on public.todos for update to authenticated
using (public.is_list_member(list_id))
with check (
  public.is_list_member(list_id)
  and (
    assignee_user_id is null
    or exists (
      select 1
      from public.todo_list_members members
      where members.list_id = todos.list_id
        and members.user_id = todos.assignee_user_id
    )
  )
);

create policy "Members can delete todos"
on public.todos for delete to authenticated
using (public.is_list_member(list_id));

create policy "Members can view todo images"
on public.todo_images for select to authenticated
using (public.is_list_member(list_id));

create policy "Members can insert own todo images"
on public.todo_images for insert to authenticated
with check (public.clerk_user_id() = user_id and public.is_list_member(list_id));

create policy "Members can delete own todo images"
on public.todo_images for delete to authenticated
using (public.clerk_user_id() = user_id and public.is_list_member(list_id));

create policy "Users can view own focus sessions"
on public.focus_sessions for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own focus sessions"
on public.focus_sessions for insert to authenticated
with check (
  public.clerk_user_id() = user_id
  and (list_id is null or public.is_list_member(list_id))
);

create policy "Users can delete own focus sessions"
on public.focus_sessions for delete to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can view own planned focus blocks"
on public.planned_focus_blocks for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own planned focus blocks"
on public.planned_focus_blocks for insert to authenticated
with check (public.clerk_user_id() = user_id and public.is_list_member(list_id));

create policy "Users can update own planned focus blocks"
on public.planned_focus_blocks for update to authenticated
using (public.clerk_user_id() = user_id)
with check (public.clerk_user_id() = user_id and public.is_list_member(list_id));

create policy "Users can delete own planned focus blocks"
on public.planned_focus_blocks for delete to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can view own planner saved filters"
on public.planner_saved_filters for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own planner saved filters"
on public.planner_saved_filters for insert to authenticated
with check (public.clerk_user_id() = user_id and (list_id is null or public.is_list_member(list_id)));

create policy "Users can update own planner saved filters"
on public.planner_saved_filters for update to authenticated
using (public.clerk_user_id() = user_id)
with check (public.clerk_user_id() = user_id and (list_id is null or public.is_list_member(list_id)));

create policy "Users can delete own planner saved filters"
on public.planner_saved_filters for delete to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can view own task labels"
on public.task_labels for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own task labels"
on public.task_labels for insert to authenticated
with check (public.clerk_user_id() = user_id);

create policy "Users can update own task labels"
on public.task_labels for update to authenticated
using (public.clerk_user_id() = user_id)
with check (public.clerk_user_id() = user_id);

create policy "Users can delete own task labels"
on public.task_labels for delete to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can view own todo label links"
on public.todo_label_links for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own todo label links"
on public.todo_label_links for insert to authenticated
with check (
  public.clerk_user_id() = user_id
  and exists (
    select 1
    from public.task_labels labels
    where labels.id = todo_label_links.label_id
      and labels.user_id = public.clerk_user_id()
  )
  and exists (
    select 1
    from public.todos todos
    where todos.id = todo_label_links.todo_id
      and public.is_list_member(todos.list_id)
  )
);

create policy "Users can delete own todo label links"
on public.todo_label_links for delete to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can view own task saved views"
on public.task_saved_views for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own task saved views"
on public.task_saved_views for insert to authenticated
with check (
  public.clerk_user_id() = user_id
  and (list_id is null or public.is_list_member(list_id))
  and not exists (
    select 1
    from unnest(label_ids) label_id
    left join public.task_labels labels
      on labels.id = label_id
      and labels.user_id = public.clerk_user_id()
    where labels.id is null
  )
);

create policy "Users can update own task saved views"
on public.task_saved_views for update to authenticated
using (public.clerk_user_id() = user_id)
with check (
  public.clerk_user_id() = user_id
  and (list_id is null or public.is_list_member(list_id))
  and not exists (
    select 1
    from unnest(label_ids) label_id
    left join public.task_labels labels
      on labels.id = label_id
      and labels.user_id = public.clerk_user_id()
    where labels.id is null
  )
);

create policy "Users can delete own task saved views"
on public.task_saved_views for delete to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can view sections in shared lists"
on public.todo_sections for select to authenticated
using (public.is_list_member(list_id));

create policy "Users can insert sections in shared lists"
on public.todo_sections for insert to authenticated
with check (public.is_list_member(list_id));

create policy "Users can update sections in shared lists"
on public.todo_sections for update to authenticated
using (public.is_list_member(list_id))
with check (public.is_list_member(list_id));

create policy "Users can delete sections in shared lists"
on public.todo_sections for delete to authenticated
using (public.is_list_member(list_id));

create policy "Users can view task steps in shared lists"
on public.todo_steps for select to authenticated
using (
  exists (
    select 1 from public.todos
    where todos.id = todo_steps.todo_id
      and public.is_list_member(todos.list_id)
  )
);

create policy "Users can insert task steps in shared lists"
on public.todo_steps for insert to authenticated
with check (
  exists (
    select 1 from public.todos
    where todos.id = todo_steps.todo_id
      and public.is_list_member(todos.list_id)
  )
);

create policy "Users can update task steps in shared lists"
on public.todo_steps for update to authenticated
using (
  exists (
    select 1 from public.todos
    where todos.id = todo_steps.todo_id
      and public.is_list_member(todos.list_id)
  )
)
with check (
  exists (
    select 1 from public.todos
    where todos.id = todo_steps.todo_id
      and public.is_list_member(todos.list_id)
  )
);

create policy "Users can delete task steps in shared lists"
on public.todo_steps for delete to authenticated
using (
  exists (
    select 1 from public.todos
    where todos.id = todo_steps.todo_id
      and public.is_list_member(todos.list_id)
  )
);

create policy "Users can view task comments in shared lists"
on public.todo_comments for select to authenticated
using (public.is_list_member(list_id));

create policy "Users can insert task comments in shared lists"
on public.todo_comments for insert to authenticated
with check (public.clerk_user_id() = user_id and public.is_list_member(list_id));

create policy "Users can update own task comments"
on public.todo_comments for update to authenticated
using (public.clerk_user_id() = user_id and public.is_list_member(list_id))
with check (public.clerk_user_id() = user_id and public.is_list_member(list_id));

create policy "Users can delete own task comments or owned-project comments"
on public.todo_comments for delete to authenticated
using (
  public.is_list_member(list_id)
  and (
    public.clerk_user_id() = user_id
    or public.is_list_owner(list_id)
  )
);

create policy "Users can view task activity in shared lists"
on public.todo_activity_events for select to authenticated
using (public.is_list_member(list_id));

create policy "Users can insert task activity in shared lists"
on public.todo_activity_events for insert to authenticated
with check (public.clerk_user_id() = actor_user_id and public.is_list_member(list_id));

create policy "Users can view own weekly commitments"
on public.weekly_commitments for select to authenticated
using (public.clerk_user_id() = user_id);

create policy "Users can insert own weekly commitments"
on public.weekly_commitments for insert to authenticated
with check (public.clerk_user_id() = user_id);

create policy "Users can update own weekly commitments"
on public.weekly_commitments for update to authenticated
using (public.clerk_user_id() = user_id)
with check (public.clerk_user_id() = user_id);

create policy "Users can delete own weekly commitments"
on public.weekly_commitments for delete to authenticated
using (public.clerk_user_id() = user_id);

create or replace view public.weekly_leaderboard as
select
  focus_sessions.user_id,
  coalesce(profiles.username, profiles.full_name, focus_sessions.user_id) as username,
  profiles.avatar_url,
  sum(round(focus_sessions.duration_seconds::numeric / 60))::integer as total_minutes
from public.focus_sessions
left join public.profiles
  on profiles.id = focus_sessions.user_id
where focus_sessions.mode = 'focus'
  and focus_sessions.inserted_at >= date_trunc('week', now())
group by focus_sessions.user_id, profiles.username, profiles.full_name, profiles.avatar_url;

grant select on public.weekly_leaderboard to authenticated;

drop policy if exists "Users can upload own profile avatars" on storage.objects;
create policy "Users can upload own profile avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = public.clerk_user_id()
);

drop policy if exists "Users can delete own profile avatars" on storage.objects;
create policy "Users can delete own profile avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = public.clerk_user_id()
);
