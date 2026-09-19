"""Snapshot protected inputs before retargeting; fail if an existing input changes."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'test-output/xia-zhiyao-locomotion'
BASELINE = OUT / 'protected.json'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

OUT.mkdir(parents=True, exist_ok=True)
if '--before' in sys.argv:
    assert not BASELINE.exists(), 'Never overwrite the before snapshot'
    paths = []
    for folder in ['assets/characters', 'assets/animations', 'assets/weapons', 'survivors', 'weapons', 'missions', 'core', 'data', 'art/blender/characters', 'art/blender/rigs']:
        paths.extend(p for p in (ROOT/folder).rglob('*') if p.is_file())
    BASELINE.write_text(json.dumps({str(p.relative_to(ROOT)).replace('\\', '/'): digest(p) for p in paths}, indent=2), encoding='utf-8')
    print(f'{len(paths)} protected inputs recorded')
else:
    before = json.loads(BASELINE.read_text(encoding='utf-8'))
    changes = [p for p, h in before.items() if not (ROOT/p).exists() or digest(ROOT/p) != h]
    report = {'count': len(before), 'changes': changes}
    (OUT/'protected-result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))
    sys.exit(bool(changes))
