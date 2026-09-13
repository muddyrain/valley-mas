#!/usr/bin/env node
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const stagedAdded = new Set(
  execFileSync('git', ['diff', '--cached', '--diff-filter=A', '--name-only'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean),
);
const files = process.argv
  .slice(2)
  .filter(Boolean)
  .filter((f) => stagedAdded.has(f.replaceAll('\\', '/')));
const blocked = /(?:^|_)(?:v[1-3]|final2?|new|old|copy|temp|tmp)(?:_|\.|$)/i;
const numbered = /^(?:0[1-3])_/;
const allowed = /^(?:ENM|CHR|CAMP|ITEM|SKILL)_\d{3}_/i;
const allowedUi = /^camp_ui_\d{3}_/i;
const specs = /(?:^|[_-])(?:20k|30k|lod\d+)(?:[_\-.]|$)/i;
const violations = files
  .filter((f) => f.replaceAll('\\', '/').startsWith('apps/blue-hour/'))
  .filter((f) =>
    /\.(gd|gdshader|tscn|tres|res|glb|gltf|png|jpg|jpeg|webp|svg|wav|ogg|mp3)$/i.test(f),
  )
  .filter((f) => {
    const n = path.basename(f);
    return (
      !(allowed.test(n) || allowedUi.test(n) || specs.test(n)) &&
      (blocked.test(n) || numbered.test(n))
    );
  });
if (violations.length) {
  console.error('❌ Blue Hour naming hygiene failed:');
  violations.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}
console.log('✅ Blue Hour naming hygiene passed');
