#!/usr/bin/env python3
"""
Download IRS Form 990 PDFs for CRG Houston organizations_990 via ProPublica Nonprofit Explorer API.

Usage:
    python3 scripts/download-990s.py

Input:
    scripts/data/CRG 2026 Master Data - organizations_990.csv  - exported from Google Sheets "organizations_990" tab
    Expected columns: id_no, organization, org_parent, org_assistance, contact, telephone, email

    scripts/data/CRG 2026 Master Data - directory.csv      - (optional) exported from Google Sheets "directory" tab
    Used only to look up org webpages for the report. Script works fine without it.

What it does:
    1. Reads organization names from the CSV
    2. Searches ProPublica for each org's EIN
    3. Downloads the most recent 990 PDF for each org
    4. Saves PDFs to public/documents/990s/ with consistent naming
    5. Generates a summary report (CSV) of results

Requirements:
    pip3 install requests

Notes:
    - No API key needed (ProPublica API is free for non-commercial use)
    - Adds a 1-second delay between API calls to be respectful
    - Church/religious orgs exempt from 990 filing will show as "no filings"
    - Re-running is safe — already-downloaded PDFs are skipped
    - Run from the project root: python3 scripts/download-990s.py
"""

import os
import sys
import time
import csv
import re
import requests
from datetime import datetime

# --- Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..')
ORG_CSV = os.path.join(SCRIPT_DIR, 'data', 'CRG 2026 Master Data - organizations_990.csv')
DIR_CSV = os.path.join(SCRIPT_DIR, 'data', 'CRG 2026 Master Data - directory.csv')
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'documents', '990s')
REPORT_PATH = os.path.join(OUTPUT_DIR, '_download_report.csv')
PROPUBLICA_SEARCH = 'https://projects.propublica.org/nonprofits/api/v2/search.json'
PROPUBLICA_ORG = 'https://projects.propublica.org/nonprofits/api/v2/organizations/{ein}.json'
DELAY_SECONDS = 1.0
STATE_FILTER = 'TX'
MAX_DOWNLOADS = 0  # Stop after this many successful PDF downloads (set to 0 for unlimited)

# Browser-like headers to avoid 403 blocks on PDF downloads
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://projects.propublica.org/nonprofits/',
}

# Common geographic/generic words to ignore when matching org names
STOP_WORDS = {
    'harris', 'county', 'houston', 'texas', 'greater', 'area', 'city',
    'fort', 'bend', 'montgomery', 'galveston', 'brazoria', 'the',
    'north', 'south', 'east', 'west', 'northwest', 'southeast', 'southwest',
    'first', 'second', 'third', 'new', 'old', 'central',
    'inc', 'llc', 'corp', 'org', 'association', 'society',
}


def clean_org_name(name):
    """Clean org name for use as filename."""
    clean = re.sub(r'[^\w\s-]', '', name)
    clean = re.sub(r'\s+', '_', clean.strip())
    return clean[:80]


