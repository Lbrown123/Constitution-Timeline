#!/usr/bin/env python3
"""
fetch_attendees.py — Fetches data and photos for all 55 Constitutional Convention
delegates from Wikipedia.

Usage:
  python3 scripts/fetch_attendees.py [--force]

Output:
  data/attendees.json           — card metadata for all 55 delegates
  data/attendee_[id].json       — full profile per delegate (bio + convention section)
  images/attendees/[id].webp    — card portrait (~200px wide)
  images/attendees/[id]_lg.webp — profile portrait (~350px wide)
"""

import io
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Tag

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
    print('WARNING: Pillow not installed. Photos will be skipped.')

SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_DIR = ROOT_DIR / 'data'
ATTENDEES_DIR = DATA_DIR / 'attendees'
IMAGES_DIR = ROOT_DIR / 'images' / 'attendees'

WIKI_BASE = 'https://en.wikipedia.org'
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 ConventionWebsite/1.0 (educational; github.com) python-requests'
    )
}

# Historical Convention debate: big states wanted proportional representation,
# small states wanted equal representation per state.
BIG_STATES = {
    'Virginia', 'Pennsylvania', 'Massachusetts',
    'New York', 'North Carolina', 'South Carolina', 'Georgia',
}
SMALL_STATES = {'Connecticut', 'Delaware', 'New Jersey', 'New Hampshire', 'Maryland'}

# Keyword → normalized occupation category, checked in priority order
OCCUPATION_RULES = [
    ('physician', 'Doctor'),
    ('doctor', 'Doctor'),
    ('surgeon', 'Doctor'),
    ('planter', 'Planter/Farmer'),
    ('farmer', 'Planter/Farmer'),
    ('agricultur', 'Planter/Farmer'),
    ('merchant', 'Merchant'),
    ('businessman', 'Merchant'),
    ('trader', 'Merchant'),
    ('general', 'Soldier'),
    ('colonel', 'Soldier'),
    ('military', 'Soldier'),
    ('soldier', 'Soldier'),
    ('lawyer', 'Lawyer'),
    ('attorney', 'Lawyer'),
    ('jurist', 'Lawyer'),
    ('judge', 'Lawyer'),
    ('politician', 'Statesman'),
    ('statesman', 'Statesman'),
    ('diplomat', 'Statesman'),
    ('writer', 'Statesman'),
    ('inventor', 'Statesman'),
    ('philosopher', 'Statesman'),
    ('scientist', 'Statesman'),
]

# Maps display name → Wikipedia article title (handles disambiguation)
WIKI_TITLES = {
    'Oliver Ellsworth': 'Oliver Ellsworth',
    'William Samuel Johnson': 'William Samuel Johnson',
    'Roger Sherman': 'Roger Sherman',
    'Richard Bassett': 'Richard Bassett (Delaware politician)',
    'Gunning Bedford Jr.': 'Gunning Bedford Jr.',
    'Jacob Broom': 'Jacob Broom',
    'John Dickinson': 'John Dickinson (politician)',
    'George Read': 'George Read (American politician, born 1733)',
    'Abraham Baldwin': 'Abraham Baldwin',
    'William Few': 'William Few',
    'William Houston': 'William Houstoun (lawyer)',
    'William L. Pierce': 'William Pierce (Georgia politician)',
    'Daniel Carroll': 'Daniel Carroll',
    'Daniel of St. Thomas Jenifer': 'Daniel of St. Thomas Jenifer',
    'Luther Martin': 'Luther Martin',
    'James McHenry': 'James McHenry',
    'John F. Mercer': 'John Francis Mercer',
    'Elbridge Gerry': 'Elbridge Gerry',
    'Nathaniel Gorham': 'Nathaniel Gorham',
    'Rufus King': 'Rufus King',
    'Caleb Strong': 'Caleb Strong',
    'Nicholas Gilman': 'Nicholas Gilman',
    'John Langdon': 'John Langdon (politician)',
    'David Brearly': 'David Brearley',
    'Jonathan Dayton': 'Jonathan Dayton',
    'William C. Houston': 'William Churchill Houston',
    'William Livingston': 'William Livingston',
    'William Paterson': 'William Paterson (judge)',
    'Alexander Hamilton': 'Alexander Hamilton',
    'John Lansing Jr.': 'John Lansing Jr.',
    'Robert Yates': 'Robert Yates (politician)',
    'William Blount': 'William Blount',
    'William R. Davie': 'William Richardson Davie',
    'Alexander Martin': 'Alexander Martin',
    'Richard Dobbs Spaight': 'Richard Dobbs Spaight',
    'Hugh Williamson': 'Hugh Williamson',
    'George Clymer': 'George Clymer',
    'Thomas Fitzsimons': 'Thomas FitzSimons',
    'Benjamin Franklin': 'Benjamin Franklin',
    'Jared Ingersoll': 'Jared Ingersoll',
    'Thomas Mifflin': 'Thomas Mifflin',
    'Gouverneur Morris': 'Gouverneur Morris',
    'Robert Morris': 'Robert Morris (financier)',
    'James Wilson': 'James Wilson (justice)',
    'Pierce Butler': 'Pierce Butler (American politician)',
    'Charles Pinckney': 'Charles Pinckney (governor)',
    'Charles Cotesworth Pinckney': 'Charles Cotesworth Pinckney',
    'John Rutledge': 'John Rutledge',
    'John Blair': 'John Blair Jr.',
    'James Madison Jr.': 'James Madison',
    'George Mason': 'George Mason',
    'James McClurg': 'James McClurg',
    'Edmund J. Randolph': 'Edmund Randolph',
    'George Washington': 'George Washington',
    'George Wythe': 'George Wythe',
}

