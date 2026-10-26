"""Build and verify the shallow skill ZIP accepted by WorkBuddy's depth rule."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
skill = root / 'skills/yijuchengpian'
version = json.loads((root / 'package.json').read_text())['version']
# WorkBuddy requires additional top-level metadata beyond the generic Skill format.
header = (skill / 'SKILL.md').read_text(encoding='utf-8').split('---', 2)
if len(header) != 3 or header[0].strip():
    raise ValueError('SKILL.md must begin with YAML frontmatter')
required = ['version', 'display_name', 'display_name_en', 'description_zh', 'description_en']
metadata = {}
for field in required:
    matches = re.findall(r'^' + field + r':\s*(.+)$', header[1], re.MULTILINE)
    if len(matches) != 1:
        raise ValueError(f'Missing or duplicate WorkBuddy metadata: {field}')
    # These fields use JSON-quoted strings, which are valid YAML and avoid ambiguity.
    value = json.loads(matches[0])
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Empty WorkBuddy metadata: {field}')
    metadata[field] = value
if metadata['version'] != version or not re.fullmatch(r'\d+\.\d+\.\d+', version):
    raise ValueError('Skill version must match package.json and use major.minor.patch')
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'output/releases'
out.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in skill.rglob('*') if p.is_file())
for path in files:
    name = path.relative_to(skill)
    if path.is_symlink() or len(name.parts) > 2 or path.suffix != '.md':
        raise ValueError(f'Skill package must contain shallow Markdown files only: {name}')
    for link in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if '://' in link:
            continue
        target = (path.parent / link.split('#')[0]).resolve()
        if not target.is_relative_to(skill) or not target.is_file():
            raise ValueError(f'Invalid skill reference: {name} -> {link}')
archive = out / f'yijuchengpian-{version}-workbuddy-skill.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in files:
        z.write(path, path.relative_to(skill).as_posix())
with zipfile.ZipFile(archive) as z:
    names = z.namelist()
    assert 'SKILL.md' in names and 'schema.md' in names
    assert all(len(PurePosixPath(name).parts) <= 2 for name in names)
    assert len([n for n in names if n.startswith('references/style-')]) == 6
    assert z.testzip() is None
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / f'SHA256SUMS-{version}.txt').write_text(f'{checksum}  {archive.name}\n')
print(json.dumps({'archive': str(archive), 'files': names, 'maxPathComponents': 2, 'workbuddyMetadata': metadata, 'sha256': checksum}, ensure_ascii=False, indent=2))
