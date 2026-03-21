#!/usr/bin/env python3
"""
fetch_debates.py — Scrapes Madison's debate notes from Yale Avalon and saves them as JSON.
Requires Python 3.7+. No third-party packages needed.

Usage:
  python3 scripts/fetch_debates.py              # fetch all missing days
  python3 scripts/fetch_debates.py --force      # re-fetch everything
  python3 scripts/fetch_debates.py --manifest-only  # regenerate manifest.json only
"""

import sys
import os
import json
import time
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
BASE_URL = 'https://avalon.law.yale.edu/18th_century/'
DELAY_S = 1.5
FORCE = '--force' in sys.argv
MANIFEST_ONLY = '--manifest-only' in sys.argv

# Complete list of all 87 debate day entries
DAYS = [
    {'id': 'debates_514525', 'dates': ['1787-05-14', '1787-05-25'], 'label': 'May 14 & 25',  'month': 5, 'notable': 'Convention opens; quorum achieved May 25'},
    {'id': 'debates_528',    'dates': ['1787-05-28'], 'label': 'May 28',   'month': 5, 'notable': None},
    {'id': 'debates_529',    'dates': ['1787-05-29'], 'label': 'May 29',   'month': 5, 'notable': 'Virginia Plan introduced'},
    {'id': 'debates_530',    'dates': ['1787-05-30'], 'label': 'May 30',   'month': 5, 'notable': None},
    {'id': 'debates_531',    'dates': ['1787-05-31'], 'label': 'May 31',   'month': 5, 'notable': None},
    {'id': 'debates_601',    'dates': ['1787-06-01'], 'label': 'June 1',   'month': 6, 'notable': None},
    {'id': 'debates_602',    'dates': ['1787-06-02'], 'label': 'June 2',   'month': 6, 'notable': None},
    {'id': 'debates_604',    'dates': ['1787-06-04'], 'label': 'June 4',   'month': 6, 'notable': None},
    {'id': 'debates_605',    'dates': ['1787-06-05'], 'label': 'June 5',   'month': 6, 'notable': None},
    {'id': 'debates_606',    'dates': ['1787-06-06'], 'label': 'June 6',   'month': 6, 'notable': None},
    {'id': 'debates_607',    'dates': ['1787-06-07'], 'label': 'June 7',   'month': 6, 'notable': None},
    {'id': 'debates_608',    'dates': ['1787-06-08'], 'label': 'June 8',   'month': 6, 'notable': None},
    {'id': 'debates_609',    'dates': ['1787-06-09'], 'label': 'June 9',   'month': 6, 'notable': None},
    {'id': 'debates_611',    'dates': ['1787-06-11'], 'label': 'June 11',  'month': 6, 'notable': None},
    {'id': 'debates_612',    'dates': ['1787-06-12'], 'label': 'June 12',  'month': 6, 'notable': None},
    {'id': 'debates_613',    'dates': ['1787-06-13'], 'label': 'June 13',  'month': 6, 'notable': None},
    {'id': 'debates_614',    'dates': ['1787-06-14'], 'label': 'June 14',  'month': 6, 'notable': None},
    {'id': 'debates_615',    'dates': ['1787-06-15'], 'label': 'June 15',  'month': 6, 'notable': 'New Jersey Plan introduced'},
    {'id': 'debates_616',    'dates': ['1787-06-16'], 'label': 'June 16',  'month': 6, 'notable': None},
    {'id': 'debates_618',    'dates': ['1787-06-18'], 'label': 'June 18',  'month': 6, 'notable': None},
    {'id': 'debates_619',    'dates': ['1787-06-19'], 'label': 'June 19',  'month': 6, 'notable': None},
    {'id': 'debates_620',    'dates': ['1787-06-20'], 'label': 'June 20',  'month': 6, 'notable': None},
    {'id': 'debates_621',    'dates': ['1787-06-21'], 'label': 'June 21',  'month': 6, 'notable': None},
    {'id': 'debates_622',    'dates': ['1787-06-22'], 'label': 'June 22',  'month': 6, 'notable': None},
    {'id': 'debates_623',    'dates': ['1787-06-23'], 'label': 'June 23',  'month': 6, 'notable': None},
    {'id': 'debates_625',    'dates': ['1787-06-25'], 'label': 'June 25',  'month': 6, 'notable': None},
    {'id': 'debates_626',    'dates': ['1787-06-26'], 'label': 'June 26',  'month': 6, 'notable': None},
    {'id': 'debates_627',    'dates': ['1787-06-27'], 'label': 'June 27',  'month': 6, 'notable': None},
    {'id': 'debates_628',    'dates': ['1787-06-28'], 'label': 'June 28',  'month': 6, 'notable': None},
    {'id': 'debates_629',    'dates': ['1787-06-29'], 'label': 'June 29',  'month': 6, 'notable': None},
    {'id': 'debates_630',    'dates': ['1787-06-30'], 'label': 'June 30',  'month': 6, 'notable': None},
    {'id': 'debates_702',    'dates': ['1787-07-02'], 'label': 'July 2',   'month': 7, 'notable': None},
    {'id': 'debates_705',    'dates': ['1787-07-05'], 'label': 'July 5',   'month': 7, 'notable': None},
    {'id': 'debates_706',    'dates': ['1787-07-06'], 'label': 'July 6',   'month': 7, 'notable': None},
    {'id': 'debates_709',    'dates': ['1787-07-09'], 'label': 'July 9',   'month': 7, 'notable': None},
    {'id': 'debates_710',    'dates': ['1787-07-10'], 'label': 'July 10',  'month': 7, 'notable': None},
    {'id': 'debates_711',    'dates': ['1787-07-11'], 'label': 'July 11',  'month': 7, 'notable': None},
    {'id': 'debates_712',    'dates': ['1787-07-12'], 'label': 'July 12',  'month': 7, 'notable': None},
    {'id': 'debates_713',    'dates': ['1787-07-13'], 'label': 'July 13',  'month': 7, 'notable': None},
    {'id': 'debates_714',    'dates': ['1787-07-14'], 'label': 'July 14',  'month': 7, 'notable': None},
    {'id': 'debates_716',    'dates': ['1787-07-16'], 'label': 'July 16',  'month': 7, 'notable': 'Great Compromise adopted'},
    {'id': 'debates_717',    'dates': ['1787-07-17'], 'label': 'July 17',  'month': 7, 'notable': None},
    {'id': 'debates_718',    'dates': ['1787-07-18'], 'label': 'July 18',  'month': 7, 'notable': None},
    {'id': 'debates_719',    'dates': ['1787-07-19'], 'label': 'July 19',  'month': 7, 'notable': None},
    {'id': 'debates_720',    'dates': ['1787-07-20'], 'label': 'July 20',  'month': 7, 'notable': None},
    {'id': 'debates_723',    'dates': ['1787-07-23'], 'label': 'July 23',  'month': 7, 'notable': None},
    {'id': 'debates_724',    'dates': ['1787-07-24'], 'label': 'July 24',  'month': 7, 'notable': None},
    {'id': 'debates_725',    'dates': ['1787-07-25'], 'label': 'July 25',  'month': 7, 'notable': None},
    {'id': 'debates_726',    'dates': ['1787-07-26'], 'label': 'July 26',  'month': 7, 'notable': None},
    {'id': 'debates_806',    'dates': ['1787-08-06'], 'label': 'Aug 6',    'month': 8, 'notable': 'Committee of Detail report'},
    {'id': 'debates_807',    'dates': ['1787-08-07'], 'label': 'Aug 7',    'month': 8, 'notable': None},
    {'id': 'debates_808',    'dates': ['1787-08-08'], 'label': 'Aug 8',    'month': 8, 'notable': None},
    {'id': 'debates_809',    'dates': ['1787-08-09'], 'label': 'Aug 9',    'month': 8, 'notable': None},
    {'id': 'debates_810',    'dates': ['1787-08-10'], 'label': 'Aug 10',   'month': 8, 'notable': None},
    {'id': 'debates_811',    'dates': ['1787-08-11'], 'label': 'Aug 11',   'month': 8, 'notable': None},
    {'id': 'debates_813',    'dates': ['1787-08-13'], 'label': 'Aug 13',   'month': 8, 'notable': None},
    {'id': 'debates_814',    'dates': ['1787-08-14'], 'label': 'Aug 14',   'month': 8, 'notable': None},
    {'id': 'debates_815',    'dates': ['1787-08-15'], 'label': 'Aug 15',   'month': 8, 'notable': None},
    {'id': 'debates_816',    'dates': ['1787-08-16'], 'label': 'Aug 16',   'month': 8, 'notable': None},
    {'id': 'debates_817',    'dates': ['1787-08-17'], 'label': 'Aug 17',   'month': 8, 'notable': None},
    {'id': 'debates_818',    'dates': ['1787-08-18'], 'label': 'Aug 18',   'month': 8, 'notable': None},
    {'id': 'debates_820',    'dates': ['1787-08-20'], 'label': 'Aug 20',   'month': 8, 'notable': None},
    {'id': 'debates_821',    'dates': ['1787-08-21'], 'label': 'Aug 21',   'month': 8, 'notable': None},
    {'id': 'debates_822',    'dates': ['1787-08-22'], 'label': 'Aug 22',   'month': 8, 'notable': None},
    {'id': 'debates_823',    'dates': ['1787-08-23'], 'label': 'Aug 23',   'month': 8, 'notable': None},
    {'id': 'debates_824',    'dates': ['1787-08-24'], 'label': 'Aug 24',   'month': 8, 'notable': None},
    {'id': 'debates_825',    'dates': ['1787-08-25'], 'label': 'Aug 25',   'month': 8, 'notable': None},
    {'id': 'debates_827',    'dates': ['1787-08-27'], 'label': 'Aug 27',   'month': 8, 'notable': None},
    {'id': 'debates_828',    'dates': ['1787-08-28'], 'label': 'Aug 28',   'month': 8, 'notable': None},
    {'id': 'debates_829',    'dates': ['1787-08-29'], 'label': 'Aug 29',   'month': 8, 'notable': None},
    {'id': 'debates_830',    'dates': ['1787-08-30'], 'label': 'Aug 30',   'month': 8, 'notable': None},
    {'id': 'debates_831',    'dates': ['1787-08-31'], 'label': 'Aug 31',   'month': 8, 'notable': None},
    {'id': 'debates_901',    'dates': ['1787-09-01'], 'label': 'Sep 1',    'month': 9, 'notable': None},
    {'id': 'debates_904',    'dates': ['1787-09-04'], 'label': 'Sep 4',    'month': 9, 'notable': None},
    {'id': 'debates_905',    'dates': ['1787-09-05'], 'label': 'Sep 5',    'month': 9, 'notable': None},
    {'id': 'debates_906',    'dates': ['1787-09-06'], 'label': 'Sep 6',    'month': 9, 'notable': None},
    {'id': 'debates_908',    'dates': ['1787-09-08'], 'label': 'Sep 8',    'month': 9, 'notable': None},
    {'id': 'debates_910',    'dates': ['1787-09-10'], 'label': 'Sep 10',   'month': 9, 'notable': None},
    {'id': 'debates_912',    'dates': ['1787-09-12'], 'label': 'Sep 12',   'month': 9, 'notable': None},
    {'id': 'debates_913',    'dates': ['1787-09-13'], 'label': 'Sep 13',   'month': 9, 'notable': None},
    {'id': 'debates_914',    'dates': ['1787-09-14'], 'label': 'Sep 14',   'month': 9, 'notable': None},
    {'id': 'debates_915',    'dates': ['1787-09-15'], 'label': 'Sep 15',   'month': 9, 'notable': None},
    {'id': 'debates_917',    'dates': ['1787-09-17'], 'label': 'Sep 17',   'month': 9, 'notable': 'Constitution signed'},
]

