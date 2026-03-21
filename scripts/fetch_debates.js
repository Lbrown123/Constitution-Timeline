#!/usr/bin/env node
// fetch_debates.js
// Scrapes Madison's debate notes from Yale Avalon and saves them as JSON files.
// Requires Node 18+ (built-in fetch). No npm dependencies.
//
// Usage:
//   node scripts/fetch_debates.js           # fetch all missing days
//   node scripts/fetch_debates.js --force   # re-fetch everything
//   node scripts/fetch_debates.js --manifest-only  # regenerate manifest.json without fetching

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BASE_URL = 'https://avalon.law.yale.edu/18th_century/';
const DELAY_MS = 1500;
const FORCE = process.argv.includes('--force');
const MANIFEST_ONLY = process.argv.includes('--manifest-only');

// Complete list of all 87 debate day entries
const DAYS = [
  { id: 'debates_514525', dates: ['1787-05-14', '1787-05-25'], label: 'May 14 & 25',   month: 5, notable: 'Convention opens; quorum achieved May 25' },
  { id: 'debates_528',    dates: ['1787-05-28'], label: 'May 28',    month: 5, notable: null },
  { id: 'debates_529',    dates: ['1787-05-29'], label: 'May 29',    month: 5, notable: 'Virginia Plan introduced' },
  { id: 'debates_530',    dates: ['1787-05-30'], label: 'May 30',    month: 5, notable: null },
  { id: 'debates_531',    dates: ['1787-05-31'], label: 'May 31',    month: 5, notable: null },
  { id: 'debates_601',    dates: ['1787-06-01'], label: 'June 1',    month: 6, notable: null },
  { id: 'debates_602',    dates: ['1787-06-02'], label: 'June 2',    month: 6, notable: null },
  { id: 'debates_604',    dates: ['1787-06-04'], label: 'June 4',    month: 6, notable: null },
  { id: 'debates_605',    dates: ['1787-06-05'], label: 'June 5',    month: 6, notable: null },
  { id: 'debates_606',    dates: ['1787-06-06'], label: 'June 6',    month: 6, notable: null },
  { id: 'debates_607',    dates: ['1787-06-07'], label: 'June 7',    month: 6, notable: null },
  { id: 'debates_608',    dates: ['1787-06-08'], label: 'June 8',    month: 6, notable: null },
  { id: 'debates_609',    dates: ['1787-06-09'], label: 'June 9',    month: 6, notable: null },
  { id: 'debates_611',    dates: ['1787-06-11'], label: 'June 11',   month: 6, notable: null },
  { id: 'debates_612',    dates: ['1787-06-12'], label: 'June 12',   month: 6, notable: null },
  { id: 'debates_613',    dates: ['1787-06-13'], label: 'June 13',   month: 6, notable: null },
  { id: 'debates_614',    dates: ['1787-06-14'], label: 'June 14',   month: 6, notable: null },
  { id: 'debates_615',    dates: ['1787-06-15'], label: 'June 15',   month: 6, notable: 'New Jersey Plan introduced' },
  { id: 'debates_616',    dates: ['1787-06-16'], label: 'June 16',   month: 6, notable: null },
  { id: 'debates_618',    dates: ['1787-06-18'], label: 'June 18',   month: 6, notable: null },
  { id: 'debates_619',    dates: ['1787-06-19'], label: 'June 19',   month: 6, notable: null },
  { id: 'debates_620',    dates: ['1787-06-20'], label: 'June 20',   month: 6, notable: null },
  { id: 'debates_621',    dates: ['1787-06-21'], label: 'June 21',   month: 6, notable: null },
  { id: 'debates_622',    dates: ['1787-06-22'], label: 'June 22',   month: 6, notable: null },
  { id: 'debates_623',    dates: ['1787-06-23'], label: 'June 23',   month: 6, notable: null },
  { id: 'debates_625',    dates: ['1787-06-25'], label: 'June 25',   month: 6, notable: null },
  { id: 'debates_626',    dates: ['1787-06-26'], label: 'June 26',   month: 6, notable: null },
  { id: 'debates_627',    dates: ['1787-06-27'], label: 'June 27',   month: 6, notable: null },
  { id: 'debates_628',    dates: ['1787-06-28'], label: 'June 28',   month: 6, notable: null },
  { id: 'debates_629',    dates: ['1787-06-29'], label: 'June 29',   month: 6, notable: null },
  { id: 'debates_630',    dates: ['1787-06-30'], label: 'June 30',   month: 6, notable: null },
  { id: 'debates_702',    dates: ['1787-07-02'], label: 'July 2',    month: 7, notable: null },
  { id: 'debates_705',    dates: ['1787-07-05'], label: 'July 5',    month: 7, notable: null },
  { id: 'debates_706',    dates: ['1787-07-06'], label: 'July 6',    month: 7, notable: null },
  { id: 'debates_709',    dates: ['1787-07-09'], label: 'July 9',    month: 7, notable: null },
  { id: 'debates_710',    dates: ['1787-07-10'], label: 'July 10',   month: 7, notable: null },
  { id: 'debates_711',    dates: ['1787-07-11'], label: 'July 11',   month: 7, notable: null },
  { id: 'debates_712',    dates: ['1787-07-12'], label: 'July 12',   month: 7, notable: null },
  { id: 'debates_713',    dates: ['1787-07-13'], label: 'July 13',   month: 7, notable: null },
  { id: 'debates_714',    dates: ['1787-07-14'], label: 'July 14',   month: 7, notable: null },
  { id: 'debates_716',    dates: ['1787-07-16'], label: 'July 16',   month: 7, notable: 'Great Compromise adopted' },
  { id: 'debates_717',    dates: ['1787-07-17'], label: 'July 17',   month: 7, notable: null },
  { id: 'debates_718',    dates: ['1787-07-18'], label: 'July 18',   month: 7, notable: null },
  { id: 'debates_719',    dates: ['1787-07-19'], label: 'July 19',   month: 7, notable: null },
  { id: 'debates_720',    dates: ['1787-07-20'], label: 'July 20',   month: 7, notable: null },
  { id: 'debates_723',    dates: ['1787-07-23'], label: 'July 23',   month: 7, notable: null },
  { id: 'debates_724',    dates: ['1787-07-24'], label: 'July 24',   month: 7, notable: null },
  { id: 'debates_725',    dates: ['1787-07-25'], label: 'July 25',   month: 7, notable: null },
  { id: 'debates_726',    dates: ['1787-07-26'], label: 'July 26',   month: 7, notable: null },
  { id: 'debates_806',    dates: ['1787-08-06'], label: 'Aug 6',     month: 8, notable: 'Committee of Detail report' },
  { id: 'debates_807',    dates: ['1787-08-07'], label: 'Aug 7',     month: 8, notable: null },
  { id: 'debates_808',    dates: ['1787-08-08'], label: 'Aug 8',     month: 8, notable: null },
  { id: 'debates_809',    dates: ['1787-08-09'], label: 'Aug 9',     month: 8, notable: null },
  { id: 'debates_810',    dates: ['1787-08-10'], label: 'Aug 10',    month: 8, notable: null },
  { id: 'debates_811',    dates: ['1787-08-11'], label: 'Aug 11',    month: 8, notable: null },
  { id: 'debates_813',    dates: ['1787-08-13'], label: 'Aug 13',    month: 8, notable: null },
  { id: 'debates_814',    dates: ['1787-08-14'], label: 'Aug 14',    month: 8, notable: null },
  { id: 'debates_815',    dates: ['1787-08-15'], label: 'Aug 15',    month: 8, notable: null },
  { id: 'debates_816',    dates: ['1787-08-16'], label: 'Aug 16',    month: 8, notable: null },
  { id: 'debates_817',    dates: ['1787-08-17'], label: 'Aug 17',    month: 8, notable: null },
  { id: 'debates_818',    dates: ['1787-08-18'], label: 'Aug 18',    month: 8, notable: null },
  { id: 'debates_820',    dates: ['1787-08-20'], label: 'Aug 20',    month: 8, notable: null },
  { id: 'debates_821',    dates: ['1787-08-21'], label: 'Aug 21',    month: 8, notable: null },
  { id: 'debates_822',    dates: ['1787-08-22'], label: 'Aug 22',    month: 8, notable: null },
  { id: 'debates_823',    dates: ['1787-08-23'], label: 'Aug 23',    month: 8, notable: null },
  { id: 'debates_824',    dates: ['1787-08-24'], label: 'Aug 24',    month: 8, notable: null },
  { id: 'debates_825',    dates: ['1787-08-25'], label: 'Aug 25',    month: 8, notable: null },
  { id: 'debates_827',    dates: ['1787-08-27'], label: 'Aug 27',    month: 8, notable: null },
  { id: 'debates_828',    dates: ['1787-08-28'], label: 'Aug 28',    month: 8, notable: null },
  { id: 'debates_829',    dates: ['1787-08-29'], label: 'Aug 29',    month: 8, notable: null },
  { id: 'debates_830',    dates: ['1787-08-30'], label: 'Aug 30',    month: 8, notable: null },
  { id: 'debates_831',    dates: ['1787-08-31'], label: 'Aug 31',    month: 8, notable: null },
  { id: 'debates_901',    dates: ['1787-09-01'], label: 'Sep 1',     month: 9, notable: null },
  { id: 'debates_904',    dates: ['1787-09-04'], label: 'Sep 4',     month: 9, notable: null },
  { id: 'debates_905',    dates: ['1787-09-05'], label: 'Sep 5',     month: 9, notable: null },
  { id: 'debates_906',    dates: ['1787-09-06'], label: 'Sep 6',     month: 9, notable: null },
  { id: 'debates_908',    dates: ['1787-09-08'], label: 'Sep 8',     month: 9, notable: null },
  { id: 'debates_910',    dates: ['1787-09-10'], label: 'Sep 10',    month: 9, notable: null },
  { id: 'debates_912',    dates: ['1787-09-12'], label: 'Sep 12',    month: 9, notable: null },
  { id: 'debates_913',    dates: ['1787-09-13'], label: 'Sep 13',    month: 9, notable: null },
  { id: 'debates_914',    dates: ['1787-09-14'], label: 'Sep 14',    month: 9, notable: null },
  { id: 'debates_915',    dates: ['1787-09-15'], label: 'Sep 15',    month: 9, notable: null },
  { id: 'debates_917',    dates: ['1787-09-17'], label: 'Sep 17',    month: 9, notable: 'Constitution signed' },
];

