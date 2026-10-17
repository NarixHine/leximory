#!/usr/bin/env python3
"""Check bundled rules offline, or regenerate with a pinned ConverterTool build."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.request

APP = Path(__file__).resolve().parent.parent
SOURCES = APP / 'scripts/adblocking-sources'
OUTPUT = APP / 'App/Resources/Browser/AdBlocking'
MANIFEST = OUTPUT / 'ad-blocking-manifest.json'
CONVERTER = {'repository': 'https://github.com/AdguardTeam/SafariConverterLib',
             'tag': 'v4.3.0', 'commit': '7a2e93f0afa70479cc59985f332025236c3f0c39',
             'safariVersion': '26.0', 'advancedBlocking': False}

def digest(data):
    return hashlib.sha256(data).hexdigest()

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
parser.add_argument('--refresh', action='store_true', help='Explicitly fetch and pin new source snapshots')
parser.add_argument('--converter', type=Path, help='ConverterTool built from the pinned commit')
args = parser.parse_args()
if args.check and args.refresh:
    parser.error('--check and --refresh are mutually exclusive')
if not args.check and not args.converter:
    parser.error('regeneration requires --converter')

previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else None
inputs, source_records = [], []
for name in ['easylist', 'easyprivacy']:
    url = f'https://easylist.to/easylist/{name}.txt'
    path = SOURCES / f'{name}.txt.gz'
    if args.refresh:
        data = urllib.request.urlopen(url, timeout=60).read()
        if not data.startswith(b'[Adblock Plus'):
            raise SystemExit(f'Unexpected filter response: {name}')
        path.write_bytes(gzip.compress(data, mtime=0))
    data = gzip.decompress(path.read_bytes())
    record = {'name': name, 'url': url, 'sha256': digest(data)}
    source_records.append(record)
    inputs.append(data)
if args.check:
    assert previous and previous['converter'] == CONVERTER, 'Converter pin changed'
    assert previous['sources'] == source_records, 'Source snapshot changed; review and regenerate'
    for file in previous['files']:
        assert digest((OUTPUT / (file['name'] + '.json')).read_bytes()) == file['sha256'], 'Bundled rules changed'
    if not args.converter:
        print('Source snapshots and bundled rule hashes match.')
        raise SystemExit(0)

with tempfile.TemporaryDirectory(prefix='leximory-ad-rules-') as directory:
    root = Path(directory)
    source = root / 'combined.txt'
    source.write_bytes(b'\n'.join(inputs))
    converted = root / 'converted.json'
    subprocess.run([str(args.converter.resolve()), 'convert', '--safari-version', '26.0',
                    '--advanced-blocking', 'false', '--input-path', str(source),
                    '--safari-rules-json-path', str(converted),
                    '--advanced-blocking-rules-path', str(root / 'excluded.txt')], check=True,
                   env={**os.environ, 'SWIFT_DETERMINISTIC_HASHING': '1'})
    rules = json.loads(converted.read_text())
    assert rules and len(rules) < 149_000, 'Review WebKit rule limits before adding more rules'
    assert {r['action']['type'] for r in rules} <= {'block', 'css-display-none', 'ignore-previous-rules'}
    # Limit network blocking to subresources. A document-wide exception would also disable cosmetic rules.
    resource_types = ['image', 'style-sheet', 'script', 'font', 'media', 'fetch', 'websocket', 'ping', 'other']
    filtered = []
    for rule in rules:
        if rule['action']['type'] == 'block':
            trigger = rule['trigger']
            types = [value for value in trigger.get('resource-type', resource_types) if value != 'document']
            if not types:
                continue
            trigger['resource-type'] = types
        filtered.append(rule)
    rules = filtered
    encoded = (json.dumps(rules, ensure_ascii=True, sort_keys=True, separators=(',', ':')) + '\n').encode()
    manifest = {'schemaVersion': 1, 'converter': CONVERTER, 'sources': source_records,
                'ruleCount': len(rules), 'exclusions': ['advanced scriptlets', 'extended CSS', 'HTML filtering'],
                'files': [{'name': 'ad-blocking-rules', 'sha256': digest(encoded)}]}
    if args.check:
        assert manifest == previous, 'Conversion differs from the committed artifact'
        print('Conversion reproduces the bundled artifact.')
    else:
        (OUTPUT / 'ad-blocking-rules.json').write_bytes(encoded)
        MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
        print(f'Prepared {len(rules)} native WebKit rules.')
