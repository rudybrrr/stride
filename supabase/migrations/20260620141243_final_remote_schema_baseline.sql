


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."can_edit_list"("lid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.todo_list_members m
    where m.list_id = lid
      and m.user_id = auth.uid()
      and m.role in ('owner','editor')
  );
$$;


ALTER FUNCTION "public"."can_edit_list"("lid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clerk_user_id"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;


ALTER FUNCTION "public"."clerk_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_list_with_owner"("list_name" "text") RETURNS TABLE("id" "uuid", "name" "text", "owner_id" "text", "inserted_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_list_with_owner"("list_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_default_inbox"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_user_id text := public.clerk_user_id();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return public.ensure_user_bootstrap(current_user_id, auth.jwt() ->> 'email');
end;
$$;


ALTER FUNCTION "public"."ensure_default_inbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_user_bootstrap"("target_user_id" "text", "target_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."ensure_user_bootstrap"("target_user_id" "text", "target_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_list_member"("target_list_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.todo_list_members members
    where members.list_id = target_list_id
      and members.user_id = public.clerk_user_id()
  );
$$;


ALTER FUNCTION "public"."is_list_member"("target_list_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_list_owner"("target_list_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.todo_lists lists
    where lists.id = target_list_id
      and lists.owner_id = public.clerk_user_id()
  );
$$;


ALTER FUNCTION "public"."is_list_owner"("target_list_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_planned_focus_blocks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_planned_focus_blocks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_planner_saved_filters_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_planner_saved_filters_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_labels_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_labels_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_saved_views_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_saved_views_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_todo_comments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."set_todo_comments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_todo_sections_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_todo_sections_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_todo_steps_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_todo_steps_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_weekly_commitments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."set_weekly_commitments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_todo_activity_event_list"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    task_list_id uuid;
begin
    select list_id
    into task_list_id
    from public.todos
    where id = new.todo_id;

    if task_list_id is null then
        raise exception 'Task % does not exist', new.todo_id;
    end if;

    if task_list_id <> new.list_id then
        raise exception 'Activity list % does not match task list %', new.list_id, task_list_id;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."validate_todo_activity_event_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_todo_assignee_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."validate_todo_assignee_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_todo_comment_list"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    task_list_id uuid;
begin
    select list_id
    into task_list_id
    from public.todos
    where id = new.todo_id;

    if task_list_id is null then
        raise exception 'Task % does not exist', new.todo_id;
    end if;

    if task_list_id <> new.list_id then
        raise exception 'Comment list % does not match task list %', new.list_id, task_list_id;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."validate_todo_comment_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_todo_section_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."validate_todo_section_assignment"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."focus_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "list_id" "uuid",
    "duration_seconds" integer NOT NULL,
    "mode" "text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "todo_id" "uuid",
    "planned_block_id" "uuid"
);

ALTER TABLE ONLY "public"."focus_sessions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."focus_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planned_focus_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "todo_id" "uuid",
    "title" "text" NOT NULL,
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planned_focus_blocks_time_order" CHECK (("scheduled_end" > "scheduled_start"))
);

ALTER TABLE ONLY "public"."planned_focus_blocks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."planned_focus_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planner_saved_filters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "list_id" "uuid",
    "planning_status_filter" "text" DEFAULT 'all'::"text" NOT NULL,
    "deadline_scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "default_view" "text" DEFAULT 'week'::"text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planner_saved_filters_deadline_scope_valid" CHECK (("deadline_scope" = ANY (ARRAY['all'::"text", 'overdue'::"text", 'today'::"text", 'due_soon'::"text", 'no_deadline'::"text"]))),
    CONSTRAINT "planner_saved_filters_default_view_valid" CHECK (("default_view" = ANY (ARRAY['day'::"text", 'week'::"text", 'month'::"text"]))),
    CONSTRAINT "planner_saved_filters_name_not_blank" CHECK (("length"("btrim"("name")) > 0)),
    CONSTRAINT "planner_saved_filters_planning_status_filter_valid" CHECK (("planning_status_filter" = ANY (ARRAY['all'::"text", 'unplanned'::"text", 'partially_planned'::"text", 'fully_planned'::"text", 'overplanned'::"text"])))
);


ALTER TABLE "public"."planner_saved_filters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "text" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "daily_focus_goal_minutes" integer DEFAULT 120 NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "accent_token" "text",
    "project_order_ids" "uuid"[],
    "default_block_minutes" integer,
    "week_starts_on" smallint,
    "planner_day_start_hour" smallint,
    "planner_day_end_hour" smallint,
    "is_compact_mode" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_accent_token_valid" CHECK ((("accent_token" IS NULL) OR ("accent_token" = ANY (ARRAY['blue'::"text", 'teal'::"text", 'green'::"text", 'amber'::"text", 'rose'::"text", 'slate'::"text"])))),
    CONSTRAINT "profiles_daily_focus_goal_minutes_positive" CHECK (("daily_focus_goal_minutes" > 0)),
    CONSTRAINT "profiles_default_block_minutes_valid" CHECK ((("default_block_minutes" IS NULL) OR (("default_block_minutes" >= 15) AND ("default_block_minutes" <= 240) AND ("mod"("default_block_minutes", 15) = 0)))),
    CONSTRAINT "profiles_planner_day_hours_valid" CHECK ((("planner_day_start_hour" IS NULL) OR ("planner_day_end_hour" IS NULL) OR (("planner_day_start_hour" >= 0) AND ("planner_day_start_hour" <= 23) AND ("planner_day_end_hour" >= 1) AND ("planner_day_end_hour" <= 24) AND ("planner_day_end_hour" > "planner_day_start_hour")))),
    CONSTRAINT "profiles_week_starts_on_valid" CHECK ((("week_starts_on" IS NULL) OR ("week_starts_on" = ANY (ARRAY[0, 1])))),
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color_token" "text" DEFAULT 'slate'::"text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_labels_color_token_valid" CHECK (("color_token" = ANY (ARRAY['cobalt'::"text", 'emerald'::"text", 'amber'::"text", 'rose'::"text", 'violet'::"text", 'slate'::"text"]))),
    CONSTRAINT "task_labels_name_not_blank" CHECK (("length"("btrim"("name")) > 0))
);


ALTER TABLE "public"."task_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_saved_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "smart_view" "text" DEFAULT 'today'::"text" NOT NULL,
    "list_id" "uuid",
    "priority_filter" "text" DEFAULT 'all'::"text" NOT NULL,
    "planning_status_filter" "text" DEFAULT 'all'::"text" NOT NULL,
    "deadline_scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "label_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_saved_views_deadline_scope_valid" CHECK (("deadline_scope" = ANY (ARRAY['all'::"text", 'overdue'::"text", 'today'::"text", 'due_soon'::"text", 'no_deadline'::"text"]))),
    CONSTRAINT "task_saved_views_name_not_blank" CHECK (("length"("btrim"("name")) > 0)),
    CONSTRAINT "task_saved_views_planning_status_filter_valid" CHECK (("planning_status_filter" = ANY (ARRAY['all'::"text", 'unplanned'::"text", 'partially_planned'::"text", 'fully_planned'::"text", 'overplanned'::"text"]))),
    CONSTRAINT "task_saved_views_priority_filter_valid" CHECK (("priority_filter" = ANY (ARRAY['all'::"text", 'none'::"text", 'high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "task_saved_views_smart_view_valid" CHECK (("smart_view" = ANY (ARRAY['today'::"text", 'upcoming'::"text", 'inbox'::"text", 'anytime'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."task_saved_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "todo_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "actor_user_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb",
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "todo_activity_events_event_type_valid" CHECK (("event_type" = ANY (ARRAY['task_created'::"text", 'task_completed'::"text", 'task_reopened'::"text", 'task_moved_section'::"text", 'task_reordered'::"text", 'task_assigned'::"text", 'comment_added'::"text"])))
);

ALTER TABLE ONLY "public"."todo_activity_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."todo_activity_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "todo_id" "uuid" NOT NULL,
    "list_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "body" "text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "todo_comments_body_not_blank" CHECK (("btrim"("body") <> ''::"text"))
);

ALTER TABLE ONLY "public"."todo_comments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."todo_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "todo_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "path" "text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "list_id" "uuid",
    "original_name" "text",
    "mime_type" "text",
    "size_bytes" bigint
);

ALTER TABLE ONLY "public"."todo_images" REPLICA IDENTITY FULL;


ALTER TABLE "public"."todo_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_label_links" (
    "todo_id" "uuid" NOT NULL,
    "label_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."todo_label_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_list_members" (
    "list_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "todo_list_members_role_valid" CHECK (("role" = ANY (ARRAY['owner'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."todo_list_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "text" NOT NULL,
    "name" "text" DEFAULT 'My List'::"text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color_token" "text" DEFAULT 'cobalt'::"text" NOT NULL,
    "icon_token" "text" DEFAULT 'book-open'::"text" NOT NULL
);


ALTER TABLE "public"."todo_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "todo_sections_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "todo_sections_position_nonnegative" CHECK (("position" >= 0))
);

ALTER TABLE ONLY "public"."todo_sections" REPLICA IDENTITY FULL;


ALTER TABLE "public"."todo_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "todo_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "todo_steps_position_nonnegative" CHECK (("position" >= 0)),
    CONSTRAINT "todo_steps_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE ONLY "public"."todo_steps" REPLICA IDENTITY FULL;


ALTER TABLE "public"."todo_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "list_id" "uuid",
    "description" "text",
    "due_date" timestamp with time zone,
    "priority" "text",
    "estimated_minutes" integer,
    "completed_at" timestamp with time zone,
    "section_id" "uuid",
    "deadline_on" "date",
    "deadline_at" timestamp with time zone,
    "recurrence_rule" "text",
    "reminder_offset_minutes" integer,
    "reminder_at" timestamp with time zone,
    "assignee_user_id" "text",
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "todos_estimated_minutes_positive" CHECK ((("estimated_minutes" IS NULL) OR ("estimated_minutes" > 0))),
    CONSTRAINT "todos_position_nonnegative" CHECK (("position" >= 0)),
    CONSTRAINT "todos_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "todos_recurrence_rule_check" CHECK ((("recurrence_rule" IS NULL) OR ("recurrence_rule" = ANY (ARRAY['daily'::"text", 'weekdays'::"text", 'weekly'::"text", 'monthly'::"text"])))),
    CONSTRAINT "todos_reminder_offset_minutes_nonnegative" CHECK ((("reminder_offset_minutes" IS NULL) OR ("reminder_offset_minutes" >= 0))),
    CONSTRAINT "todos_single_deadline_shape" CHECK (("num_nonnulls"("deadline_on", "deadline_at") <= 1))
);