STATE_MARKERS = [
    'N. York', 'N. Jersey', 'Massts', 'Connecticut', 'Pena', 'Maryland',
    'Virginia', 'N. Carolina', 'S. Carolina', 'Georgia', 'Delaware',
    'N. Hamp', 'Rhode Island',
]


def fetch_page(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; educational archiving bot)',
        'Accept': 'text/html,application/xhtml+xml',
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                # Try UTF-8, fall back to latin-1
                try:
                    return raw.decode('utf-8')
                except UnicodeDecodeError:
                    return raw.decode('latin-1')
        except urllib.error.HTTPError as e:
            if attempt == 2:
                raise
            print(f'     Retry {attempt+1}/3...')
            time.sleep(3)
        except Exception as e:
            if attempt == 2:
                raise
            print(f'     Retry {attempt+1}/3...')
            time.sleep(3)


def extract_title(html):
    # Look for <h4> or <h3> date heading
    m = re.search(r'<h[34][^>]*>([^<]+)</h[34]>', html, re.IGNORECASE)
    if m:
        return re.sub(r'\s+', ' ', m.group(1)).strip()
    # Fallback: title tag
    m = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
    if m:
        return re.sub(r'Madison Debates\s*', '', m.group(1), flags=re.IGNORECASE).strip()
    return ''