// State abbreviations used to detect attendee paragraphs
const STATE_MARKERS = [
  'N. York', 'N. Jersey', 'Massts', 'Connecticut', 'Pena', 'Maryland',
  'Virginia', 'N. Carolina', 'S. Carolina', 'Georgia', 'Delaware',
  'N. Hamp', 'Rhode Island', 'Mr. WYTHE', 'In Convention',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripTags(html, allowedTags = []) {
  // Remove all tags except those in allowedTags
  const allowed = allowedTags.map(t => t.toLowerCase());
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag) => {
    if (allowed.includes(tag.toLowerCase())) return match;
    return '';
  });
}

function extractContent(html) {
  // Normalize line endings
  html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove script and style blocks entirely (including their content)
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<link[^>]*>/gi, '');
  html = html.replace(/<meta[^>]*>/gi, '');

  // Find start: first <h4> or <h3> tag (the date heading)
  let startIdx = html.search(/<h[34][^>]*>/i);
  if (startIdx === -1) {
    // Fallback: look for "Madison Debates" text
    startIdx = html.indexOf('Madison Debates');
    if (startIdx === -1) startIdx = 0;
  }

  // Find end: Yale footer marker
  let endIdx = html.indexOf('Lillian Goldman Law Library');
  if (endIdx === -1) endIdx = html.indexOf('Yale Law School');
  if (endIdx === -1) endIdx = html.indexOf('</body>');
  if (endIdx === -1) endIdx = html.length;

  // Walk back from footer to find the last </p> before it
  const lastP = html.lastIndexOf('</p>', endIdx);
  if (lastP !== -1 && lastP > startIdx) endIdx = lastP + 4;

  let content = html.slice(startIdx, endIdx);

  // Remove remaining HTML boilerplate (tables used for layout, divs, etc.)
  content = content.replace(/<table[\s\S]*?<\/table>/gi, '');
  content = content.replace(/<div[^>]*>/gi, '');
  content = content.replace(/<\/div>/gi, '');
  content = content.replace(/<span[^>]*>/gi, '');
  content = content.replace(/<\/span>/gi, '');
  content = content.replace(/<font[^>]*>/gi, '');
  content = content.replace(/<\/font>/gi, '');
  content = content.replace(/<center[^>]*>/gi, '');
  content = content.replace(/<\/center>/gi, '');
  content = content.replace(/<img[^>]*>/gi, '');
  content = content.replace(/<br\s*\/?>/gi, ' ');
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // Normalize whitespace inside tags but preserve paragraph structure
  content = content.replace(/\s+/g, ' ');
  content = content.replace(/> </g, '><');

  // Clean up empty paragraphs
  content = content.replace(/<p[^>]*>\s*<\/p>/gi, '');
  content = content.replace(/<p[^>]*>\s*&nbsp;\s*<\/p>/gi, '');

  return content.trim();
}

