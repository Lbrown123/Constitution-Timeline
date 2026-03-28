#!/usr/bin/env python3
"""
fetch_king_notes.py — Scrapes Rufus King's Convention notes from Yale Avalon and patches
them into the existing debates_*.json files as kingContentHtml / kingWordCount / kingFootnotes.
Also updates data/manifest.json with hasKingNotes flags.
Requires Python 3.7+. No third-party packages needed.

Usage:
  python3 scripts/fetch_king_notes.py              # patch all days missing kingContentHtml
  python3 scripts/fetch_king_notes.py --force      # re-patch every day
  python3 scripts/fetch_king_notes.py --manifest-only  # only update manifest flags

After running:
  python3 scripts/link_delegates.py
  python3 scripts/build_bundle.py
"""

import sys
import json
import re
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR    = Path(__file__).parent
DATA_DIR      = SCRIPT_DIR.parent / 'data' / 'debates'
MANIFEST_PATH = SCRIPT_DIR.parent / 'data' / 'manifest.json'
KING_URL      = 'https://avalon.law.yale.edu/18th_century/king.asp'
FORCE         = '--force' in sys.argv
MANIFEST_ONLY = '--manifest-only' in sys.argv

# Maps anchor key on king.asp → debate metadata
# 'new': True means no Madison file exists; create a stub.
KING_DAY_MAP = {
    'may31':   {'id': 'debates_531', 'dates': ['1787-05-31'], 'label': 'May 31',  'month': 5},
    'june4':   {'id': 'debates_604', 'dates': ['1787-06-04'], 'label': 'June 4',  'month': 6},
    'june8':   {'id': 'debates_608', 'dates': ['1787-06-08'], 'label': 'June 8',  'month': 6},
    'june9':   {'id': 'debates_609', 'dates': ['1787-06-09'], 'label': 'June 9',  'month': 6},
    'june18':  {'id': 'debates_618', 'dates': ['1787-06-18'], 'label': 'June 18', 'month': 6},
    'june20':  {'id': 'debates_620', 'dates': ['1787-06-20'], 'label': 'June 20', 'month': 6},
    'june25':  {'id': 'debates_625', 'dates': ['1787-06-25'], 'label': 'June 25', 'month': 6},
    'june27':  {'id': 'debates_627', 'dates': ['1787-06-27'], 'label': 'June 27', 'month': 6},
    'june28':  {'id': 'debates_628', 'dates': ['1787-06-28'], 'label': 'June 28', 'month': 6},
    'june29':  {'id': 'debates_629', 'dates': ['1787-06-29'], 'label': 'June 29', 'month': 6},
    'june30':  {'id': 'debates_630', 'dates': ['1787-06-30'], 'label': 'June 30', 'month': 6},
    'july5':   {'id': 'debates_705', 'dates': ['1787-07-05'], 'label': 'July 5',  'month': 7},
    'july7':   {'id': 'debates_707', 'dates': ['1787-07-07'], 'label': 'July 7',  'month': 7, 'new': True},
    'july15':  {'id': 'debates_715', 'dates': ['1787-07-15'], 'label': 'July 15', 'month': 7, 'new': True},
    'august7': {'id': 'debates_807', 'dates': ['1787-08-07'], 'label': 'Aug 7',   'month': 8},
    'august8': {'id': 'debates_808', 'dates': ['1787-08-08'], 'label': 'Aug 8',   'month': 8},
}


def fetch_page(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; educational archiving bot)',
        'Accept': 'text/html,application/xhtml+xml',
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
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


def split_into_day_sections(html):
    """
    Returns [(anchor_key, section_html), ...] for each known day in KING_DAY_MAP.
    Splits on <H3 ...><A NAME="may31">...</A></H3> anchors.
    Terminal boundary is the <H3>Notes:</H3> block.
    """
    # Find position of the Notes terminal boundary
    notes_match = re.search(r'<H3[^>]*>\s*Notes\s*:', html, re.IGNORECASE)
    terminal = notes_match.start() if notes_match else len(html)

    # Find all date-section header positions
    header_re = re.compile(
        r'<H3[^>]*>\s*<A\s+NAME=["\']?(\w+)["\']?',
        re.IGNORECASE
    )
    headers = [(m.group(1).lower(), m.start()) for m in header_re.finditer(html, 0, terminal)]

    sections = []
    for i, (anchor_key, start_pos) in enumerate(headers):
        if anchor_key not in KING_DAY_MAP:
            continue
        end_pos = headers[i + 1][1] if i + 1 < len(headers) else terminal
        sections.append((anchor_key, html[start_pos:end_pos]))

    return sections