ALTER TABLE ONLY "public"."todos" REPLICA IDENTITY FULL;


ALTER TABLE "public"."todos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_commitments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "week_start_on" "date" NOT NULL,
    "summary" "text",
    "target_focus_minutes" integer,
    "target_task_count" integer,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "weekly_commitments_target_focus_minutes_nonnegative" CHECK ((("target_focus_minutes" IS NULL) OR ("target_focus_minutes" >= 0))),
    CONSTRAINT "weekly_commitments_target_task_count_nonnegative" CHECK ((("target_task_count" IS NULL) OR ("target_task_count" >= 0)))
);


ALTER TABLE "public"."weekly_commitments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."weekly_leaderboard" AS
 SELECT "focus_sessions"."user_id",
    COALESCE("profiles"."username", "profiles"."full_name", "focus_sessions"."user_id") AS "username",
    "profiles"."avatar_url",
    ("sum"("round"((("focus_sessions"."duration_seconds")::numeric / (60)::numeric))))::integer AS "total_minutes"
   FROM ("public"."focus_sessions"
     LEFT JOIN "public"."profiles" ON (("profiles"."id" = "focus_sessions"."user_id")))
  WHERE (("focus_sessions"."mode" = 'focus'::"text") AND ("focus_sessions"."inserted_at" >= "date_trunc"('week'::"text", "now"())))
  GROUP BY "focus_sessions"."user_id", "profiles"."username", "profiles"."full_name", "profiles"."avatar_url";