def extract_content(html):
    # Normalize line endings
    html = html.replace('\r\n', '\n').replace('\r', '\n')

    # Remove script/style blocks entirely
    html = re.sub(r'<script[\s\S]*?</script>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<style[\s\S]*?</style>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<link[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<meta[^>]*>', '', html, flags=re.IGNORECASE)

    # Find content start: first <h3> or <h4>
    start_match = re.search(r'<h[34][^>]*>', html, re.IGNORECASE)
    start = start_match.start() if start_match else 0

    # Find content end: Yale footer
    for marker in ['Lillian Goldman Law Library', 'Yale Law School', '</body>']:
        idx = html.find(marker, start)
        if idx != -1:
            # Walk back to last </p>
            last_p = html.rfind('</p>', start, idx)
            end = (last_p + 4) if last_p != -1 else idx
            break
    else:
        end = len(html)

    content = html[start:end]

    # Strip layout elements but keep content tags
    content = re.sub(r'<table[\s\S]*?</table>', '', content, flags=re.IGNORECASE)
    for tag in ['div', 'span', 'font', 'center']:
        content = re.sub(rf'</?{tag}[^>]*>', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<img[^>]*>', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<br\s*/?>', ' ', content, flags=re.IGNORECASE)
    content = re.sub(r'<!--[\s\S]*?-->', '', content)

    # Normalize whitespace
    content = re.sub(r'\s+', ' ', content)

    # Clean empty paragraphs
    content = re.sub(r'<p[^>]*>\s*</p>', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<p[^>]*>\s*&nbsp;\s*</p>', '', content, flags=re.IGNORECASE)

    return content.strip()


def extract_attendees(content_html):
    # Find first <p> that looks like an attendance list
    for m in re.finditer(r'<p[^>]*>([\s\S]*?)</p>', content_html, re.IGNORECASE):
        text = re.sub(r'<[^>]+>', '', m.group(1))
        if any(marker in text for marker in STATE_MARKERS) and len(text) > 20:
            return m.group(1).strip()
    return ''


def extract_footnotes(html):
    footnotes = []
    # Match footnote anchors: <a name="1">...</a>
    pattern = re.compile(
        r'<a\s+name=["\']?(\d+)["\']?[^>]*>([\s\S]*?)(?=<a\s+name=|</body>|Lillian Goldman)',
        re.IGNORECASE
    )
    for m in pattern.finditer(html):
        fn_id = f'FN{m.group(1)}'
        text = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        text = re.sub(r'\s+', ' ', text)
        if len(text) > 3:
            footnotes.append({'id': fn_id, 'text': text})
    return footnotes


def fix_footnote_links(html):
    return re.sub(r'href=["\']#(\d+)["\']', lambda m: f'href="#FN{m.group(1)}"', html, flags=re.IGNORECASE)


def count_words(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    return len([w for w in text.split() if w])


def scrape_day(day):
    out_path = DATA_DIR / f'{day["id"]}.json'

    if not FORCE and out_path.exists():
        print(f'  ↩  Skipping {day["id"]} (already exists)')
        return

    url = f'{BASE_URL}{day["id"]}.asp'
    print(f'  ↓  Fetching {day["id"]}')

    html = fetch_page(url)

    title = extract_title(html)
    content_raw = extract_content(html)
    content_html = fix_footnote_links(content_raw)
    attendees = extract_attendees(content_html)
    footnotes = extract_footnotes(html)
    word_count = count_words(content_html)

    data = {
        'id': day['id'],
        'sourceUrl': url,
        'dates': day['dates'],
        'label': day['label'],
        'title': title,
        'attendees': attendees,
        'contentHtml': content_html,
        'footnotes': footnotes,
        'scrapedAt': datetime.now(timezone.utc).isoformat(),
        'wordCount': word_count,
    }

    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'     ✓ Saved {day["id"]}.json ({word_count} words, {len(footnotes)} footnotes)')


def write_manifest():
    manifest = {
        'convention': {
            'title': 'Notes of Debates in the Federal Convention of 1787',
            'editor': 'James Madison',
            'source': 'Yale Law School Avalon Project',
            'edition': 'Oxford University Press, 1920 (Hunt & Scott, eds.)',
            'start': '1787-05-14',
            'end': '1787-09-17',
        },
        'days': [
            {
                'id': d['id'],
                'file': f'{d["id"]}.json',
                'dates': d['dates'],
                'label': d['label'],
                'month': d['month'],
                'notable': d['notable'],
            }
            for d in DAYS
        ],
    }
    out_path = DATA_DIR / 'manifest.json'
    out_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\n✓ Manifest written to data/manifest.json ({len(DAYS)} days)')


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print('Constitutional Convention Debate Scraper')
    print(f'Mode: {"force re-fetch all" if FORCE else "skip existing"}')
    print(f'Total days to process: {len(DAYS)}\n')

    if MANIFEST_ONLY:
        write_manifest()
        return

    succeeded = 0
    failed = 0
    errors = []
    last_fetched = False

    for i, day in enumerate(DAYS):
        out_path = DATA_DIR / f'{day["id"]}.json'
        will_fetch = FORCE or not out_path.exists()

        if will_fetch and last_fetched:
            time.sleep(DELAY_S)

        try:
            scrape_day(day)
            if will_fetch:
                succeeded += 1
                last_fetched = True
            else:
                last_fetched = False
        except Exception as e:
            failed += 1
            last_fetched = True  # still need delay after a failed attempt
            errors.append({'id': day['id'], 'error': str(e)})
            print(f'  ✗ FAILED {day["id"]}: {e}')

    write_manifest()

    print(f'\n{"=" * 50}')
    print(f'Done! {succeeded} fetched, {failed} failed, {len(DAYS) - succeeded - failed} skipped (cached)')
    if errors:
        print('\nFailed pages:')
        for e in errors:
            print(f'  - {e["id"]}: {e["error"]}')
        print('\nRe-run with --force to retry failed pages.')


if __name__ == '__main__':
    main()
