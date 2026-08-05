-- ============================================================================
--  0010_post_content_seo.sql — editorial metadata for useful, connected posts.
--
--  These fields describe an article's topic and search intent. They are not
--  ranking tricks: category/tags create useful reader paths, while the brief
--  keeps a post focused before it is written. Existing posts stay valid and
--  retain empty values until an editor updates them.
-- ============================================================================

alter table public.posts
  add column if not exists category text not null default '',
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists primary_query text not null default '',
  add column if not exists target_location text not null default '',
  add column if not exists search_intent text not null default '',
  add column if not exists reader_goal text not null default '';

alter table public.posts
  drop constraint if exists posts_tags_are_array;

alter table public.posts
  add constraint posts_tags_are_array check (jsonb_typeof(tags) = 'array');

comment on column public.posts.category is
  'Reader-facing article category, used to group related planning guides.';
comment on column public.posts.tags is
  'Reader-facing topic labels, stored as a JSON array of short strings.';
comment on column public.posts.primary_query is
  'Editorial brief: the main question or search phrase the article answers.';
comment on column public.posts.target_location is
  'Editorial brief: the geographic context that must be useful to readers.';
comment on column public.posts.search_intent is
  'Editorial brief: informational, local planning, or commercial research.';
comment on column public.posts.reader_goal is
  'Editorial brief: the decision or task the reader should complete.';