ALTER VIEW "public"."weekly_leaderboard" OWNER TO "postgres";


ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_focus_blocks"
    ADD CONSTRAINT "planned_focus_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planner_saved_filters"
    ADD CONSTRAINT "planner_saved_filters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_saved_views"
    ADD CONSTRAINT "task_saved_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_activity_events"
    ADD CONSTRAINT "todo_activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_comments"
    ADD CONSTRAINT "todo_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_images"
    ADD CONSTRAINT "todo_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_label_links"
    ADD CONSTRAINT "todo_label_links_pkey" PRIMARY KEY ("todo_id", "label_id", "user_id");



ALTER TABLE ONLY "public"."todo_list_members"
    ADD CONSTRAINT "todo_list_members_pkey" PRIMARY KEY ("list_id", "user_id");



ALTER TABLE ONLY "public"."todo_lists"
    ADD CONSTRAINT "todo_lists_owner_name_unique" UNIQUE ("owner_id", "name");



ALTER TABLE ONLY "public"."todo_lists"
    ADD CONSTRAINT "todo_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_sections"
    ADD CONSTRAINT "todo_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_steps"
    ADD CONSTRAINT "todo_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_commitments"
    ADD CONSTRAINT "weekly_commitments_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_focus_sessions_mode_date" ON "public"."focus_sessions" USING "btree" ("mode", "inserted_at");



CREATE INDEX "idx_focus_sessions_user_inserted_at_desc" ON "public"."focus_sessions" USING "btree" ("user_id", "inserted_at" DESC);



