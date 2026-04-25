-- Remove the retired Someday system label and normalize any saved views that
-- still point at the removed smart view.

update public.task_saved_views
set smart_view = 'today'
where smart_view = 'someday';

alter table public.task_saved_views
  drop constraint if exists task_saved_views_smart_view_valid;

alter table public.task_saved_views
  add constraint task_saved_views_smart_view_valid
  check (smart_view in ('today', 'upcoming', 'inbox', 'anytime', 'done'));

delete from public.todo_label_links
where label_id in (
  select id
  from public.task_labels
  where lower(btrim(name)) = '__someday'
);

delete from public.task_labels
where lower(btrim(name)) = '__someday';