# All 55 delegates: (display name, state, signed Constitution)
DELEGATES = [
    # Connecticut
    ('Oliver Ellsworth',          'Connecticut',    False),
    ('William Samuel Johnson',    'Connecticut',    True),
    ('Roger Sherman',             'Connecticut',    True),
    # Delaware
    ('Richard Bassett',           'Delaware',       True),
    ('Gunning Bedford Jr.',       'Delaware',       True),
    ('Jacob Broom',               'Delaware',       True),
    ('John Dickinson',            'Delaware',       True),
    ('George Read',               'Delaware',       True),
    # Georgia
    ('Abraham Baldwin',           'Georgia',        True),
    ('William Few',               'Georgia',        True),
    ('William Houston',           'Georgia',        False),
    ('William L. Pierce',         'Georgia',        False),
    # Maryland
    ('Daniel Carroll',            'Maryland',       True),
    ('Daniel of St. Thomas Jenifer', 'Maryland',   True),
    ('Luther Martin',             'Maryland',       False),
    ('James McHenry',             'Maryland',       True),
    ('John F. Mercer',            'Maryland',       False),
    # Massachusetts
    ('Elbridge Gerry',            'Massachusetts',  False),
    ('Nathaniel Gorham',          'Massachusetts',  True),
    ('Rufus King',                'Massachusetts',  True),
    ('Caleb Strong',              'Massachusetts',  False),
    # New Hampshire
    ('Nicholas Gilman',           'New Hampshire',  True),
    ('John Langdon',              'New Hampshire',  True),
    # New Jersey
    ('David Brearly',             'New Jersey',     True),
    ('Jonathan Dayton',           'New Jersey',     True),
    ('William C. Houston',        'New Jersey',     False),
    ('William Livingston',        'New Jersey',     True),
    ('William Paterson',          'New Jersey',     True),
    # New York
    ('Alexander Hamilton',        'New York',       True),
    ('John Lansing Jr.',          'New York',       False),
    ('Robert Yates',              'New York',       False),
    # North Carolina
    ('William Blount',            'North Carolina', True),
    ('William R. Davie',          'North Carolina', False),
    ('Alexander Martin',          'North Carolina', False),
    ('Richard Dobbs Spaight',     'North Carolina', True),
    ('Hugh Williamson',           'North Carolina', True),
    # Pennsylvania
    ('George Clymer',             'Pennsylvania',   True),
    ('Thomas Fitzsimons',         'Pennsylvania',   True),
    ('Benjamin Franklin',         'Pennsylvania',   True),
    ('Jared Ingersoll',           'Pennsylvania',   True),
    ('Thomas Mifflin',            'Pennsylvania',   True),
    ('Gouverneur Morris',         'Pennsylvania',   True),
    ('Robert Morris',             'Pennsylvania',   True),
    ('James Wilson',              'Pennsylvania',   True),
    # South Carolina
    ('Pierce Butler',             'South Carolina', True),
    ('Charles Pinckney',          'South Carolina', True),
    ('Charles Cotesworth Pinckney', 'South Carolina', True),
    ('John Rutledge',             'South Carolina', True),
    # Virginia
    ('John Blair',                'Virginia',       True),
    ('James Madison Jr.',         'Virginia',       True),
    ('George Mason',              'Virginia',       False),
    ('James McClurg',             'Virginia',       False),
    ('Edmund J. Randolph',        'Virginia',       False),
    ('George Washington',         'Virginia',       True),
    ('George Wythe',              'Virginia',       False),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_id(name):
    """Convert a delegate name to a URL-safe slug."""
    clean = re.sub(r'\b(Jr\.|Sr\.|II|III)\b', '', name).strip()
    slug = re.sub(r'[^a-z0-9]+', '_', clean.lower()).strip('_')
    return slug


def clean_occupation(raw):
    """
    Normalize a raw occupation string scraped from a Wikipedia infobox.

    - Splits on commas
    - Removes empty tokens and whitespace artefacts
    - Filters fragment tokens that are parts of verbose "delegate from X to Y"
      descriptions (e.g. "Province of Georgia", "to the", "Congress of the
      Confederation") rather than standalone occupations
    - Strips parenthetical date/qualifier annotations, e.g. "(until 1777)"
    - Capitalizes the first letter of each entry
    """
    _FRAG = re.compile(
        r'(?i)(^(to\s+the|from\s+the)'
        r'|\b(delegate|province\s+of|congress\s+of|confederation'
        r'|constitutional\s+convention|state\s+of))'
    )
    parts = [p.strip().strip(',') for p in raw.split(',')]
    cleaned = []
    for p in parts:
        if not p:
            continue
        if _FRAG.search(p):
            continue
        # Strip parenthetical qualifiers containing a year, e.g. "(until 1777)"
        p = re.sub(r'\s*\([^)]*\d{4}[^)]*\)', '', p).strip()
        if p:
            cleaned.append(p[0].upper() + p[1:])
    return ', '.join(cleaned)


def categorize_occupation(raw):
    """Map raw occupation text to a normalized filter category."""
    if not raw:
        return 'Statesman'
    lower = raw.lower()
    for keyword, category in OCCUPATION_RULES:
        if keyword in lower:
            return category
    return 'Statesman'


def age_decade(age):
    """Return filter bucket string for an age (e.g. 36 → '30s', 81 → '70+')."""
    if age is None:
        return None
    decade = (age // 10) * 10
    return f'{decade}s' if decade < 70 else '70+'


def fetch_html(url, delay=0.6):
    """Fetch URL, return BeautifulSoup. Includes polite delay."""
    time.sleep(delay)
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    # Strip <link> tags before parsing: html.parser treats <link> as non-void,
    # which causes everything after a <link rel="mw-deduplicated-inline-style">
    # to be parsed as its children rather than siblings.
    html = re.sub(r'<link\b[^>]*/>', '', resp.text)
    return BeautifulSoup(html, 'html.parser')


def is_heading_tag(tag):
    """Return (level, text) if tag is a heading (handles both old and new Wikipedia format)."""
    if tag.name in ('h2', 'h3', 'h4', 'h5'):
        return int(tag.name[1]), tag.get_text()
    if tag.name == 'div':
        classes = ' '.join(tag.get('class', []))
        if 'mw-heading' in classes:
            h = tag.find(['h2', 'h3', 'h4', 'h5'])
            if h:
                return int(h.name[1]), h.get_text()
    return None


def clean_html(element):
    """
    Clean Wikipedia HTML for display:
    - Remove edit-section links, citation superscripts, hidden spans
    - Strip all hyperlinks (keep text), remove navboxes/infoboxes/thumbs
    - Remove style/script tags
    Returns cleaned HTML string.
    """
    if element is None:
        return ''
    soup = BeautifulSoup(str(element), 'html.parser')

    for sel in [
        'span.mw-editsection',
        'sup.reference',
        'sup.noprint',
        'span.noprint',
        'style',
        'script',
    ]:
        for t in soup.select(sel):
            t.decompose()

    for t in soup.find_all(class_=re.compile(
        r'navbox|infobox|thumb|toc\b|ambox|mbox|reflist|sistersitebox|hatnote'
    )):
        t.decompose()

    # Strip links, keep text
    for a in soup.find_all('a'):
        a.replace_with(a.get_text())

    # Remove Old Style date notations, e.g. "[O.S. November 30, 1725]" or "[O.S. July 6]"
    html = re.sub(r'\s*\[O\.S\.[^\]]*\]', '', str(soup))
    return html


def skip_class(tag, skip_patterns):
    classes = ' '.join(tag.get('class', []))
    return any(p in classes for p in skip_patterns)


SKIP_DIV_CLASSES = [
    'infobox', 'navbox', 'toc', 'thumb', 'reflist', 'hatnote',
    'ambox', 'mbox', 'sistersitebox', 'mw-heading',
]


# ---------------------------------------------------------------------------
# Page extractors
# ---------------------------------------------------------------------------

def extract_intro_html(page_soup):
    """Return cleaned HTML of the intro paragraphs (before the first h2)."""
    content_text = page_soup.find('div', id='mw-content-text')
    content = content_text.find('div', class_='mw-parser-output') if content_text else page_soup.find('div', class_='mw-parser-output')
    if not content:
        return ''

    parts = []
    for child in content.children:
        if not isinstance(child, Tag):
            continue
        heading = is_heading_tag(child)
        if heading and heading[0] <= 2:
            break
        if child.name == 'table':
            continue
        if child.name == 'div' and skip_class(child, SKIP_DIV_CLASSES):
            continue
        if child.name == 'p':
            text = child.get_text().strip()
            if len(text) > 30:
                parts.append(child)

    return clean_html(BeautifulSoup(''.join(str(p) for p in parts), 'html.parser'))


CONVENTION_KEYWORDS = [
    'constitutional convention',
    'constitutional convention of 1787',
    'philadelphia convention',
    'federal convention',
    'convention of 1787',
    'at the convention',
    'continental congress and convention',
]


def extract_convention_html(page_soup):
    """
    Return cleaned HTML of any section whose heading references the Constitutional
    Convention. Returns empty string if none found.
    """
    content_text = page_soup.find('div', id='mw-content-text')
    content = content_text.find('div', class_='mw-parser-output') if content_text else page_soup.find('div', class_='mw-parser-output')
    if not content:
        return ''

    parts = []
    capturing = False
    capture_level = None

    for child in content.children:
        if not isinstance(child, Tag):
            continue
        heading = is_heading_tag(child)
        if heading:
            level, text = heading
            if any(kw in text.lower() for kw in CONVENTION_KEYWORDS):
                capturing = True
                capture_level = level
                parts.append(child)
            elif capturing:
                if level <= capture_level:
                    capturing = False
                    break
                else:
                    parts.append(child)
        elif capturing:
            parts.append(child)

    return clean_html(BeautifulSoup(''.join(str(p) for p in parts), 'html.parser'))


def extract_infobox(page_soup):
    """Extract occupation, birth year, and image URL from the Wikipedia infobox."""
    result = {'occupationRaw': '', 'birthYear': None, 'imageUrl': None}
    infobox = page_soup.find('table', class_=re.compile(r'infobox'))
    if not infobox:
        return result

    # Image: prefer the first img in the infobox
    img = infobox.find('img')
    if img:
        src = img.get('src', '')
        if src.startswith('//'):
            src = 'https:' + src
        result['imageUrl'] = src

    for row in infobox.find_all('tr'):
        th = row.find('th')
        td = row.find('td')
        if not th or not td:
            continue
        label = th.get_text(strip=True).lower()

        if 'born' in label and result['birthYear'] is None:
            # Remove citations before reading
            for sup in td.find_all('sup'):
                sup.decompose()
            raw = td.get_text(' ', strip=True)
            m = re.search(r'\b(1[67]\d{2})\b', raw)
            if m:
                result['birthYear'] = int(m.group(1))

        elif any(x in label for x in ['occupation', 'profession']) and not result['occupationRaw']:
            for sup in td.find_all('sup'):
                sup.decompose()
            # Use list items when present so linked text isn't fragmented
            items = td.find_all('li')
            if items:
                raw = ', '.join(li.get_text(' ', strip=True) for li in items)
            else:
                raw = td.get_text(', ', strip=True)
            result['occupationRaw'] = clean_occupation(raw[:300])

    return result


def get_photo_url(thumb_url, wiki_title=None):
    """
    Return a download URL for a Wikipedia image.
    Prefers the Wikipedia pageimages API when wiki_title is provided;
    falls back to resizing the thumbnail URL.
    """
    if wiki_title:
        try:
            api_url = (
                'https://en.wikipedia.org/w/api.php'
                f'?action=query&titles={quote(wiki_title)}'
                '&prop=pageimages&format=json&pithumbsize=400'
            )
            resp = requests.get(api_url, headers=HEADERS, timeout=10)
            data = resp.json()
            pages = data.get('query', {}).get('pages', {})
            for page in pages.values():
                src = page.get('thumbnail', {}).get('source', '')
                if src:
                    return src
        except Exception:
            pass  # fall through to thumb_url approach

    if not thumb_url:
        return None
    url = re.sub(r'/\d+px-', '/400px-', thumb_url)
    if url.startswith('//'):
        url = 'https:' + url
    return url


IMAGE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Referer': 'https://en.wikipedia.org/',
}


def download_photos(image_url, delegate_id):
    """
    Download image and save two WebP sizes:
      {id}.webp    — 200 × 250 px card portrait
      {id}_lg.webp — 350 px wide profile portrait
    Returns (card_rel_path, profile_rel_path) or (None, None) on failure.
    """
    if not image_url or not HAS_PILLOW:
        return None, None
    try:
        time.sleep(2.0)
        resp = requests.get(image_url, headers=IMAGE_HEADERS, timeout=25)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content))
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')

        # Card: 200 × 250
        card_file = IMAGES_DIR / f'{delegate_id}.webp'
        w, h = img.size
        card = img.copy().resize((200, int(h * 200 / w)), Image.LANCZOS)
        if card.height > 250:
            card = card.crop((0, 0, 200, 250))
        card.save(str(card_file), 'WEBP', quality=82, method=6)

        # Profile: 350 wide, full height
        profile_file = IMAGES_DIR / f'{delegate_id}_lg.webp'
        profile = img.copy().resize((350, int(h * 350 / w)), Image.LANCZOS)
        profile.save(str(profile_file), 'WEBP', quality=82, method=6)

        return (
            f'images/attendees/{delegate_id}.webp',
            f'images/attendees/{delegate_id}_lg.webp',
        )
    except Exception as e:
        print(f'    WARNING: photo download failed: {e}')
        return None, None


