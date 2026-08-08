-- ============================================================================
--  Second blog post — "Luxury Wedding Venue Near Austin".
--  Run AFTER supabase/migrations/0008_posts.sql and 0010_post_content_seo.sql.
--
--  This is a ONE-OFF seed, not a migration. Do not move it into
--  supabase/migrations/: it is content, and the owner edits it in /admin/blog
--  afterwards. Re-running it upserts on slug and stomps those edits.
--
--  Note what is deliberately NOT in the markdown body:
--    * the table of contents — blog-post.tsx derives it from the ## headings;
--    * the FAQ block — it lives in `faqs` below, which renders as the visible
--      accordion AND the FAQPage JSON-LD. Google drops the rich result when the
--      two disagree, so there has to be exactly one source;
--    * the closing CTA and the phone number — cta_heading/cta_body drive that
--      section, and the phone is read live from the CMS so editing it once
--      moves it everywhere.
--  Typing any of the three into the body renders it twice.
--
--  published = true, so it goes live at the next build. published_at is stamped
--  by the DB trigger on first publish and is never set here.
-- ============================================================================

insert into public.posts (
  slug, title, excerpt, body,
  cover_image, cover_alt,
  seo_title, seo_description,
  category, tags,
  primary_query, target_location, search_intent, reader_goal,
  faqs, cta_heading, cta_body, published
) values (
  'luxury-wedding-venue-near-austin',
  'Luxury Wedding Venue Near Austin: Celebrate Your Dream Wedding in Style',
  'Elegant indoor and outdoor spaces, premium amenities, and Hill Country scenery a short drive from Austin. What separates a genuinely luxurious wedding venue from one that only says so.',

$md$Planning your wedding is one of the most exciting milestones in life, and the venue is the decision every other choice hangs off. If you are searching for a **luxury wedding venue near Austin**, you want more than a beautiful location — you want exceptional service, elegant surroundings, premium amenities, and a day that reflects your own story.

Set in the scenic Texas Hill Country, Infinity at Rio Ranch pairs timeless elegance with modern comfort. A short drive from Austin, it suits intimate ceremonies, grand receptions, and everything in between, surrounded by open sky and mature trees.

Whether you picture a romantic outdoor ceremony beneath the Texas sky or an elegant indoor reception with family and friends, the venue offers the balance of luxury, comfort, and convenience that makes a wedding day feel effortless.

## Why Choose a Luxury Wedding Venue Near Austin?

Austin has become one of Texas' most sought-after wedding destinations. Couples from across the state and beyond choose the area because it offers vibrant city access alongside the quieter charm of the Hill Country.

A luxury wedding venue near Austin gives you:

- **Hill Country scenery** — open sky, mature trees, and the light that makes Texas wedding photography what it is.
- **Airport convenience** — an easy drive from Austin-Bergstrom International for guests flying in.
- **Nearby accommodation** — hotel options your out-of-town guests already recognize.
- **Sunset photography** — golden hour across open land rather than between buildings.
- **A private event space** — one celebration at a time, not a shared parking lot or sightline.
- **Professional coordination** — a team that has run the day before, not just rented you the room.

Instead of planning around downtown congestion, loading restrictions, and street parking, couples get a calm setting that is still close to everything Austin offers.

## What Defines a Luxury Wedding Experience?

Luxury is not really about decor. It is about a day where every detail has already been thought through, so nothing needs solving while you are in your dress.

### Elegant Indoor Reception Hall

A well-designed indoor reception space gives you climate-controlled comfort, high ceilings, considered lighting, and seating that flexes between an intimate dinner and a full reception.

### Scenic Outdoor Ceremony Spaces

Outdoor ceremonies are what couples remember. Exchanging vows surrounded by greenery, mature trees, and panoramic Hill Country views gives the moment a setting no room can imitate.

### Exceptional Guest Experience

A venue is really measured by how the day feels for the guests who are not the couple:

- Spacious on-site parking
- Accessible facilities and level paths
- Comfortable seating, indoors and out
- Considered landscaping throughout
- Staff on hand for the whole event

### A Dedicated Wedding Team

An experienced venue team coordinates timelines, vendor access, and event logistics. That is the difference between enjoying your wedding and running it.

## Indoor and Outdoor Wedding Spaces for Every Celebration

Texas weather is not optional to plan around. Spring storms and August heat are both on the calendar, so flexibility is not a premium extra — it is what protects the day you have paid for.

Infinity at Rio Ranch offers elegant indoor and outdoor event spaces together, so your plan never depends on the forecast:

- A ceremony lawn
- An indoor reception hall
- A spacious outdoor terrace
- Photography locations in both
- A private bridal preparation suite
- Layouts that adapt to your guest count

Ceremony outside, dinner and dancing inside, and a real answer if the sky changes its mind. The [venue gallery](/gallery) shows how the spaces sit together.

## Why Liberty Hill Is One of the Best Wedding Destinations Near Austin

Just northwest of Austin, Liberty Hill has become a favorite for couples who want a more private and more picturesque wedding.

The area offers:

- Peaceful Hill Country landscapes
- Wide-open outdoor space
- Genuinely scenic surroundings for photography
- Easy highway access
- A short, simple drive from Austin

Unlike a crowded city venue, Liberty Hill gives couples and guests an exclusive atmosphere with room to actually enjoy the celebration.

## Why Infinity at Rio Ranch Is the Perfect Luxury Wedding Venue Near Austin

Infinity at Rio Ranch was built for celebrations rather than adapted into one. The venue offers:

- Two beautifully landscaped acres
- A 2,600 sq. ft. indoor reception hall
- 12,400 sq. ft. of outdoor event space
- An elegant ceremony lawn
- A modern bridal suite
- A spacious terrace
- Professional event coordination
- Private on-site parking
- Indoor and outdoor photography locations

Whether you are planning an intimate gathering or a large wedding, the venue has the range to hold it, and our team works closely with every couple from the first tour to the last dance so the details are settled long before the day arrives.

If you are still comparing options, our guide to [choosing the best wedding and event center in Texas](/blog/best-wedding-event-center-in-texas) covers the questions worth asking every venue on your shortlist.

## Tips for Planning a Luxury Wedding

1. Book your venue 9–12 months in advance.
2. Schedule a venue tour before making your final decision.
3. Choose a venue with both indoor and outdoor options.
4. Confirm guest capacity and the amenities actually included.
5. Ask about preferred vendors and event coordination services.
6. Plan accommodation and transport for out-of-town guests.
7. Visit in the same season as your wedding date, so you see the real light and weather.

Choosing the venue early gives you more flexibility with every other vendor, and keeps the day aligned with what you first pictured.$md$,

  /*
   * "Sunset Vows" from the venue gallery — an outdoor ceremony at golden hour,
   * which is the promise this article opens with. Deliberately NOT post #1's
   * cover (DSC3669-2, the reception hall): two articles sharing one hero read
   * as the same page in a search result and in the /blog grid.
   *
   * 1600px wide per src/lib/image-sources.json. The cover renders up to 980px
   * CSS, so anything under ~1200px upscales and looks soft on a retina screen.
   * Check the `w` value there before swapping this for another photo.
   */
  '/assets/site/DSC3699-2.jpg',
  'Couple exchanging vows on the outdoor ceremony lawn at sunset at Infinity at Rio Ranch, Liberty Hill, Texas',

  'Luxury Wedding Venue Near Austin | Infinity at Rio Ranch',
  'Looking for a luxury wedding venue near Austin? Discover why Infinity at Rio Ranch in Liberty Hill offers elegant indoor and outdoor spaces, premium amenities, and unforgettable wedding experiences.',

  'Venue planning',
  '["Luxury weddings","Liberty Hill","Austin weddings"]'::jsonb,

  -- Editorial brief (0010). Not rendered anywhere — it keeps the article's
  -- target intact for whoever edits it next.
  'Luxury wedding venue near Austin',
  'Liberty Hill, TX — Greater Austin',
  'Commercial research',
  'Shortlist a luxury venue near Austin and book a private tour',

$json$[
  {
    "q": "What makes a wedding venue luxurious?",
    "a": "A luxury wedding venue combines elegant architecture, premium amenities, exceptional service, beautiful surroundings, and flexible indoor and outdoor spaces, so the whole day runs as one seamless experience rather than a series of rented hours."
  },
  {
    "q": "How far is Infinity at Rio Ranch from Austin?",
    "a": "Infinity at Rio Ranch is in Liberty Hill, Texas, just northwest of Austin and a short drive from the city, which makes it convenient for both local weddings and destination weddings with guests flying into Austin-Bergstrom International."
  },
  {
    "q": "Does Infinity at Rio Ranch offer indoor and outdoor wedding spaces?",
    "a": "Yes. The venue has a 2,600 square foot indoor reception hall and 12,400 square feet of outdoor space, including a ceremony lawn and terrace, so couples can hold the ceremony outside and the reception inside in any season."
  },
  {
    "q": "Can the venue accommodate large wedding receptions?",
    "a": "Yes. Infinity at Rio Ranch spans two landscaped acres with flexible indoor and outdoor areas, making it suitable for intimate ceremonies as well as large receptions."
  },
  {
    "q": "When should I book my luxury wedding venue?",
    "a": "Most luxury wedding venues near Austin should be reserved 9 to 14 months in advance, particularly for popular spring and fall dates, so it is worth scheduling a tour as early as possible."
  }
]$json$::jsonb,

  'Schedule Your Private Venue Tour',
  'Your dream wedding deserves a venue that reflects your style and your vision. Walk the ceremony lawn, the reception hall, and the terrace yourself, and start planning the wedding you have always imagined.',
  true
)
on conflict (slug) do update set
  title           = excluded.title,
  excerpt         = excluded.excerpt,
  body            = excluded.body,
  cover_image     = excluded.cover_image,
  cover_alt       = excluded.cover_alt,
  seo_title       = excluded.seo_title,
  seo_description = excluded.seo_description,
  category        = excluded.category,
  tags            = excluded.tags,
  primary_query   = excluded.primary_query,
  target_location = excluded.target_location,
  search_intent   = excluded.search_intent,
  reader_goal     = excluded.reader_goal,
  faqs            = excluded.faqs,
  cta_heading     = excluded.cta_heading,
  cta_body        = excluded.cta_body,
  published       = excluded.published;
