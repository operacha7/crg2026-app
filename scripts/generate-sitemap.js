// scripts/generate-sitemap.js
// Build-time sitemap generator. Runs as a `prebuild` hook so the published
// sitemap reflects the live set of /assistance/[slug] pages without anyone
// having to remember to hand-edit public/sitemap.xml.
//
// Output: public/sitemap.xml. Vite's build copies public/* into the dist
// (build/) output, so writing here is enough — no separate post-build step.
//
// Failure mode: if Supabase isn't reachable (e.g. env vars not set in the
// Cloudflare Pages build environment), the script logs a warning and exits
// 0. The committed public/sitemap.xml then ships as-is. The build never
// fails because of sitemap regeneration.
//
// Required env vars in .env (or the build environment):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY  (anon/publishable; this is read-only data)

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SITE_URL = 'https://crghouston.org';
const OUTPUT_PATH = path.resolve(__dirname, '../public/sitemap.xml');

// Static public routes. /announcements and /reports are auth-gated and stay
// out of the sitemap.
const STATIC_URLS = [
  { loc: '/',         changefreq: 'weekly',  priority: '1.0' },
  { loc: '/about',    changefreq: 'monthly', priority: '0.7' },
  { loc: '/find',     changefreq: 'weekly',  priority: '0.8' },
  { loc: '/support',  changefreq: 'yearly',  priority: '0.3' },
  { loc: '/privacy',  changefreq: 'yearly',  priority: '0.3' },
  { loc: '/terms',    changefreq: 'yearly',  priority: '0.3' },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderUrl({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(SITE_URL + loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

async function fetchAssistanceSlugs() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set');
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('assistance')
    .select('url_slug, assistance')
    .order('assist_id', { ascending: true });
  if (error) throw error;
  // "Other" is intentionally excluded from indexable URLs — it's a catch-all,
  // not a category users would search for.
  return (data || [])
    .filter((r) => r.url_slug && r.assistance && r.assistance.toLowerCase() !== 'other')
    .map((r) => r.url_slug);
}

async function main() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let slugs = [];
  try {
    slugs = await fetchAssistanceSlugs();
    console.log(`generate-sitemap: fetched ${slugs.length} assistance slugs from Supabase`);
  } catch (err) {
    console.warn(`generate-sitemap: skipping regeneration — ${err.message}`);
    console.warn('generate-sitemap: existing public/sitemap.xml will ship as-is');
    process.exit(0);
  }

  const urls = [
    ...STATIC_URLS.map((u) => ({ ...u, lastmod: today })),
    ...slugs.map((slug) => ({
      loc: `/assistance/${slug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.8',
    })),
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(renderUrl).join('\n') +
    '\n</urlset>\n';

  fs.writeFileSync(OUTPUT_PATH, xml);
  console.log(`generate-sitemap: wrote ${urls.length} URLs to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('generate-sitemap: unexpected error', err);
  // Still exit 0 so CI builds don't break on sitemap issues.
  process.exit(0);
});