CREATE INDEX "idx_focus_sessions_user_planned_block_id_inserted_at_desc" ON "public"."focus_sessions" USING "btree" ("user_id", "planned_block_id", "inserted_at" DESC) WHERE ("planned_block_id" IS NOT NULL);



CREATE INDEX "idx_focus_sessions_user_todo_id_inserted_at_desc" ON "public"."focus_sessions" USING "btree" ("user_id", "todo_id", "inserted_at" DESC) WHERE ("todo_id" IS NOT NULL);



CREATE INDEX "idx_planned_focus_blocks_list_scheduled_start" ON "public"."planned_focus_blocks" USING "btree" ("list_id", "scheduled_start");



CREATE INDEX "idx_planned_focus_blocks_todo_id" ON "public"."planned_focus_blocks" USING "btree" ("todo_id") WHERE ("todo_id" IS NOT NULL);



CREATE INDEX "idx_planned_focus_blocks_user_scheduled_start" ON "public"."planned_focus_blocks" USING "btree" ("user_id", "scheduled_start");



CREATE INDEX "idx_planner_saved_filters_user_id" ON "public"."planner_saved_filters" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_task_labels_user_id" ON "public"."task_labels" USING "btree" ("user_id", "updated_at" DESC);



CREATE UNIQUE INDEX "idx_task_labels_user_name_unique" ON "public"."task_labels" USING "btree" ("user_id", "lower"("name"));



CREATE INDEX "idx_task_saved_views_label_ids" ON "public"."task_saved_views" USING "gin" ("label_ids");



CREATE INDEX "idx_task_saved_views_user_id" ON "public"."task_saved_views" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_todo_activity_events_list_id_inserted_at_desc" ON "public"."todo_activity_events" USING "btree" ("list_id", "inserted_at" DESC);



CREATE INDEX "idx_todo_activity_events_todo_id_inserted_at_desc" ON "public"."todo_activity_events" USING "btree" ("todo_id", "inserted_at" DESC);



CREATE INDEX "idx_todo_comments_list_id_inserted_at_desc" ON "public"."todo_comments" USING "btree" ("list_id", "inserted_at" DESC);



CREATE INDEX "idx_todo_comments_todo_id_inserted_at" ON "public"."todo_comments" USING "btree" ("todo_id", "inserted_at");



CREATE INDEX "idx_todo_images_list_id" ON "public"."todo_images" USING "btree" ("list_id");



CREATE INDEX "idx_todo_images_todo_id" ON "public"."todo_images" USING "btree" ("todo_id");



CREATE INDEX "idx_todo_label_links_user_label" ON "public"."todo_label_links" USING "btree" ("user_id", "label_id", "inserted_at" DESC);



CREATE INDEX "idx_todo_label_links_user_todo" ON "public"."todo_label_links" USING "btree" ("user_id", "todo_id", "inserted_at" DESC);



CREATE INDEX "idx_todo_list_members_user_id" ON "public"."todo_list_members" USING "btree" ("user_id");



CREATE INDEX "idx_todo_lists_owner_id" ON "public"."todo_lists" USING "btree" ("owner_id");



CREATE INDEX "idx_todo_sections_list_id_position" ON "public"."todo_sections" USING "btree" ("list_id", "position", "inserted_at");



CREATE INDEX "idx_todo_steps_todo_id_position" ON "public"."todo_steps" USING "btree" ("todo_id", "position", "inserted_at");



CREATE INDEX "idx_todos_completed_at_desc" ON "public"."todos" USING "btree" ("completed_at" DESC) WHERE ("is_done" = true);



CREATE INDEX "idx_todos_list_done_deadline_at" ON "public"."todos" USING "btree" ("list_id", "is_done", "deadline_at");



CREATE INDEX "idx_todos_list_done_deadline_on" ON "public"."todos" USING "btree" ("list_id", "is_done", "deadline_on");



CREATE INDEX "idx_todos_list_done_due_date" ON "public"."todos" USING "btree" ("list_id", "is_done", "due_date");



CREATE INDEX "idx_todos_list_id" ON "public"."todos" USING "btree" ("list_id");



CREATE INDEX "idx_todos_list_id_assignee_user_id" ON "public"."todos" USING "btree" ("list_id", "assignee_user_id") WHERE ("assignee_user_id" IS NOT NULL);



CREATE INDEX "idx_todos_list_id_section_id" ON "public"."todos" USING "btree" ("list_id", "section_id");



CREATE INDEX "idx_todos_list_id_section_id_position" ON "public"."todos" USING "btree" ("list_id", "section_id", "position", "inserted_at");



CREATE INDEX "idx_todos_user_done_deadline_at" ON "public"."todos" USING "btree" ("user_id", "is_done", "deadline_at");