# ---------------------------------------------------------------------------
# Main per-delegate fetch
# ---------------------------------------------------------------------------

def fetch_delegate(name, state, signed, force=False):
    """
    Fetch all data for one delegate. Skips if already on disk (unless --force).
    Returns the full data dict, or None on error.
    """
    delegate_id = make_id(name)
    wiki_title = WIKI_TITLES.get(name, name.replace(' ', '_'))
    wiki_url = f'{WIKI_BASE}/wiki/{quote(wiki_title.replace(" ", "_"))}'

    out_path = ATTENDEES_DIR / f'attendee_{delegate_id}.json'
    card_img = IMAGES_DIR / f'{delegate_id}.webp'

    if not force and out_path.exists() and card_img.exists():
        print(f'  [skip] {name}')
        return json.loads(out_path.read_text(encoding='utf-8'))

    print(f'  Fetching: {name}  →  {wiki_title}')

    try:
        soup = fetch_html(wiki_url)
    except Exception as e:
        print(f'  ERROR: could not fetch {wiki_url}: {e}')
        return None

    infobox = extract_infobox(soup)
    fetch_url = get_photo_url(infobox['imageUrl'], wiki_title=wiki_title)
    photo_card, photo_profile = download_photos(fetch_url, delegate_id)

    intro_html = extract_intro_html(soup)
    convention_html = extract_convention_html(soup)
    occupation_cat = categorize_occupation(infobox['occupationRaw'])
    birth_year = infobox['birthYear']
    age = (1787 - birth_year) if birth_year else None
    state_size = 'big' if state in BIG_STATES else 'small'

    data = {
        'id': delegate_id,
        'name': name,
        'state': state,
        'stateSize': state_size,
        'occupationRaw': infobox['occupationRaw'],
        'occupationCategory': occupation_cat,
        'birthYear': birth_year,
        'ageAtConvention': age,
        'ageDecade': age_decade(age),
        'signedConstitution': signed,
        'wikiTitle': wiki_title,
        'wikiUrl': wiki_url,
        'imageUrl': fetch_url or '',
        'photoCard': photo_card or '',
        'photoProfile': photo_profile or '',
        'introHtml': intro_html,
        'conventionHtml': convention_html,
    }

    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    return data


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def photos_only_mode():
    """Re-download photos for any delegate whose card image is missing."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    fixed = 0
    for name, _state, _signed in DELEGATES:
        delegate_id = make_id(name)
        out_path = ATTENDEES_DIR / f'attendee_{delegate_id}.json'
        card_img = IMAGES_DIR / f'{delegate_id}.webp'
        if not out_path.exists():
            print(f'  [missing json] {name} — run without --photos-only first')
            continue
        if card_img.exists():
            continue
        data = json.loads(out_path.read_text(encoding='utf-8'))
        stored_url = data.get('imageUrl', '')
        wiki_title = data.get('wikiTitle', '')
        image_url = get_photo_url(stored_url, wiki_title=wiki_title)
        if not image_url:
            print(f'  [no imageUrl] {name} — fetch page manually')
            continue
        print(f'  Downloading photo: {name}')
        card, profile = download_photos(image_url, delegate_id)
        if card:
            data['photoCard'] = card
            data['photoProfile'] = profile
            out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            fixed += 1
    print(f'\n✓ Fixed {fixed} missing photos')
    # Rebuild attendees.json to reflect updated photoCard paths
    rebuild_card_metadata()


def rebuild_card_metadata():
    """Re-generate attendees.json from the individual attendee JSON files."""
    card_metadata = []
    for name, _state, _signed in DELEGATES:
        delegate_id = make_id(name)
        out_path = ATTENDEES_DIR / f'attendee_{delegate_id}.json'
        if not out_path.exists():
            continue
        data = json.loads(out_path.read_text(encoding='utf-8'))
        card_metadata.append({k: data[k] for k in [
            'id', 'name', 'state', 'stateSize',
            'occupationCategory', 'birthYear', 'ageAtConvention', 'ageDecade',
            'signedConstitution', 'photoCard', 'photoProfile',
        ] if k in data})
    out = ATTENDEES_DIR / 'attendees.json'
    out.write_text(json.dumps(card_metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✓  Rebuilt data/attendees/attendees.json ({len(card_metadata)} delegates)')


def main():
    force = '--force' in sys.argv
    photos_only = '--photos-only' in sys.argv
    ATTENDEES_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    if photos_only:
        print('Photo-only mode: downloading missing photos...\n')
        photos_only_mode()
        return

    print(f'Fetching {len(DELEGATES)} delegates (force={force})...\n')

    card_metadata = []
    errors = []

    for i, (name, state, signed) in enumerate(DELEGATES, 1):
        print(f'[{i:2}/{len(DELEGATES)}] {name}')
        data = fetch_delegate(name, state, signed, force=force)
        if data:
            card_metadata.append({k: data[k] for k in [
                'id', 'name', 'state', 'stateSize',
                'occupationCategory', 'birthYear', 'ageAtConvention', 'ageDecade',
                'signedConstitution', 'photoCard', 'photoProfile',
            ] if k in data})
        else:
            errors.append(name)

    out = ATTENDEES_DIR / 'attendees.json'
    out.write_text(json.dumps(card_metadata, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f'\n{"="*50}')
    print(f'✓  {len(card_metadata)} delegates saved to data/attendees/attendees.json')
    print(f'✓  Individual JSON files in data/attendees/attendee_*.json')
    print(f'✓  Photos in images/attendees/')
    if errors:
        print(f'✗  {len(errors)} failures: {", ".join(errors)}')
    print('\nNext: python3 scripts/build_bundle.py')


if __name__ == '__main__':
    main()
