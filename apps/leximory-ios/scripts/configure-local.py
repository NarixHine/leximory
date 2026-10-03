#!/usr/bin/env python3
"""Copy only public Supabase configuration into the local native build."""
import json
import re
from pathlib import Path
root = Path(__file__).resolve().parents[3]
source = root / 'apps/leximory/.env'
values = {}
for line in source.read_text().splitlines():
    match = re.match(r'^(?:export\s+)?(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$', line)
    if match:
        values[match[1]] = match[2].strip('"\'')
url = values.get('NEXT_PUBLIC_SUPABASE_URL')
key = values.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if not url or not url.startswith('https://') or not key:
    raise SystemExit('Public Supabase URL and anon key are required in apps/leximory/.env.')
output = root / 'apps/leximory-ios/App/Resources/Connection.json'
output.write_text(json.dumps({'apiURL': 'http://localhost:3001', 'supabaseURL': url, 'anonKey': key}, indent=2) + '\n')
print('Local native configuration created. No private server keys are included.')
