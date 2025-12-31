#!/usr/bin/env python3
"""Generate SQL seed file for Minnesota Senate from senate.md"""

import re

def escape_sql(s):
    """Escape SQL string values"""
    if s is None:
        return 'NULL'
    # Replace single quotes with two single quotes for SQL
    escaped = s.replace("'", "''")
    return f"'{escaped}'"

with open('senate.md', 'r') as f:
    content = f.read()

# Parse senators from markdown
senators = []
current_senator = None
office_lines = []

for line in content.split('\n'):
    line = line.strip()
    
    # Match senator header: ## X. Name
    header_match = re.match(r'^##\s+(\d+)\.\s+(.+)$', line)
    if header_match:
        # Save previous senator if exists
        if current_senator:
            if office_lines:
                current_senator['address'] = '\n'.join(office_lines).strip()
            senators.append(current_senator)
        
        # Start new senator
        current_senator = {
            'number': header_match.group(1),
            'name': header_match.group(2).strip(),
            'district': None,
            'party': None,
            'title': None,
            'phone': None,
            'email': None,
            'address': None,
        }
        office_lines = []
        continue
    
    if not current_senator:
        continue
    
    # Match fields
    if line.startswith('**District:**'):
        current_senator['district'] = line.replace('**District:**', '').strip()
    elif line.startswith('**Party:**'):
        current_senator['party'] = line.replace('**Party:**', '').strip()
    elif line.startswith('**Title:**'):
        current_senator['title'] = line.replace('**Title:**', '').strip()
    elif line.startswith('**Phone:**'):
        current_senator['phone'] = line.replace('**Phone:**', '').strip()
        # Address is complete when we hit phone
        if office_lines:
            current_senator['address'] = '\n'.join(office_lines).strip()
            office_lines = []
    elif line.startswith('**Email:**'):
        email_text = line.replace('**Email:**', '').strip()
        # Extract email from markdown link or plain text
        email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', email_text)
        if email_match:
            current_senator['email'] = email_match.group(1)
        elif 'Use Email Form' in email_text:
            current_senator['email'] = None
    elif line.startswith('**Office:**'):
        office_lines = []  # Reset office lines
        continue  # Office header, next lines are address
    elif line and not line.startswith('---') and not line.startswith('**') and not line.startswith('#'):
        # This is likely an address line (before phone/email)
        if current_senator.get('phone') is None:
            office_lines.append(line)

# Don't forget the last senator
if current_senator:
    if office_lines:
        current_senator['address'] = '\n'.join(office_lines).strip()
    senators.append(current_senator)

# Generate SQL
sql_lines = [
    "-- Seed Minnesota Senate members",
    "-- Generated from senate.md",
    "",
    "-- ============================================================================",
    "-- STEP 1: Insert senators into people table",
    "-- ============================================================================",
    "",
]

for senator in senators:
    # Generate slug from name
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', senator['name'].lower())
    slug = re.sub(r'\s+', '-', slug)
    slug = slug.strip('-')
    
    name = escape_sql(senator['name'])
    party = escape_sql(senator['party'])
    district = escape_sql(senator['district'])
    email = escape_sql(senator['email'])
    phone = escape_sql(senator['phone'])
    address = escape_sql(senator['address'])
    slug_val = escape_sql(slug)
    
    sql_lines.append(f"INSERT INTO civic.people (name, slug, party, district, email, phone, address)")
    sql_lines.append(f"VALUES ({name}, {slug_val}, {party}, {district}, {email}, {phone}, {address})")
    sql_lines.append(f"ON CONFLICT (slug) DO UPDATE SET")
    sql_lines.append(f"  name = EXCLUDED.name,")
    sql_lines.append(f"  party = EXCLUDED.party,")
    sql_lines.append(f"  district = EXCLUDED.district,")
    sql_lines.append(f"  email = EXCLUDED.email,")
    sql_lines.append(f"  phone = EXCLUDED.phone,")
    sql_lines.append(f"  address = EXCLUDED.address;")
    sql_lines.append("")

sql_lines.append("-- ============================================================================")
sql_lines.append("-- STEP 2: Create roles for senators")
sql_lines.append("-- ============================================================================")
sql_lines.append("")

# Get Minnesota Senate org ID
sql_lines.append("-- First, ensure Minnesota Senate org exists")
sql_lines.append("INSERT INTO civic.orgs (name, slug, org_type, parent_id)")
sql_lines.append("SELECT 'Minnesota Senate', 'mn-senate', 'agency',")
sql_lines.append("  (SELECT id FROM civic.orgs WHERE slug = 'legislative')")
sql_lines.append("WHERE NOT EXISTS (SELECT 1 FROM civic.orgs WHERE slug = 'mn-senate');")
sql_lines.append("")

sql_lines.append("-- Create roles for each senator")
for senator in senators:
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', senator['name'].lower())
    slug = re.sub(r'\s+', '-', slug)
    slug = slug.strip('-')
    
    title = senator.get('title') or 'Senator'
    title_escaped = escape_sql(title)
    
    sql_lines.append(f"INSERT INTO civic.roles (person_id, org_id, title, is_current)")
    sql_lines.append(f"SELECT")
    sql_lines.append(f"  (SELECT id FROM civic.people WHERE slug = '{slug}'),")
    sql_lines.append(f"  (SELECT id FROM civic.orgs WHERE slug = 'mn-senate'),")
    sql_lines.append(f"  {title_escaped},")
    sql_lines.append(f"  true")
    sql_lines.append(f"WHERE EXISTS (SELECT 1 FROM civic.people WHERE slug = '{slug}')")
    sql_lines.append(f"  AND EXISTS (SELECT 1 FROM civic.orgs WHERE slug = 'mn-senate')")
    sql_lines.append(f"ON CONFLICT DO NOTHING;")
    sql_lines.append("")

with open('supabase/migrations/302_seed_mn_senate.sql', 'w') as f:
    f.write('\n'.join(sql_lines))

print(f"Generated seed file with {len(senators)} senators")