CREATE INDEX "idx_todos_user_done_deadline_on" ON "public"."todos" USING "btree" ("user_id", "is_done", "deadline_on");



CREATE INDEX "idx_todos_user_done_due_date" ON "public"."todos" USING "btree" ("user_id", "is_done", "due_date");



CREATE INDEX "idx_todos_user_id" ON "public"."todos" USING "btree" ("user_id");



CREATE INDEX "idx_todos_user_recurrence_rule" ON "public"."todos" USING "btree" ("user_id", "recurrence_rule") WHERE ("recurrence_rule" IS NOT NULL);



CREATE INDEX "idx_todos_user_reminder_at" ON "public"."todos" USING "btree" ("user_id", "reminder_at") WHERE (("reminder_at" IS NOT NULL) AND ("is_done" = false));



CREATE UNIQUE INDEX "idx_weekly_commitments_user_id_week_start_on" ON "public"."weekly_commitments" USING "btree" ("user_id", "week_start_on");



CREATE OR REPLACE TRIGGER "trg_planned_focus_blocks_updated_at" BEFORE UPDATE ON "public"."planned_focus_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_planned_focus_blocks_updated_at"();



CREATE OR REPLACE TRIGGER "trg_planner_saved_filters_updated_at" BEFORE UPDATE ON "public"."planner_saved_filters" FOR EACH ROW EXECUTE FUNCTION "public"."set_planner_saved_filters_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "trg_task_labels_updated_at" BEFORE UPDATE ON "public"."task_labels" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_labels_updated_at"();



CREATE OR REPLACE TRIGGER "trg_task_saved_views_updated_at" BEFORE UPDATE ON "public"."task_saved_views" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_saved_views_updated_at"();



CREATE OR REPLACE TRIGGER "trg_todo_comments_updated_at" BEFORE UPDATE ON "public"."todo_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_todo_comments_updated_at"();



CREATE OR REPLACE TRIGGER "trg_todo_sections_updated_at" BEFORE UPDATE ON "public"."todo_sections" FOR EACH ROW EXECUTE FUNCTION "public"."set_todo_sections_updated_at"();



CREATE OR REPLACE TRIGGER "trg_todo_steps_updated_at" BEFORE UPDATE ON "public"."todo_steps" FOR EACH ROW EXECUTE FUNCTION "public"."set_todo_steps_updated_at"();



CREATE OR REPLACE TRIGGER "trg_validate_todo_activity_event_list" BEFORE INSERT OR UPDATE OF "todo_id", "list_id" ON "public"."todo_activity_events" FOR EACH ROW EXECUTE FUNCTION "public"."validate_todo_activity_event_list"();



CREATE OR REPLACE TRIGGER "trg_validate_todo_assignee_membership" BEFORE INSERT OR UPDATE OF "list_id", "assignee_user_id" ON "public"."todos" FOR EACH ROW EXECUTE FUNCTION "public"."validate_todo_assignee_membership"();



CREATE OR REPLACE TRIGGER "trg_validate_todo_comment_list" BEFORE INSERT OR UPDATE OF "todo_id", "list_id" ON "public"."todo_comments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_todo_comment_list"();



CREATE OR REPLACE TRIGGER "trg_validate_todo_section_assignment" BEFORE INSERT OR UPDATE OF "list_id", "section_id" ON "public"."todos" FOR EACH ROW EXECUTE FUNCTION "public"."validate_todo_section_assignment"();