function extractTitle(html) {
  // Look for <h4> containing the date
  const h4Match = html.match(/<h[34][^>]*>([^<]+)<\/h[34]>/i);
  if (h4Match) return h4Match[1].trim().replace(/\s+/g, ' ');

  // Fallback: look for "Madison Debates" in title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim().replace(/Madison Debates\s*/i, '');

  return '';
}

function extractAttendees(contentHtml) {
  // Extract the first paragraph that looks like an attendance list
  const pMatches = contentHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of pMatches) {
    const text = match[1].replace(/<[^>]+>/g, '');
    // Attendance paragraphs contain delegate names / state names
    const hasState = STATE_MARKERS.some(m => text.includes(m));
    if (hasState && text.length > 20) {
      return match[1].trim();
    }
  }
  return '';
}

function extractFootnotes(html) {
  const footnotes = [];
  // Match footnote anchors: <a name="1"> or <a name="fn1"> followed by text
  const fnRegex = /<a\s+name=["']?(\d+)["']?[^>]*>([\s\S]*?)(?=<a\s+name=|<\/body>|Lillian Goldman)/gi;
  let match;
  while ((match = fnRegex.exec(html)) !== null) {
    const id = `FN${match[1]}`;
    const text = match[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (text.length > 3) {
      footnotes.push({ id, text });
    }
  }
  return footnotes;
}

function fixFootnoteLinks(html) {
  // Convert footnote links like href="#1" or href="#fn1" to #FN1 format
  return html.replace(/href=["']#(\d+)["']/gi, (_, num) => `href="#FN${num}"`);
}

function countWords(html) {
  const text = html.replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; educational archiving bot; contact: see GitHub)',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function scrapeDay(day) {
  const outPath = join(DATA_DIR, `${day.id}.json`);

  if (!FORCE && existsSync(outPath)) {
    console.log(`  ↩  Skipping ${day.id} (already exists)`);
    return JSON.parse(readFileSync(outPath, 'utf-8'));
  }

  const url = `${BASE_URL}${day.id}.asp`;
  console.log(`  ↓  Fetching ${day.id} from ${url}`);

  let html;
  let attempts = 0;
  while (attempts < 3) {
    try {
      html = await fetchPage(url);
      break;
    } catch (err) {
      attempts++;
      if (attempts >= 3) throw err;
      console.log(`     Retry ${attempts}/3 for ${day.id}...`);
      await sleep(3000);
    }
  }

  const title = extractTitle(html);
  const contentRaw = extractContent(html);
  const contentHtml = fixFootnoteLinks(contentRaw);
  const attendees = extractAttendees(contentHtml);
  const footnotes = extractFootnotes(html);
  const wordCount = countWords(contentHtml);

  const data = {
    id: day.id,
    sourceUrl: url,
    dates: day.dates,
    label: day.label,
    title,
    attendees,
    contentHtml,
    footnotes,
    scrapedAt: new Date().toISOString(),
    wordCount,
  };

  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`     ✓ Saved ${day.id}.json (${wordCount} words, ${footnotes.length} footnotes)`);
  return data;
}

function writeManifest() {
  const manifest = {
    convention: {
      title: "Notes of Debates in the Federal Convention of 1787",
      editor: "James Madison",
      source: "Yale Law School Avalon Project",
      edition: "Oxford University Press, 1920 (Hunt & Scott, eds.)",
      start: "1787-05-14",
      end: "1787-09-17",
    },
    days: DAYS.map(d => ({
      id: d.id,
      file: `${d.id}.json`,
      dates: d.dates,
      label: d.label,
      month: d.month,
      notable: d.notable,
    })),
  };

  const outPath = join(DATA_DIR, 'manifest.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n✓ Manifest written to data/manifest.json (${DAYS.length} days)`);
}

async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  console.log('Constitutional Convention Debate Scraper');
  console.log(`Mode: ${FORCE ? 'force re-fetch all' : 'skip existing'}`);
  console.log(`Total days to process: ${DAYS.length}\n`);

  if (MANIFEST_ONLY) {
    writeManifest();
    return;
  }

  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < DAYS.length; i++) {
    const day = DAYS[i];
    try {
      await scrapeDay(day);
      succeeded++;
    } catch (err) {
      failed++;
      errors.push({ id: day.id, error: err.message });
      console.error(`  ✗ FAILED ${day.id}: ${err.message}`);
    }

    // Polite delay between requests (skip if file was already cached)
    if (i < DAYS.length - 1) {
      const outPath = join(DATA_DIR, `${day.id}.json`);
      const wasFetched = FORCE || !existsSync(outPath);
      // Note: by this point the file exists either way, so check succeeded count
      if (succeeded > 0 || failed > 0) {
        await sleep(DELAY_MS);
      }
    }
  }

  writeManifest();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done! ${succeeded} succeeded, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed pages:');
    errors.forEach(e => console.log(`  - ${e.id}: ${e.error}`));
    console.log('\nRe-run with --force to retry failed pages.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