def search_propublica(org_name):
    """Search ProPublica for an organization. Returns list of matches."""
    try:
        params = {'q': org_name, 'state[id]': STATE_FILTER}
        resp = requests.get(PROPUBLICA_SEARCH, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data.get('organizations', [])
    except Exception as e:
        print(f"  [ERROR] Search failed: {e}")
        return []


def get_org_filings(ein):
    """Get organization details and filings by EIN."""
    try:
        url = PROPUBLICA_ORG.format(ein=ein)
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  [ERROR] Filing lookup failed for EIN {ein}: {e}")
        return None


def find_best_match(org_name, results):
    """Find the best matching org from search results. Conservative — prefers no match over wrong match."""
    if not results:
        return None

    name_lower = org_name.lower().strip()

    # 1. Exact match
    for r in results:
        if r.get('name', '').lower().strip() == name_lower:
            return r

    # 2. Starts-with match (either direction) — but require at least 10 chars overlap
    for r in results:
        rname = r.get('name', '').lower().strip()
        if len(name_lower) >= 10 and len(rname) >= 10:
            if rname.startswith(name_lower) or name_lower.startswith(rname):
                return r

    # 3. Core-name substring match (strip common suffixes)
    suffixes = r'\s*(inc\.?|corp\.?|llc|foundation|ministries|church|center|of houston|of greater houston)\s*$'
    name_core = re.sub(suffixes, '', name_lower, flags=re.IGNORECASE).strip()
    for r in results:
        rname = r.get('name', '').lower().strip()
        rname_core = re.sub(suffixes, '', rname, flags=re.IGNORECASE).strip()
        if len(name_core) > 5 and len(rname_core) > 5:
            if name_core in rname_core or rname_core in name_core:
                return r

    # 4. Significant word overlap — exclude stop words, require 50%+ of meaningful words to match
    name_words = set(re.findall(r'\w{3,}', name_lower)) - STOP_WORDS
    if len(name_words) >= 2:
        for r in results:
            rname = r.get('name', '').lower()
            r_words = set(re.findall(r'\w{3,}', rname)) - STOP_WORDS
            overlap = name_words & r_words
            # Require at least 50% of the search org's meaningful words to match
            if len(overlap) >= 2 and len(overlap) >= len(name_words) * 0.5:
                return r

    # 5. NO fallback — better to report NO_MATCH than return a wrong org
    return None


def download_pdf(url, filepath):
    """Download a PDF file with browser-like headers."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30, stream=True)
        resp.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"  [ERROR] PDF download failed: {e}")
        return False


def read_organizations():
    """Read organizations from CSV file."""
    if not os.path.exists(ORG_CSV):
        print(f"ERROR: Organizations CSV not found at: {ORG_CSV}")
        print(f"\nTo create it:")
        print(f"  1. Open your Google Sheet")
        print(f"  2. Go to the 'CRG 2026 Master Data - organizations' tab")
        print(f"  3. File -> Download -> Comma Separated Values (.csv)")
        print(f"  4. Save as: scripts/data/CRG 2026 Master Data - organizations.csv")
        sys.exit(1)

    orgs = []
    seen = set()
    with open(ORG_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames
        print(f"CSV columns: {columns}")

        # Find the org name column — support multiple possible column names
        org_col = None
        for candidate in ['organization', 'org_parent', 'active and limited org', 'name']:
            if candidate in columns:
                org_col = candidate
                break

        if not org_col:
            print(f"ERROR: Could not find organization name column.")
            print(f"Expected one of: 'organization', 'org_parent', 'active and limited org', 'name'")
            print(f"Found columns: {columns}")
            sys.exit(1)

        print(f"Using column '{org_col}' for organization names")

        # Also check for a separate parent column
        parent_col = 'org_parent' if 'org_parent' in columns else None

        for row in reader:
            org_name = row.get(org_col, '').strip()
            org_parent = row.get(parent_col, '').strip() if parent_col else org_name
            org_parent = org_parent or org_name  # fallback if parent is blank
            if org_name and org_name not in seen:
                seen.add(org_name)
                orgs.append({'name': org_name, 'parent': org_parent})

    # Try to load webpages from directory CSV (optional)
    org_webpages = {}
    if os.path.exists(DIR_CSV):
        print(f"Found directory CSV — loading webpages for report...")
        with open(DIR_CSV, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                parent = row.get('org_parent', '').strip()
                webpage = row.get('webpage', '').strip()
                if parent and webpage and parent not in org_webpages:
                    org_webpages[parent] = webpage
    else:
        print(f"No directory CSV found at {DIR_CSV} — webpages will be blank in report (that's fine).")

    for org in orgs:
        org['webpage'] = org_webpages.get(org['parent'], org_webpages.get(org['name'], ''))

    return orgs


def main():
    print("=" * 70)
    print("CRG Houston - 990 PDF Downloader")
    print("=" * 70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    orgs = read_organizations()
    print(f"Found {len(orgs)} unique organizations\n")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    results = []
    stats = {'found': 0, 'downloaded': 0, 'no_match': 0, 'no_filings': 0, 'error': 0}

    for i, org in enumerate(orgs, 1):
        name = org['name']
        print(f"[{i}/{len(orgs)}] {name}")

        # Search ProPublica — try parent name first, then org name, then simplified
        search_name = org['parent'] if org['parent'] != name else name
        matches = search_propublica(search_name)
        time.sleep(DELAY_SECONDS)

        if not matches and search_name != name:
            matches = search_propublica(name)
            time.sleep(DELAY_SECONDS)

        if not matches:
            simplified = re.sub(r'\([^)]*\)', '', name).strip()
            if simplified != name and len(simplified) > 3:
                matches = search_propublica(simplified)
                time.sleep(DELAY_SECONDS)

        best = find_best_match(name, matches)

        if not best:
            print(f"  -> No match found on ProPublica")
            results.append({
                'organization': name, 'ein': '', 'propublica_name': '',
                'status': 'NO_MATCH', 'tax_year': '', 'pdf_file': '',
                'revenue': '', 'expenses': '', 'webpage': org['webpage']
            })
            stats['no_match'] += 1
            continue

        ein = str(best.get('ein', ''))
        pp_name = best.get('name', '')
        print(f"  -> Match: {pp_name} (EIN: {ein})")
        stats['found'] += 1

        # Get filing details
        filing_data = get_org_filings(ein)
        time.sleep(DELAY_SECONDS)

        if not filing_data:
            results.append({
                'organization': name, 'ein': ein, 'propublica_name': pp_name,
                'status': 'API_ERROR', 'tax_year': '', 'pdf_file': '',
                'revenue': '', 'expenses': '', 'webpage': org['webpage']
            })
            stats['error'] += 1
            continue

        # Find most recent filing with PDF
        filings = filing_data.get('filings_with_data', [])
        filings_no_data = filing_data.get('filings_without_data', [])

        pdf_url = None
        tax_year = ''
        revenue = ''
        expenses = ''

        for f in filings:
            if f.get('pdf_url'):
                pdf_url = f['pdf_url']
                tax_year = str(f.get('tax_prd_yr', ''))
                revenue = f.get('totrevenue', '')
                expenses = f.get('totfuncexpns', '')
                break

        if not pdf_url:
            for f in filings_no_data:
                if f.get('pdf_url'):
                    pdf_url = f['pdf_url']
                    tax_year = str(f.get('tax_prd_yr', ''))
                    break

        if not pdf_url:
            print(f"  -> No 990 PDF available (possibly church-exempt)")
            results.append({
                'organization': name, 'ein': ein, 'propublica_name': pp_name,
                'status': 'NO_FILINGS', 'tax_year': '', 'pdf_file': '',
                'revenue': str(revenue), 'expenses': str(expenses), 'webpage': org['webpage']
            })
            stats['no_filings'] += 1
            continue

        # Download PDF (skip if already exists)
        filename = f"{clean_org_name(name)}_{ein}_{tax_year}.pdf"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
            print(f"  -> Already downloaded: {filename}")
            results.append({
                'organization': name, 'ein': ein, 'propublica_name': pp_name,
                'status': 'ALREADY_EXISTS', 'tax_year': tax_year, 'pdf_file': filename,
                'revenue': str(revenue), 'expenses': str(expenses), 'webpage': org['webpage']
            })
            stats['downloaded'] += 1
            continue

        print(f"  -> Downloading {tax_year} 990: {filename}")
        if download_pdf(pdf_url, filepath):
            size_kb = os.path.getsize(filepath) / 1024
            print(f"  -> Saved ({size_kb:.0f} KB)")
            results.append({
                'organization': name, 'ein': ein, 'propublica_name': pp_name,
                'status': 'DOWNLOADED', 'tax_year': tax_year, 'pdf_file': filename,
                'revenue': str(revenue), 'expenses': str(expenses), 'webpage': org['webpage']
            })
            stats['downloaded'] += 1

            # Stop early if we've hit the download limit (for testing)
            if MAX_DOWNLOADS > 0 and stats['downloaded'] >= MAX_DOWNLOADS:
                print(f"\n  *** Reached MAX_DOWNLOADS limit ({MAX_DOWNLOADS}). Stopping early. ***")
                print(f"  *** Set MAX_DOWNLOADS = 0 in the script to download all. ***")
                break
        else:
            results.append({
                'organization': name, 'ein': ein, 'propublica_name': pp_name,
                'status': 'DOWNLOAD_FAILED', 'tax_year': tax_year, 'pdf_file': '',
                'revenue': str(revenue), 'expenses': str(expenses), 'webpage': org['webpage']
            })
            stats['error'] += 1

    # Write report
    print(f"\n{'=' * 70}")
    print("Writing download report...")
    with open(REPORT_PATH, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'organization', 'ein', 'propublica_name', 'status',
            'tax_year', 'pdf_file', 'revenue', 'expenses', 'webpage'
        ])
        writer.writeheader()
        writer.writerows(results)
    print(f"Report saved: {REPORT_PATH}")

    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"Total organizations:     {len(orgs)}")
    print(f"EIN found on ProPublica: {stats['found']}")
    print(f"PDFs downloaded:         {stats['downloaded']}")
    print(f"No match found:          {stats['no_match']}")
    print(f"No filings (church etc): {stats['no_filings']}")
    print(f"Errors:                  {stats['error']}")
    if len(orgs) > 0:
        print(f"Success rate:            {stats['downloaded']/len(orgs)*100:.1f}%")
    print(f"\nFinished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"PDFs saved to: {os.path.abspath(OUTPUT_DIR)}")
    print(f"Report saved to: {os.path.abspath(REPORT_PATH)}")


if __name__ == '__main__':
    main()