CREATE OR REPLACE TRIGGER "trg_weekly_commitments_updated_at" BEFORE UPDATE ON "public"."weekly_commitments" FOR EACH ROW EXECUTE FUNCTION "public"."set_weekly_commitments_updated_at"();



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_planned_block_id_fkey" FOREIGN KEY ("planned_block_id") REFERENCES "public"."planned_focus_blocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_focus_blocks"
    ADD CONSTRAINT "planned_focus_blocks_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_focus_blocks"
    ADD CONSTRAINT "planned_focus_blocks_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_focus_blocks"
    ADD CONSTRAINT "planned_focus_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planner_saved_filters"
    ADD CONSTRAINT "planner_saved_filters_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planner_saved_filters"
    ADD CONSTRAINT "planner_saved_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_saved_views"
    ADD CONSTRAINT "task_saved_views_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_saved_views"
    ADD CONSTRAINT "task_saved_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_activity_events"
    ADD CONSTRAINT "todo_activity_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_activity_events"
    ADD CONSTRAINT "todo_activity_events_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_activity_events"
    ADD CONSTRAINT "todo_activity_events_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_comments"
    ADD CONSTRAINT "todo_comments_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_comments"
    ADD CONSTRAINT "todo_comments_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_comments"
    ADD CONSTRAINT "todo_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_images"
    ADD CONSTRAINT "todo_images_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_images"
    ADD CONSTRAINT "todo_images_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_images"
    ADD CONSTRAINT "todo_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_label_links"
    ADD CONSTRAINT "todo_label_links_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."task_labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_label_links"
    ADD CONSTRAINT "todo_label_links_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_label_links"
    ADD CONSTRAINT "todo_label_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_list_members"
    ADD CONSTRAINT "todo_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_list_members"
    ADD CONSTRAINT "todo_list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_lists"
    ADD CONSTRAINT "todo_lists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_sections"
    ADD CONSTRAINT "todo_sections_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_steps"
    ADD CONSTRAINT "todo_steps_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."todo_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_commitments"
    ADD CONSTRAINT "weekly_commitments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Members can delete own todo images" ON "public"."todo_images" FOR DELETE TO "authenticated" USING ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Members can delete todos" ON "public"."todos" FOR DELETE TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Members can insert own todo images" ON "public"."todo_images" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Members can insert todos" ON "public"."todos" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id") AND (("assignee_user_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."todo_list_members" "members"
  WHERE (("members"."list_id" = "todos"."list_id") AND ("members"."user_id" = "todos"."assignee_user_id")))))));



CREATE POLICY "Members can update todos" ON "public"."todos" FOR UPDATE TO "authenticated" USING ("public"."is_list_member"("list_id")) WITH CHECK (("public"."is_list_member"("list_id") AND (("assignee_user_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."todo_list_members" "members"
  WHERE (("members"."list_id" = "todos"."list_id") AND ("members"."user_id" = "todos"."assignee_user_id")))))));



CREATE POLICY "Members can view list memberships" ON "public"."todo_list_members" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Members can view lists" ON "public"."todo_lists" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("id"));



CREATE POLICY "Members can view todo images" ON "public"."todo_images" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Members can view todos" ON "public"."todos" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Owners and members can delete list memberships" ON "public"."todo_list_members" FOR DELETE TO "authenticated" USING (("public"."is_list_owner"("list_id") OR ("public"."clerk_user_id"() = "user_id")));



CREATE POLICY "Owners can add list memberships" ON "public"."todo_list_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_list_owner"("list_id"));



CREATE POLICY "Owners can delete lists" ON "public"."todo_lists" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "owner_id"));



CREATE POLICY "Owners can update list memberships" ON "public"."todo_list_members" FOR UPDATE TO "authenticated" USING ("public"."is_list_owner"("list_id")) WITH CHECK ("public"."is_list_owner"("list_id"));



CREATE POLICY "Owners can update lists" ON "public"."todo_lists" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "owner_id")) WITH CHECK (("public"."clerk_user_id"() = "owner_id"));



CREATE POLICY "Users can create owned lists" ON "public"."todo_lists" FOR INSERT TO "authenticated" WITH CHECK (("public"."clerk_user_id"() = "owner_id"));



CREATE POLICY "Users can delete own focus sessions" ON "public"."focus_sessions" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete own planned focus blocks" ON "public"."planned_focus_blocks" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete own planner saved filters" ON "public"."planner_saved_filters" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete own task comments or owned-project comments" ON "public"."todo_comments" FOR DELETE TO "authenticated" USING (("public"."is_list_member"("list_id") AND (("public"."clerk_user_id"() = "user_id") OR "public"."is_list_owner"("list_id"))));



CREATE POLICY "Users can delete own task labels" ON "public"."task_labels" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete own task saved views" ON "public"."task_saved_views" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete own todo label links" ON "public"."todo_label_links" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete own weekly commitments" ON "public"."weekly_commitments" FOR DELETE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can delete sections in shared lists" ON "public"."todo_sections" FOR DELETE TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Users can delete task steps in shared lists" ON "public"."todo_steps" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."todos"
  WHERE (("todos"."id" = "todo_steps"."todo_id") AND "public"."is_list_member"("todos"."list_id")))));



CREATE POLICY "Users can insert own focus sessions" ON "public"."focus_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND (("list_id" IS NULL) OR "public"."is_list_member"("list_id"))));



CREATE POLICY "Users can insert own planned focus blocks" ON "public"."planned_focus_blocks" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Users can insert own planner saved filters" ON "public"."planner_saved_filters" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND (("list_id" IS NULL) OR "public"."is_list_member"("list_id"))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."clerk_user_id"() = "id"));



