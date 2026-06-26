import {
  type BrowserImageMimeType,
  exportImageToDataUrl,
  readImageMetadata,
} from '@valley/browser-media';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type DailyToolsTab, useToolStore } from '../store/toolStore';
import {
  addDateAmount,
  calculateSplitBill,
  diffDates,
  formatBytes,
  formatMoney,
  generatePassword,
  todayInput,
} from '../tools/dailyToolUtils';
import PlushSelect from '../ui/PlushSelect';
import './MiniApps.css';

const DAILY_TABS: Array<{ id: DailyToolsTab; label: string }> = [
  { id: 'date', label: '日期' },
  { id: 'password', label: '密码' },
  { id: 'image', label: '图片' },
  { id: 'split', label: '分账' },
];

export default function DailyToolsWindow() {
  const tab = useToolStore((s) => s.dailyToolsTab);
  const setTab = useToolStore((s) => s.setDailyToolsTab);

  return (
    <div className="dock-app-window mini-app toolbox-window daily-tools-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>日常工具箱</h2>
        </div>
        <span className="dock-app-window__badge">
          {DAILY_TABS.find((item) => item.id === tab)?.label}
        </span>
      </header>

      <fieldset className="mini-segmented toolbox-tabs">
        <legend className="mini-app__sr-only">日常工具类别</legend>
        {DAILY_TABS.map((item) => (
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

      {tab === 'date' ? <DateTool /> : null}
      {tab === 'password' ? <PasswordTool /> : null}
      {tab === 'image' ? <ImageTool /> : null}
      {tab === 'split' ? <SplitBillTool /> : null}
    </div>
  );
}

function DateTool() {
  const start = useToolStore((s) => s.dailyDateStart);
  const end = useToolStore((s) => s.dailyDateEnd);
  const setStart = useToolStore((s) => s.setDailyDateStart);
  const setEnd = useToolStore((s) => s.setDailyDateEnd);
  const [amount, setAmount] = useState('7');
  const [unit, setUnit] = useState('day');
  const diff = useMemo(() => diffDates(start, end), [end, start]);
  const shifted = useMemo(() => addDateAmount(start, Number(amount), unit), [amount, start, unit]);

  useEffect(() => {
    if (!start) setStart(todayInput());
    if (!end) setEnd(todayInput());
  }, [end, setEnd, setStart, start]);

  return (
    <section className="toolbox-body toolbox-body--single">
      <div className="toolbox-panel">
        <div className="toolbox-panel__head">日期计算</div>
        <div className="toolbox-inline">
          <label>
            <span>开始</span>
            <input
              className="mini-input"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            <span>结束</span>
            <input
              className="mini-input"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="toolbox-inline">
          <input
            className="mini-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
          />
          <PlushSelect
            value={unit}
            onChange={setUnit}
            ariaLabel="日期单位"
            options={[
              { value: 'day', label: '天' },
              { value: 'week', label: '周' },
              { value: 'month', label: '月' },
              { value: 'year', label: '年' },
            ]}
          />
        </div>
      </div>
      <section className="toolbox-result">
        <div className="toolbox-panel__head">结果</div>
        <pre>{diff ? diff.label : '日期无效'}</pre>
        <div className="mini-list__row">
          <span>日期加减</span>
          <strong>{shifted ? shifted : '无效'}</strong>
        </div>
      </section>
    </section>
  );
}

function PasswordTool() {
  const [length, setLength] = useState(18);
  const [readable, setReadable] = useState(true);
  const [result, setResult] = useState('');
  const [options, setOptions] = useState({
    upper: true,
    lower: true,
    numbers: true,
    symbols: true,
  });

  function run() {
    setResult(generatePassword({ length, readable, ...options }));
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard?.writeText(result);
  }

  return (
    <section className="toolbox-body toolbox-body--single">
      <div className="toolbox-panel">
        <div className="toolbox-panel__head">密码生成</div>
        <label className="toolbox-range">
          <span>长度 {length}</span>
          <input
            type="range"
            min="8"
            max="48"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </label>
        <div className="toolbox-check-grid">
          {(['upper', 'lower', 'numbers', 'symbols'] as const).map((key) => (
            <label key={key} className="toolbox-check">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(e) => setOptions((value) => ({ ...value, [key]: e.target.checked }))}
              />
              {optionLabel(key)}
            </label>
          ))}
          <label className="toolbox-check">
            <input
              type="checkbox"
              checked={readable}
              onChange={(e) => setReadable(e.target.checked)}
            />
            易读
          </label>
        </div>
        <div className="toolbox-actions">
          <button type="button" onClick={run}>
            生成
          </button>
          <button type="button" onClick={() => void copy()}>
            复制
          </button>
        </div>
      </div>
      <section className="toolbox-result">
        <div className="toolbox-panel__head">结果</div>
        <pre>{result || '等待生成'}</pre>
      </section>
    </section>
  );
}

function ImageTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [info, setInfo] = useState('等待图片');
  const [targetWidth, setTargetWidth] = useState('');
  const [format, setFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(0.82);
  const [outputUrl, setOutputUrl] = useState('');

  function loadFile(file: File) {
    const url = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.onload = async () => {
      setImage(nextImage);
      setTargetWidth(String(nextImage.naturalWidth));
      try {
        const metadata = await readImageMetadata(file);
        setInfo(`${metadata.width} × ${metadata.height} · ${formatBytes(metadata.size)}`);
      } catch {
        setInfo(
          `${nextImage.naturalWidth} × ${nextImage.naturalHeight} · ${formatBytes(file.size)}`,
        );
      }
      URL.revokeObjectURL(url);
    };
    nextImage.src = url;
  }

  function exportImage() {
    if (!image) return;
    const width = Math.max(1, Number(targetWidth) || image.naturalWidth);
    const result = exportImageToDataUrl(image, {
      width,
      mimeType: format as BrowserImageMimeType,
      quality,
    });
    setOutputUrl(result.url);
    setInfo(`${result.width} × ${result.height}`);
  }

  return (
    <section className="toolbox-body toolbox-body--single">
      <div className="toolbox-panel">
        <div className="toolbox-panel__head">图片工具</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
          }}
        />
        <button
          type="button"
          className="dock-app-window__button"
          onClick={() => fileInputRef.current?.click()}
        >
          选择图片
        </button>
        <div className="toolbox-inline">
          <input
            className="mini-input"
            value={targetWidth}
            onChange={(e) => setTargetWidth(e.target.value)}
            inputMode="numeric"
            placeholder="宽度"
          />
          <PlushSelect
            value={format}
            onChange={setFormat}
            ariaLabel="图片格式"
            options={[
              { value: 'image/jpeg', label: 'JPEG' },
              { value: 'image/png', label: 'PNG' },
              { value: 'image/webp', label: 'WebP' },
            ]}
          />
        </div>
        <label className="toolbox-range">
          <span>质量 {Math.round(quality * 100)}%</span>
          <input
            type="range"
            min="0.4"
            max="1"
            step="0.02"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </label>
        <button type="button" className="mini-app__secondary" onClick={exportImage}>
          导出
        </button>
      </div>
      <section className="toolbox-result">
        <div className="toolbox-panel__head">结果</div>
        <pre>{info}</pre>
        {outputUrl ? (
          <a className="toolbox-download" href={outputUrl} download="desktop-os-image">
            下载图片
          </a>
        ) : null}
      </section>
    </section>
  );
}

