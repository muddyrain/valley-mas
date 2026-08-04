const fs = require('fs');
const path = 'D:/my-code/valley-mas/apps/web/src/components/ai/ModelPicker.tsx';
const old = fs.readFileSync(path, 'utf8');
const start = old.indexOf('          <DialogHeader className="border-b border-border px-6 py-5">');
const endMarker = '          <div className="border-b border-border p-4">';
const end = old.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error('target not found');
}
const replacement = [
  '          <DialogHeader className="border-b border-border px-6 py-5">',
  '            <div className="flex items-center justify-between gap-3">',
  '              <DialogTitle>选择模型</DialogTitle>',
  '              <Button',
  '                type="button"',
  '                variant="outline"',
  '                size="sm"',
  '                onClick={handleRefreshModels}',
  '                disabled={loading}',
  '                className="h-8 gap-1.5"',
  '              >',
  '                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}',
  '                刷新',
  '              </Button>',
  '            </div>',
  '            <DialogDescription>仅展示已启用且适配当前任务的模型。</DialogDescription>',
  '          </DialogHeader>',
  endMarker,
].join('\n');
const next = old.slice(0, start) + replacement + old.slice(end + endMarker.length);
if (next === old) {
  throw new Error('replacement produced no changes');
}
fs.writeFileSync(path, next, 'utf8');