def extract_king_footnotes(html):
    """
    Finds the <H3>Notes:</H3> block and returns structured footnote objects.
    IDs are namespaced: raw "3" → "KFN3".
    """
    notes_match = re.search(r'<H3[^>]*>\s*Notes\s*:.*?</H3>', html, re.IGNORECASE)
    if not notes_match:
        return []

    notes_html = html[notes_match.end():]

    footnotes = []
    pattern = re.compile(
        r'<A\s+NAME=["\']?(\d+)["\']?[^>]*>([\s\S]*?)(?=<A\s+NAME=["\']?\d+["\']?|$)',
        re.IGNORECASE
    )
    for m in pattern.finditer(notes_html):
        fn_id = f'KFN{m.group(1)}'
        # Strip all tags and clean text
        text = re.sub(r'<[^>]+>', '', m.group(2))
        text = re.sub(r'\s+', ' ', text).strip()
        # Remove trailing "Back" link text
        text = re.sub(r'\s*Back\s*$', '', text).strip()
        if len(text) > 3:
            footnotes.append({'id': fn_id, 'text': text})

    return footnotes


def namespace_footnote_refs(html):
    """
    Namespaces footnote references in per-day section HTML to avoid collisions
    with Madison's footnote IDs.
      href="#3"   → href="#KFN3"   (inline forward refs)
      name="b3"   → name="Kb3"    (inline back-ref anchors)
      name="3"    → name="KFN3"   (footnote definition anchors — if present in section)
    Order matters: run name="bN" before name="N" to avoid double-processing.
    """
    # href="#N" → href="#KFNN"
    html = re.sub(
        r'(href=["\'])#(\d+)(["\'])',
        lambda m: f'{m.group(1)}#KFN{m.group(2)}{m.group(3)}',
        html, flags=re.IGNORECASE
    )
    # name="bN" → name="KbN"
    html = re.sub(
        r'(name=["\'])b(\d+)(["\'])',
        lambda m: f'{m.group(1)}Kb{m.group(2)}{m.group(3)}',
        html, flags=re.IGNORECASE
    )
    # name="N" (bare digit anchor) → name="KFNN"
    html = re.sub(
        r'(name=["\'])(\d+)(["\'])',
        lambda m: f'{m.group(1)}KFN{m.group(2)}{m.group(3)}',
        html, flags=re.IGNORECASE
    )
    return html


def clean_section_html(html):
    """
    Strips layout/navigation elements from a per-day section slice.
    Keeps: h3, h4, p, i, b, a (with namespaced footnote refs).
    """
    # Strip script/style
    html = re.sub(r'<script[\s\S]*?</script>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<style[\s\S]*?</style>', '', html, flags=re.IGNORECASE)

    # Strip entire table blocks (removes "See also" cross-reference tables)
    html = re.sub(r'<table[\s\S]*?</table>', '', html, flags=re.IGNORECASE)

    # Strip layout wrapper tags (open and close) but keep their content
    for tag in ['div', 'span', 'font', 'center']:
        html = re.sub(rf'</?{tag}[^>]*>', '', html, flags=re.IGNORECASE)

    # Strip other non-content elements
    html = re.sub(r'<img[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<br\s*/?>', ' ', html, flags=re.IGNORECASE)
    html = re.sub(r'<!--[\s\S]*?-->', '', html)
    html = re.sub(r'<link[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<meta[^>]*>', '', html, flags=re.IGNORECASE)

    # Normalize whitespace
    html = re.sub(r'\s+', ' ', html)

    # Remove empty paragraphs
    html = re.sub(r'<p[^>]*>\s*</p>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<p[^>]*>\s*&nbsp;\s*</p>', '', html, flags=re.IGNORECASE)

    return html.strip()


def filter_footnotes_for_section(section_html, all_footnotes):
    """Returns only the footnotes whose KFN id is actually referenced in section_html."""
    referenced = set(re.findall(r'href="#(KFN\d+)"', section_html, re.IGNORECASE))
    return [fn for fn in all_footnotes if fn['id'] in referenced]


def count_words(html):
    text = re.sub(r'<[^>]+>', ' ', html)
    return len([w for w in text.split() if w])