function SplitBillTool() {
  const people = useToolStore((s) => s.splitBillPeople);
  const setPeople = useToolStore((s) => s.setSplitBillPeople);
  const [total, setTotal] = useState('100');
  const [tip, setTip] = useState('0');
  const [tax, setTax] = useState('0');
  const result = useMemo(
    () => calculateSplitBill(Number(total), Number(tip), Number(tax), people),
    [people, tax, tip, total],
  );

  function updatePerson(id: string, patch: Partial<{ name: string; paid: number }>) {
    setPeople(people.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  function addPerson() {
    setPeople([...people, { id: `person-${Date.now()}`, name: `P${people.length + 1}`, paid: 0 }]);
  }

  return (
    <section className="toolbox-body toolbox-body--single">
      <div className="toolbox-panel">
        <div className="toolbox-panel__head">分账</div>
        <div className="toolbox-inline">
          <input
            className="mini-input"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            inputMode="decimal"
            placeholder="总金额"
          />
          <input
            className="mini-input"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            inputMode="decimal"
            placeholder="小费"
          />
          <input
            className="mini-input"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            inputMode="decimal"
            placeholder="税费"
          />
        </div>
        <div className="split-list">
          {people.map((person) => (
            <div key={person.id} className="split-row">
              <input
                className="mini-input"
                value={person.name}
                onChange={(e) => updatePerson(person.id, { name: e.target.value })}
              />
              <input
                className="mini-input"
                value={person.paid}
                onChange={(e) => updatePerson(person.id, { paid: Number(e.target.value) })}
                inputMode="decimal"
              />
            </div>
          ))}
        </div>
        <button type="button" className="mini-app__secondary" onClick={addPerson}>
          加一人
        </button>
      </div>
      <section className="toolbox-result">
        <div className="toolbox-panel__head">结果</div>
        <pre>
          {result
            ? `总计 ${formatMoney(result.total)}\n人均 ${formatMoney(result.perPerson)}`
            : '金额无效'}
        </pre>
        <div className="mini-list">
          {result?.rows.map((row) => (
            <div key={row.id} className="mini-list__row">
              <span>{row.name}</span>
              <strong>{row.label}</strong>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function optionLabel(key: 'upper' | 'lower' | 'numbers' | 'symbols') {
  if (key === 'upper') return '大写';
  if (key === 'lower') return '小写';
  if (key === 'numbers') return '数字';
  return '符号';
}
