import { useMemo, useState } from 'react';
import { type DevToolsTab, useToolStore } from '../store/toolStore';
import {
  base64ToUtf8,
  createPassword,
  createToken,
  createUuid,
  csvToJson,
  csvToMarkdownTable,
  decodeHtmlEntities,
  decodeJwt,
  decodeUnicodeEscapes,
  diffLines,
  digestText,
  encodeHtmlEntities,
  formatJson,
  generateRandomStrings,
  jsonArrayToCsv,
  jsonToQueryString,
  nowTimestampInput,
  queryStringToJson,
  RANDOM_STRING_PRESETS,
  type RandomStringPresetId,
  readTimestamp,
  shiftDate,
  type ToolResult,
  utf8ToBase64,
} from '../tools/devToolUtils';
import PlushSelect from '../ui/PlushSelect';
import './MiniApps.css';

const DEV_TABS: Array<{ id: DevToolsTab; label: string }> = [
  { id: 'json', label: 'JSON' },
  { id: 'time', label: '时间' },
  { id: 'encoding', label: '编码' },
  { id: 'hash', label: 'ID/哈希' },
  { id: 'diff', label: 'Diff' },
  { id: 'csv', label: 'CSV' },
];

export default function DevToolsWindow() {
  const tab = useToolStore((s) => s.devToolsTab);
  const setTab = useToolStore((s) => s.setDevToolsTab);
  const jsonDraft = useToolStore((s) => s.devJsonDraft);
  const setJsonDraft = useToolStore((s) => s.setDevJsonDraft);
  const timeDraft = useToolStore((s) => s.devTimeDraft);
  const setTimeDraft = useToolStore((s) => s.setDevTimeDraft);
  const encodingDraft = useToolStore((s) => s.devEncodingDraft);
  const setEncodingDraft = useToolStore((s) => s.setDevEncodingDraft);
  const diffLeft = useToolStore((s) => s.devDiffLeft);
  const setDiffLeft = useToolStore((s) => s.setDevDiffLeft);
  const diffRight = useToolStore((s) => s.devDiffRight);
  const setDiffRight = useToolStore((s) => s.setDevDiffRight);
  const csvDraft = useToolStore((s) => s.devCsvDraft);
  const setCsvDraft = useToolStore((s) => s.setDevCsvDraft);
  const randomLength = useToolStore((s) => s.devRandomLength);
  const setRandomLength = useToolStore((s) => s.setDevRandomLength);
  const randomPreset = useToolStore((s) => s.devRandomPreset);
  const setRandomPreset = useToolStore((s) => s.setDevRandomPreset);
  const randomCount = useToolStore((s) => s.devRandomCount);
  const setRandomCount = useToolStore((s) => s.setDevRandomCount);
  const [result, setResult] = useState<ToolResult>({
    ok: true,
    output: '',
    message: '就绪',
  });
  const [hashInput, setHashInput] = useState('');
  const [shiftAmount, setShiftAmount] = useState('7');
  const [shiftUnit, setShiftUnit] = useState('day');
  const [trimDiff, setTrimDiff] = useState(false);
  const diffRows = useMemo(
    () => diffLines(diffLeft, diffRight, trimDiff),
    [diffLeft, diffRight, trimDiff],
  );
  const changedCount = diffRows.filter((row) => row.type !== 'same').length;

  async function copyOutput() {
    if (!result.output) return;
    await navigator.clipboard?.writeText(result.output);
    setResult((value) => ({ ...value, message: '已复制' }));
  }

  function applyJson(action: 'format' | 'compact' | 'toQuery' | 'fromQuery') {
    const next =
      action === 'format'
        ? formatJson(jsonDraft)
        : action === 'compact'
          ? formatJson(jsonDraft, true)
          : action === 'toQuery'
            ? jsonToQueryString(jsonDraft)
            : queryStringToJson(jsonDraft);
    setResult(next);
    if (next.ok && (action === 'format' || action === 'compact' || action === 'fromQuery')) {
      setJsonDraft(next.output);
    }
  }

  function applyTime(action: 'read' | 'now' | 'shift') {
    if (action === 'now') {
      const now = nowTimestampInput();
      setTimeDraft(now);
      setResult(readTimestamp(now));
      return;
    }
    if (action === 'shift') {
      const shifted = shiftDate(timeDraft, Number(shiftAmount), shiftUnit);
      setResult(
        shifted
          ? {
              ok: true,
              output: `ISO: ${shifted.iso}\n本地: ${shifted.local}\n秒: ${shifted.seconds}\n毫秒: ${shifted.milliseconds}`,
              message: '已计算',
            }
          : { ok: false, output: '', message: '时间无效' },
      );
      return;
    }
    setResult(readTimestamp(timeDraft));
  }

  function applyEncoding(action: string) {
    if (action === 'base64Encode') {
      setResult({ ok: true, output: utf8ToBase64(encodingDraft), message: '已编码' });
    } else if (action === 'base64Decode') {
      setResult(base64ToUtf8(encodingDraft));
    } else if (action === 'urlEncode') {
      setResult({ ok: true, output: encodeURIComponent(encodingDraft), message: '已编码' });
    } else if (action === 'urlDecode') {
      try {
        setResult({ ok: true, output: decodeURIComponent(encodingDraft), message: '已解码' });
      } catch {
        setResult({ ok: false, output: '', message: 'URL 编码无效' });
      }
    } else if (action === 'unicode') {
      setResult({ ok: true, output: decodeUnicodeEscapes(encodingDraft), message: '已转换' });
    } else if (action === 'htmlEncode') {
      setResult({ ok: true, output: encodeHtmlEntities(encodingDraft), message: '已编码' });
    } else if (action === 'htmlDecode') {
      setResult({ ok: true, output: decodeHtmlEntities(encodingDraft), message: '已解码' });
    } else {
      setResult(decodeJwt(encodingDraft));
    }
  }

  async function applyHash(action: string) {
    if (action === 'uuid') {
      setResult({ ok: true, output: createUuid(), message: '已生成' });
    } else if (action === 'token') {
      setResult({ ok: true, output: createToken(32), message: '已生成' });
    } else if (action === 'password') {
      setResult({ ok: true, output: createPassword(18), message: '已生成' });
    } else {
      const algorithm = action === 'sha1' ? 'SHA-1' : 'SHA-256';
      setResult({ ok: true, output: await digestText(hashInput, algorithm), message: '已计算' });
    }
  }

  function applyRandomString(overrides?: {
    preset?: RandomStringPresetId;
    length?: number;
    count?: number;
  }) {
    try {
      const output = generateRandomStrings({
        length: overrides?.length ?? randomLength,
        preset: overrides?.preset ?? randomPreset,
        count: overrides?.count ?? randomCount,
      }).join('\n');
      setResult({ ok: true, output, message: '已生成' });
    } catch (error) {
      setResult({
        ok: false,
        output: '',
        message: error instanceof Error ? error.message : '生成失败',
      });
    }
  }

  function applyUuidBatch() {
    const count = Math.min(20, Math.max(1, Math.floor(randomCount)));
    const output = Array.from({ length: count }, () => createUuid()).join('\n');
    setResult({ ok: true, output, message: '已生成' });
  }

  function applyCsv(action: 'csvToJson' | 'tsvToJson' | 'jsonToCsv' | 'markdown') {
    const next =
      action === 'csvToJson'
        ? csvToJson(csvDraft)
        : action === 'tsvToJson'
          ? csvToJson(csvDraft, '\t')
          : action === 'jsonToCsv'
            ? jsonArrayToCsv(csvDraft)
            : csvToMarkdownTable(csvDraft);
    setResult(next);
  }

  return (
    <div className="dock-app-window mini-app toolbox-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>开发工具箱</h2>
        </div>
        <span className={`dock-app-window__badge ${result.ok ? '' : 'is-danger'}`}>
          {result.message}
        </span>
      </header>

      <fieldset className="mini-segmented toolbox-tabs">
        <legend className="mini-app__sr-only">开发工具类别</legend>
        {DEV_TABS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === tab ? 'is-active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      <section className="toolbox-body">
        {tab === 'json' ? (
          <ToolPanel
            title="JSON"
            input={jsonDraft}
            onInput={setJsonDraft}
            actions={[
              ['格式化', () => applyJson('format')],
              ['压缩', () => applyJson('compact')],
              ['转 Query', () => applyJson('toQuery')],
              ['Query 转 JSON', () => applyJson('fromQuery')],
            ]}
          />
        ) : null}

        {tab === 'time' ? (
          <div className="toolbox-panel">
            <div className="toolbox-panel__head">时间</div>
            <input
              className="mini-input"
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              placeholder="Unix、ISO 或日期"
            />
            <div className="toolbox-inline">
              <input
                className="mini-input"
                value={shiftAmount}
                onChange={(e) => setShiftAmount(e.target.value)}
                inputMode="numeric"
              />
              <PlushSelect
                value={shiftUnit}
                onChange={setShiftUnit}
                ariaLabel="时间单位"
                options={[
                  { value: 'day', label: '天' },
                  { value: 'hour', label: '小时' },
                  { value: 'minute', label: '分钟' },
                  { value: 'month', label: '月' },
                ]}
              />
            </div>
            <div className="toolbox-actions">
              <button type="button" onClick={() => applyTime('now')}>
                当前时间
              </button>
              <button type="button" onClick={() => applyTime('read')}>
                解析
              </button>
              <button type="button" onClick={() => applyTime('shift')}>
                加减
              </button>
            </div>
          </div>
        ) : null}

        {tab === 'encoding' ? (
          <ToolPanel
            title="编码"
            input={encodingDraft}
            onInput={setEncodingDraft}
            actions={[
              ['Base64 编码', () => applyEncoding('base64Encode')],
              ['Base64 解码', () => applyEncoding('base64Decode')],
              ['URL 编码', () => applyEncoding('urlEncode')],
              ['URL 解码', () => applyEncoding('urlDecode')],
              ['Unicode', () => applyEncoding('unicode')],
              ['HTML 编码', () => applyEncoding('htmlEncode')],
              ['HTML 解码', () => applyEncoding('htmlDecode')],
              ['JWT 解码', () => applyEncoding('jwt')],
            ]}
          />
        ) : null}

        {tab === 'hash' ? (
          <div className="toolbox-panel toolbox-panel--hash">
            <div className="toolbox-panel__head">ID / 哈希</div>
            <textarea
              className="mini-input mini-input--textarea"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              placeholder="待计算文本"
              spellCheck={false}
            />
            <div className="toolbox-actions">
              <button type="button" onClick={() => void applyHash('uuid')}>
                UUID
              </button>
              <button type="button" onClick={() => void applyHash('token')}>
                Token
              </button>
              <button type="button" onClick={() => void applyHash('password')}>
                密码
              </button>
              <button type="button" onClick={() => void applyHash('sha256')}>
                SHA-256
              </button>
              <button type="button" onClick={() => void applyHash('sha1')}>
                SHA-1
              </button>
            </div>
            <div className="toolbox-subpanel">
              <div className="toolbox-panel__head">随机字符串</div>
              <div className="toolbox-inline">
                <label>
                  长度
                  <input
                    className="mini-input"
                    type="number"
                    min="1"
                    max="256"
                    value={randomLength}
                    onChange={(e) => setRandomLength(Number.parseInt(e.target.value || '0', 10))}
                  />
                </label>
                <label>
                  数量
                  <input
                    className="mini-input"
                    type="number"
                    min="1"
                    max="20"
                    value={randomCount}
                    onChange={(e) => setRandomCount(Number.parseInt(e.target.value || '0', 10))}
                  />
                </label>
                <PlushSelect
                  value={randomPreset}
                  onChange={(value) => setRandomPreset(value as RandomStringPresetId)}
                  ariaLabel="随机字符集"
                  options={RANDOM_STRING_PRESETS.map((preset) => ({
                    value: preset.id,
                    label: preset.label,
                  }))}
                />
              </div>
              <div className="toolbox-actions">
                <button type="button" onClick={() => applyRandomString()}>
                  生成
                </button>
                <button type="button" onClick={() => applyRandomString({ preset: 'base64url' })}>
                  Base64URL
                </button>
                <button type="button" onClick={() => applyRandomString({ preset: 'hex' })}>
                  Hex
                </button>
                <button type="button" onClick={applyUuidBatch}>
                  UUID 批量
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'diff' ? (
          <div className="toolbox-panel toolbox-panel--wide">
            <div className="toolbox-panel__head">
              <span>Diff</span>
              <label className="toolbox-check">
                <input
                  type="checkbox"
                  checked={trimDiff}
                  onChange={(e) => setTrimDiff(e.target.checked)}
                />
                忽略首尾空白
              </label>
            </div>
            <div className="toolbox-split">
              <textarea
                className="mini-input mini-input--textarea"
                value={diffLeft}
                onChange={(e) => setDiffLeft(e.target.value)}
                placeholder="左侧文本"
                spellCheck={false}
              />
              <textarea
                className="mini-input mini-input--textarea"
                value={diffRight}
                onChange={(e) => setDiffRight(e.target.value)}
                placeholder="右侧文本"
                spellCheck={false}
              />
            </div>
            <div className="diff-list">
              {diffRows.slice(0, 80).map((row) => (
                <div key={row.id} className={`diff-row diff-row--${row.type}`}>
                  <span>{row.left}</span>
                  <span>{row.right}</span>
                </div>
              ))}
            </div>
            <div className="mini-list__empty">变更 {changedCount} 行</div>
          </div>
        ) : null}

        {tab === 'csv' ? (
          <ToolPanel
            title="CSV"
            input={csvDraft}
            onInput={setCsvDraft}
            actions={[
              ['CSV 转 JSON', () => applyCsv('csvToJson')],
              ['TSV 转 JSON', () => applyCsv('tsvToJson')],
              ['JSON 转 CSV', () => applyCsv('jsonToCsv')],
              ['转 Markdown', () => applyCsv('markdown')],
            ]}
          />
        ) : null}

        <section className="toolbox-result" aria-label="结果">
          <div className="toolbox-panel__head">
            <span>结果</span>
            <button type="button" className="mini-app__plain" onClick={() => void copyOutput()}>
              复制
            </button>
          </div>
          <pre>{result.output || result.message}</pre>
        </section>
      </section>
    </div>
  );
}

interface ToolPanelProps {
  title: string;
  input: string;
  actions: Array<[string, () => void]>;
  onInput: (value: string) => void;
}

function ToolPanel({ title, input, actions, onInput }: ToolPanelProps) {
  return (
    <div className="toolbox-panel">
      <div className="toolbox-panel__head">{title}</div>
      <textarea
        className="mini-input mini-input--textarea"
        value={input}
        onChange={(e) => onInput(e.target.value)}
        spellCheck={false}
      />
      <div className="toolbox-actions">
        {actions.map(([label, action]) => (
          <button type="button" key={label} onClick={action}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