def patch_or_create_json(day_info, cleaned_html, word_count, footnotes):
    """
    Patches an existing debates_*.json with king fields, or creates a new stub
    for days that have no Madison notes (July 7, July 15).
    Returns 'patched', 'created', or 'skipped'.
    """
    debate_id = day_info['id']
    is_new    = day_info.get('new', False)
    out_path  = DATA_DIR / f'{debate_id}.json'

    if out_path.exists():
        data = json.loads(out_path.read_text(encoding='utf-8'))
        if not FORCE and 'kingContentHtml' in data:
            print(f'  ↩  Skipping {debate_id} (kingContentHtml already present)')
            return 'skipped'
        data['kingContentHtml'] = cleaned_html
        data['kingWordCount']   = word_count
        data['kingFootnotes']   = footnotes
        data['kingScrapedAt']   = datetime.now(timezone.utc).isoformat()
        action = 'Patched'
        result = 'patched'
    elif is_new:
        data = {
            'id':             debate_id,
            'dates':          day_info['dates'],
            'label':          day_info['label'],
            'title':          day_info['label'],
            'summary':        None,
            'contentHtml':    None,
            'footnotes':      [],
            'scrapedAt':      None,
            'wordCount':      0,
            'kingContentHtml': cleaned_html,
            'kingWordCount':   word_count,
            'kingFootnotes':   footnotes,
            'kingScrapedAt':   datetime.now(timezone.utc).isoformat(),
        }
        action = 'Created'
        result = 'created'
    else:
        print(f'  ⚠  Warning: {debate_id}.json not found — run fetch_debates.py first')
        return 'skipped'

    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'     ✓ {action} {debate_id}.json ({word_count} King words, {len(footnotes)} King footnotes)')
    return result


def update_manifest_king_flags():
    """
    Sets hasKingNotes: true on manifest entries covered by King's notes.
    Inserts new entries for July 7 (after July 6) and July 15 (after July 14).
    """
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    days = manifest['days']

    king_ids = {info['id'] for info in KING_DAY_MAP.values()}

    # Flag existing entries
    for day in days:
        if day['id'] in king_ids:
            day['hasKingNotes'] = True

    # Insert new-only entries if not already present
    existing_ids = {d['id'] for d in days}
    new_entries = [
        {
            'id':           'debates_707',
            'file':         'debates/debates_707.json',
            'dates':        ['1787-07-07'],
            'label':        'July 7',
            'month':        7,
            'notable':      None,
            'hasKingNotes': True,
        },
        {
            'id':           'debates_715',
            'file':         'debates/debates_715.json',
            'dates':        ['1787-07-15'],
            'label':        'July 15',
            'month':        7,
            'notable':      None,
            'hasKingNotes': True,
        },
    ]
    insert_after = {
        'debates_707': 'debates_706',
        'debates_715': 'debates_714',
    }
    for entry in new_entries:
        if entry['id'] not in existing_ids:
            after_id = insert_after[entry['id']]
            try:
                idx = next(i for i, d in enumerate(days) if d['id'] == after_id)
                days.insert(idx + 1, entry)
                print(f'  + Inserted {entry["id"]} into manifest after {after_id}')
            except StopIteration:
                days.append(entry)
                print(f'  + Appended {entry["id"]} to manifest (anchor {after_id} not found)')

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    king_flagged = sum(1 for d in days if d.get('hasKingNotes'))
    print(f'\n✓ Manifest updated — {king_flagged} days flagged with hasKingNotes')


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Rufus King's Convention Notes Scraper")
    print(f'Mode: {"force re-patch all" if FORCE else "skip existing"}')
    print(f'Source: {KING_URL}\n')

    if MANIFEST_ONLY:
        update_manifest_king_flags()
        return

    print('Fetching King notes page...')
    try:
        html = fetch_page(KING_URL)
    except Exception as e:
        print(f'FATAL: Could not fetch {KING_URL}: {e}')
        sys.exit(1)
    print('  ✓ Page fetched\n')

    sections = split_into_day_sections(html)
    print(f'Found {len(sections)} day sections: {[k for k, _ in sections]}\n')

    all_footnotes = extract_king_footnotes(html)
    print(f'Extracted {len(all_footnotes)} global footnotes\n')

    patched = skipped = created = 0
    errors = []

    for anchor_key, section_html in sections:
        day_info = KING_DAY_MAP[anchor_key]
        print(f'  Processing {anchor_key} → {day_info["id"]}')
        try:
            section_html = namespace_footnote_refs(section_html)
            cleaned_html = clean_section_html(section_html)
            word_count   = count_words(cleaned_html)
            day_footnotes = filter_footnotes_for_section(cleaned_html, all_footnotes)

            result = patch_or_create_json(day_info, cleaned_html, word_count, day_footnotes)
            if result == 'patched':
                patched += 1
            elif result == 'created':
                created += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append({'key': anchor_key, 'error': str(e)})
            print(f'  ✗ FAILED {anchor_key}: {e}')

    update_manifest_king_flags()

    print(f'\n{"=" * 50}')
    print(f'Done! {patched} patched, {created} created, {skipped} skipped')
    if errors:
        print('\nFailed sections:')
        for err in errors:
            print(f'  - {err["key"]}: {err["error"]}')
        print('\nRe-run with --force to retry failed sections.')
    else:
        print('\nNext steps:')
        print('  python3 scripts/link_delegates.py')
        print('  python3 scripts/build_bundle.py')


if __name__ == '__main__':
    main()