CREATE POLICY "Users can insert own task labels" ON "public"."task_labels" FOR INSERT TO "authenticated" WITH CHECK (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can insert own task saved views" ON "public"."task_saved_views" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND (("list_id" IS NULL) OR "public"."is_list_member"("list_id")) AND (NOT (EXISTS ( SELECT 1
   FROM ("unnest"("task_saved_views"."label_ids") "label_id"("label_id")
     LEFT JOIN "public"."task_labels" "labels" ON ((("labels"."id" = "label_id"."label_id") AND ("labels"."user_id" = "public"."clerk_user_id"()))))
  WHERE ("labels"."id" IS NULL))))));



CREATE POLICY "Users can insert own todo label links" ON "public"."todo_label_links" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."task_labels" "labels"
  WHERE (("labels"."id" = "todo_label_links"."label_id") AND ("labels"."user_id" = "public"."clerk_user_id"())))) AND (EXISTS ( SELECT 1
   FROM "public"."todos" "todos"
  WHERE (("todos"."id" = "todo_label_links"."todo_id") AND "public"."is_list_member"("todos"."list_id"))))));



CREATE POLICY "Users can insert own weekly commitments" ON "public"."weekly_commitments" FOR INSERT TO "authenticated" WITH CHECK (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can insert sections in shared lists" ON "public"."todo_sections" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_list_member"("list_id"));



CREATE POLICY "Users can insert task activity in shared lists" ON "public"."todo_activity_events" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "actor_user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Users can insert task comments in shared lists" ON "public"."todo_comments" FOR INSERT TO "authenticated" WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Users can insert task steps in shared lists" ON "public"."todo_steps" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."todos"
  WHERE (("todos"."id" = "todo_steps"."todo_id") AND "public"."is_list_member"("todos"."list_id")))));



CREATE POLICY "Users can update own planned focus blocks" ON "public"."planned_focus_blocks" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id")) WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Users can update own planner saved filters" ON "public"."planner_saved_filters" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id")) WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND (("list_id" IS NULL) OR "public"."is_list_member"("list_id"))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "id")) WITH CHECK (("public"."clerk_user_id"() = "id"));



CREATE POLICY "Users can update own task comments" ON "public"."todo_comments" FOR UPDATE TO "authenticated" USING ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id"))) WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND "public"."is_list_member"("list_id")));



CREATE POLICY "Users can update own task labels" ON "public"."task_labels" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id")) WITH CHECK (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can update own task saved views" ON "public"."task_saved_views" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id")) WITH CHECK ((("public"."clerk_user_id"() = "user_id") AND (("list_id" IS NULL) OR "public"."is_list_member"("list_id")) AND (NOT (EXISTS ( SELECT 1
   FROM ("unnest"("task_saved_views"."label_ids") "label_id"("label_id")
     LEFT JOIN "public"."task_labels" "labels" ON ((("labels"."id" = "label_id"."label_id") AND ("labels"."user_id" = "public"."clerk_user_id"()))))
  WHERE ("labels"."id" IS NULL))))));



CREATE POLICY "Users can update own weekly commitments" ON "public"."weekly_commitments" FOR UPDATE TO "authenticated" USING (("public"."clerk_user_id"() = "user_id")) WITH CHECK (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can update sections in shared lists" ON "public"."todo_sections" FOR UPDATE TO "authenticated" USING ("public"."is_list_member"("list_id")) WITH CHECK ("public"."is_list_member"("list_id"));



CREATE POLICY "Users can update task steps in shared lists" ON "public"."todo_steps" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."todos"
  WHERE (("todos"."id" = "todo_steps"."todo_id") AND "public"."is_list_member"("todos"."list_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."todos"
  WHERE (("todos"."id" = "todo_steps"."todo_id") AND "public"."is_list_member"("todos"."list_id")))));



CREATE POLICY "Users can view own focus sessions" ON "public"."focus_sessions" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view own planned focus blocks" ON "public"."planned_focus_blocks" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view own planner saved filters" ON "public"."planner_saved_filters" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view own task labels" ON "public"."task_labels" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view own task saved views" ON "public"."task_saved_views" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view own todo label links" ON "public"."todo_label_links" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view own weekly commitments" ON "public"."weekly_commitments" FOR SELECT TO "authenticated" USING (("public"."clerk_user_id"() = "user_id"));



CREATE POLICY "Users can view sections in shared lists" ON "public"."todo_sections" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Users can view task activity in shared lists" ON "public"."todo_activity_events" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Users can view task comments in shared lists" ON "public"."todo_comments" FOR SELECT TO "authenticated" USING ("public"."is_list_member"("list_id"));



