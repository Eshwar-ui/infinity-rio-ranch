-- ============================================================================
--  0008_posts.sql — the blog.
--
--  One table. A post carries its own SEO overrides, an FAQ block and an
--  optional CTA override, because the whole point is that the owner can publish
--  a search-optimised article without a developer touching src/lib/seo.ts.
--
--  Reads the house RLS pattern: the public sees published rows, is_admin()
--  writes. Note `published` defaults to FALSE here, unlike every other content
--  table — a half-written article that goes live the moment it is created is a
--  worse failure than one that needs an extra click.
--
--  Cover images go in the existing public `gallery` storage bucket (0001). It
--  already has the four policies, and the gallery *editor* lists rows from the
--  gallery *table*, so blog covers never show up there.
-- ============================================================================

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),

  -- Lowercase kebab, enforced here so a bad slug can't reach the router or the
  -- prerenderer (which turns it into a directory name in dist/).
  slug            text not null unique
                    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title           text not null check (length(btrim(title)) > 0),

  -- Card copy on /blog, and the fallback meta description.
  excerpt         text not null default '',
  body            text not null default '',        -- markdown

  cover_image     text,
  cover_alt       text not null default '',

  -- Empty means "use the title / excerpt". Never rendered raw — see seo.ts.
  seo_title       text not null default '',
  seo_description text not null default '',

  author          text not null default '',

  /*
   * Per-post FAQ, emitted as both a visible block and FAQPage JSON-LD.
   * Held as jsonb rather than a child table: it is always read and written with
   * its parent, never queried across posts, and never independently sorted —
   * a join here would buy nothing and cost the snapshot an extra select.
   * Shape: [{"q": "...", "a": "..."}]
   */
  faqs            jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(faqs) = 'array'),

  -- Optional overrides for the closing call-to-action. Blank = the site default,
  -- which reads the phone number from the CMS rather than hardcoding it.
  cta_heading     text not null default '',
  cta_body        text not null default '',

  published       boolean not null default false,
  published_at    timestamptz,

  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  published_at is owned by the database, not the client.
--
--  It is the post's real publication date: it appears in the byline, in
--  BlogPosting.datePublished and it orders /blog. Letting the admin UI set it
--  means every "unpublish, fix a typo, republish" cycle silently re-dates the
--  article and tells Google the content is newer than it is. So: stamped once,
--  the first time the post actually goes live, and left alone afterwards.
-- ----------------------------------------------------------------------------
create or replace function public.stamp_published_at()
returns trigger language plpgsql as $$
begin
  if new.published and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end $$;

drop trigger if exists posts_stamp_published_at on public.posts;
create trigger posts_stamp_published_at
  before insert or update on public.posts
  for each row execute function public.stamp_published_at();

-- updated_at, matching 0002_hardening.sql. This one is load-bearing beyond
-- bookkeeping: sitemap.xml takes each post's <lastmod> from it.
drop trigger if exists touch_posts on public.posts;
create trigger touch_posts
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- The public list query: published, newest first.
create index if not exists posts_published_at_idx
  on public.posts (published, published_at desc);

-- ----------------------------------------------------------------------------
--  RLS — the house pattern.
-- ----------------------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists "public reads published" on public.posts;
create policy "public reads published"
  on public.posts for select
  using (published = true);

drop policy if exists "admins do everything" on public.posts;
create policy "admins do everything"
  on public.posts for all
  using (public.is_admin()) with check (public.is_admin());