CREATE POLICY "Users can view task steps in shared lists" ON "public"."todo_steps" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."todos"
  WHERE (("todos"."id" = "todo_steps"."todo_id") AND "public"."is_list_member"("todos"."list_id")))));



ALTER TABLE "public"."focus_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planned_focus_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planner_saved_filters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_saved_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_activity_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_label_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_commitments" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."focus_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."planned_focus_blocks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todo_activity_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todo_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todo_images";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todo_sections";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todo_steps";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."todos";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


























































































































































































GRANT ALL ON FUNCTION "public"."can_edit_list"("lid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_list"("lid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_list"("lid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."clerk_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."clerk_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clerk_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_list_with_owner"("list_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_list_with_owner"("list_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_list_with_owner"("list_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_default_inbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_default_inbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_default_inbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_bootstrap"("target_user_id" "text", "target_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_bootstrap"("target_user_id" "text", "target_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_bootstrap"("target_user_id" "text", "target_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_list_member"("target_list_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_list_member"("target_list_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_list_member"("target_list_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_list_owner"("target_list_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_list_owner"("target_list_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_list_owner"("target_list_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_planned_focus_blocks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_planned_focus_blocks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_planned_focus_blocks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_planner_saved_filters_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_planner_saved_filters_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_planner_saved_filters_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_labels_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_labels_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_labels_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_saved_views_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_saved_views_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_saved_views_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_todo_comments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_todo_comments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_todo_comments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_todo_sections_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_todo_sections_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_todo_sections_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_todo_steps_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_todo_steps_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_todo_steps_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_weekly_commitments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_weekly_commitments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_weekly_commitments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_todo_activity_event_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_todo_activity_event_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_todo_activity_event_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_todo_assignee_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_todo_assignee_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_todo_assignee_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_todo_comment_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_todo_comment_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_todo_comment_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_todo_section_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_todo_section_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_todo_section_assignment"() TO "service_role";
























GRANT ALL ON TABLE "public"."focus_sessions" TO "anon";
GRANT ALL ON TABLE "public"."focus_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."planned_focus_blocks" TO "anon";
GRANT ALL ON TABLE "public"."planned_focus_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_focus_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."planner_saved_filters" TO "anon";
GRANT ALL ON TABLE "public"."planner_saved_filters" TO "authenticated";
GRANT ALL ON TABLE "public"."planner_saved_filters" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."task_labels" TO "anon";
GRANT ALL ON TABLE "public"."task_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."task_labels" TO "service_role";



GRANT ALL ON TABLE "public"."task_saved_views" TO "anon";
GRANT ALL ON TABLE "public"."task_saved_views" TO "authenticated";
GRANT ALL ON TABLE "public"."task_saved_views" TO "service_role";



GRANT ALL ON TABLE "public"."todo_activity_events" TO "anon";
GRANT ALL ON TABLE "public"."todo_activity_events" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_activity_events" TO "service_role";



GRANT ALL ON TABLE "public"."todo_comments" TO "anon";
GRANT ALL ON TABLE "public"."todo_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_comments" TO "service_role";



GRANT ALL ON TABLE "public"."todo_images" TO "anon";
GRANT ALL ON TABLE "public"."todo_images" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_images" TO "service_role";



GRANT ALL ON TABLE "public"."todo_label_links" TO "anon";
GRANT ALL ON TABLE "public"."todo_label_links" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_label_links" TO "service_role";



GRANT ALL ON TABLE "public"."todo_list_members" TO "anon";
GRANT ALL ON TABLE "public"."todo_list_members" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_list_members" TO "service_role";



GRANT ALL ON TABLE "public"."todo_lists" TO "anon";
GRANT ALL ON TABLE "public"."todo_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_lists" TO "service_role";



GRANT ALL ON TABLE "public"."todo_sections" TO "anon";
GRANT ALL ON TABLE "public"."todo_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_sections" TO "service_role";



GRANT ALL ON TABLE "public"."todo_steps" TO "anon";
GRANT ALL ON TABLE "public"."todo_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_steps" TO "service_role";



GRANT ALL ON TABLE "public"."todos" TO "anon";
GRANT ALL ON TABLE "public"."todos" TO "authenticated";
GRANT ALL ON TABLE "public"."todos" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_commitments" TO "anon";
GRANT ALL ON TABLE "public"."weekly_commitments" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_commitments" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."weekly_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_leaderboard" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Public can view profile avatars"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'profile-avatars'::text));



  create policy "Users can delete own profile avatars"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = public.clerk_user_id())));



  create policy "Users can upload own profile avatars"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = public.clerk_user_id())));



  create policy "delete_own_folder"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'todo-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "read_own_folder"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'todo-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "upload_own_folder"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'todo-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



