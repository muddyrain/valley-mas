import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const execFileAsync = promisify(execFile);
const sourceMode = process.env.SCREEN_RECORDER_SMOKE_SOURCE === '1';
const scenario = process.env.SCREEN_RECORDER_SMOKE_SCENARIO ?? 'all';
const executable =
  process.env.SCREEN_RECORDER_SMOKE_EXECUTABLE ??
  (sourceMode
    ? path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(projectRoot, 'package-output', 'win-unpacked', 'Valley Screen Recorder.exe'));
const videosDirectory = path.join(
  process.env.USERPROFILE ?? '',
  'Videos',
  'Valley Screen Recordings',
);
const picturesDirectory = path.join(
  process.env.USERPROFILE ?? '',
  'Pictures',
  'Valley Screenshots',
);
const retiredSelectionTargetIds = new Set();

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method === 'Runtime.consoleAPICalled') {
        const values = message.params.args.map(
          (argument) => argument.value ?? argument.description,
        );
        console.error('[renderer]', ...values);
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending?.reject(new Error(message.error.message));
      else pending?.resolve(message.result);
    });
  }

  static async connect(webSocketDebuggerUrl) {
    const socket = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const client = new CdpClient(socket);
    await client.send('Runtime.enable');
    return client;
  }

  async send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const result = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 请求超时：${method}`));
      }, 20_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ?? 'Renderer evaluation failed',
      );
    }
    return response.result?.value;
  }

  close() {
    this.socket.close();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(description, read, predicate, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let value;
  let lastError;
  while (Date.now() < deadline) {
    try {
      value = await read();
      if (predicate(value)) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw new Error(
    `等待超时：${description}；最后结果 ${JSON.stringify(value)}；最后错误 ${String(lastError)}`,
  );
}

async function targets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(1_000),
  });
  return response.json();
}

async function targetIdsForMode(port, mode) {
  const currentTargets = await waitFor(`${mode} renderer 列表`, () => targets(port), Array.isArray);
  const matchingTargets = currentTargets.filter(
    (item) =>
      item.type === 'page' &&
      item.url.includes(`mode=${mode}`) &&
      !retiredSelectionTargetIds.has(item.id),
  );
  if (mode !== 'selection') {
    return new Set(matchingTargets.map((item) => item.id));
  }

  const activeTargetIds = await Promise.all(
    matchingTargets.map(async (target) => {
      try {
        const client = await CdpClient.connect(target.webSocketDebuggerUrl);
        try {
          const isActive = await client.evaluate(`Boolean(
            document.visibilityState === 'visible' &&
            document.querySelector('.selection-overlay, .color-picker-overlay, .screenshot-editor-overlay')
          )`);
          return isActive ? target.id : undefined;
        } finally {
          client.close();
        }
      } catch {
        return undefined;
      }
    }),
  );
  return new Set(activeTargetIds.filter(Boolean));
}

async function connectTarget(port, mode, excludedTargetIds = new Set()) {
  const target = await waitFor(
    `${mode} renderer`,
    async () => {
      const candidates = (await targets(port)).filter(
        (item) =>
          item.type === 'page' &&
          item.url.includes(`mode=${mode}`) &&
          !excludedTargetIds.has(item.id),
      );
      if (mode !== 'selection') return candidates[0];
      for (const candidate of candidates) {
        const client = await CdpClient.connect(candidate.webSocketDebuggerUrl);
        try {
          const isActive = await client.evaluate(`Boolean(
            document.visibilityState === 'visible' &&
            document.querySelector('.selection-overlay, .color-picker-overlay, .screenshot-editor-overlay')
          )`);
          if (isActive) return candidate;
        } finally {
          client.close();
        }
      }
      return undefined;
    },
    Boolean,
  );
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  client.targetId = target.id;
  return client;
}

async function connectTargetFast(port, mode, excludedTargetIds = new Set()) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const target = (await targets(port)).find(
      (item) =>
        item.type === 'page' &&
        item.url.includes(`mode=${mode}`) &&
        !excludedTargetIds.has(item.id),
    );
    if (target) {
      const client = await CdpClient.connect(target.webSocketDebuggerUrl);
      client.targetId = target.id;
      return client;
    }
    await delay(10);
  }
  throw new Error(`等待超时：${mode} 快速激活`);
}

async function waitForPreparedSelectionSurface(port) {
  await waitFor(
    '后台预热选择层',
    async () => {
      const target = (await targets(port)).find(
        (item) =>
          item.type === 'page' &&
          item.url.includes('mode=selection') &&
          !retiredSelectionTargetIds.has(item.id),
      );
      if (!target) return false;
      const client = await CdpClient.connect(target.webSocketDebuggerUrl);
      try {
        return await client.evaluate("typeof window.screenRecorder?.selectionReady === 'function'");
      } finally {
        client.close();
      }
    },
    Boolean,
    5_000,
  );
}

async function readWindowsClipboard() {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'],
    { windowsHide: true, encoding: 'utf8', timeout: 5_000 },
  );
  return stdout.trim();
}

async function connectTargetByTitle(port, title) {
  const target = await waitFor(
    `${title} renderer`,
    async () => (await targets(port)).find((item) => item.type === 'page' && item.title === title),
    Boolean,
  );
  return CdpClient.connect(target.webSocketDebuggerUrl);
}

async function listVideoFiles() {
  try {
    return (await readdir(videosDirectory))
      .filter((name) => name.endsWith('.webm') || name.endsWith('.mp4'))
      .sort();
  } catch {
    return [];
  }
}

async function listPngFiles() {
  try {
    return (await readdir(picturesDirectory)).filter((name) => name.endsWith('.png')).sort();
  } catch {
    return [];
  }
}

async function readPngSize(filePath) {
  const png = await readFile(filePath);
  if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`截图不是有效 PNG：${filePath}`);
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function waitForNewOutput(previousFiles) {
  const previous = new Set(previousFiles);
  return waitFor(
    '新的视频输出文件',
    async () => {
      const names = await listVideoFiles();
      const name = names.find((candidate) => !previous.has(candidate));
      if (!name) return undefined;
      const filePath = path.join(videosDirectory, name);
      const details = await stat(filePath);
      return details.size > 0 ? { path: filePath, bytes: details.size } : undefined;
    },
    Boolean,
  );
}

async function waitForNewScreenshot(previousFiles) {
  const previous = new Set(previousFiles);
  return waitFor(
    '新的 PNG 截图文件',
    async () => {
      const names = await listPngFiles();
      const name = names.find((candidate) => !previous.has(candidate));
      if (!name) return undefined;
      const filePath = path.join(picturesDirectory, name);
      const details = await stat(filePath);
      return details.size > 0
        ? { path: filePath, bytes: details.size, size: await readPngSize(filePath) }
        : undefined;
    },
    Boolean,
  );
}

async function launch(port, extraEnvironment = {}) {
  console.error(`[runtime] launch ${port}`);
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'valley-screen-recorder-smoke-'));
  const child = spawn(
    executable,
    [
      ...(sourceMode ? [projectRoot] : []),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDirectory}`,
    ],
    {
      cwd: path.dirname(executable),
      env: { ...process.env, ...extraEnvironment },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  child.on('exit', (code, signal) => {
    console.error(`[runtime] app exit code=${String(code)} signal=${String(signal)}`);
  });
  try {
    await delay(2_000);
    const main = await connectTarget(port, 'main');
    await waitFor(
      'preload API',
      () =>
        main.evaluate(
          "typeof window.screenRecorder?.startScreenshot === 'function' && document.querySelectorAll('button').length >= 3",
        ),
      (ready) => ready === true,
    );
    await delay(500);
    console.error(`[runtime] connected ${port}`);
    return { child, main, profileDirectory };
  } catch (error) {
    child.kill();
    await delay(500);
    await rm(profileDirectory, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    });
    throw error;
  }
}

async function launchSecondInstance(app) {
  const child = spawn(
    executable,
    [...(sourceMode ? [projectRoot] : []), `--user-data-dir=${app.profileDirectory}`],
    {
      cwd: path.dirname(executable),
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  const exitResult = await Promise.race([
    new Promise((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    }),
    delay(10_000).then(() => undefined),
  ]);
  if (!exitResult) {
    child.kill();
    throw new Error('第二个应用实例没有在 10 秒内退出');
  }
  const activated = await waitFor(
    '第二次启动激活已有控制台',
    () => snapshot(app.main),
    (value) => value?.settingsVisible === true,
  );
  return { ...exitResult, settingsVisible: activated.settingsVisible };
}

async function stopApp(app) {
  app.main.close();
  app.child.kill();
  await delay(1200);
  await rm(app.profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 200,
  });
}

async function snapshot(client) {
  return client.evaluate('window.screenRecorder.getSnapshot()');
}

async function waitForState(client, state, timeout) {
  return waitFor(
    `状态 ${state}`,
    () => snapshot(client),
    (value) => value?.state === state,
    timeout,
  );
}

async function waitForScreenshotState(client, state, timeout) {
  return waitFor(
    `截图状态 ${state}`,
    () => snapshot(client),
    (value) => value?.screenshot?.state === state,
    timeout,
  );
}

async function assertSelectionLayerIsTransparent(client) {
  const appearance = await waitFor(
    '选择层挂载',
    () =>
      client.evaluate(`({
        hasOverlay: Boolean(document.querySelector('.selection-overlay')),
        modes: [...document.querySelectorAll('.capture-mode-toolbar button')].map((item) => item.textContent?.trim()),
        activeMode: document.querySelector('.capture-mode-toolbar [aria-selected="true"]')?.textContent?.trim(),
        rootBackground: getComputedStyle(document.documentElement).backgroundColor,
        overlayBackground: getComputedStyle(document.querySelector('.selection-overlay')).backgroundColor,
        maskCount: document.querySelectorAll('.selection-mask').length,
        maskBackground: getComputedStyle(document.querySelector('.selection-mask')).backgroundColor,
        opacity: getComputedStyle(document.querySelector('.selection-overlay')).opacity,
        transitionDuration: getComputedStyle(document.querySelector('.selection-overlay')).transitionDuration,
        frozenFrameReady: (() => {
          const image = document.querySelector('.screenshot-frozen-frame');
          return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
        })(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        screen: { width: window.screen.width, height: window.screen.height },
      })`),
    (value) => value?.hasOverlay && value.opacity === '1',
  );
  if (appearance.rootBackground !== 'rgba(0, 0, 0, 0)') {
    throw new Error(`选区层没有透出桌面：${JSON.stringify(appearance)}`);
  }
  if (
    appearance.viewport.width !== appearance.screen.width ||
    appearance.viewport.height !== appearance.screen.height
  ) {
    throw new Error(`选区层没有覆盖完整显示器：${JSON.stringify(appearance)}`);
  }
  if (appearance.activeMode === '截图' && !appearance.frozenFrameReady) {
    throw new Error(`截图选区没有显示固定画面：${JSON.stringify(appearance)}`);
  }
  return appearance;
}

async function rightClickSelection(client, x = 300, y = 300) {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'right',
    clickCount: 1,
  });
  const sizeAfterPress = await client.evaluate(
    "document.querySelector('.selection-size')?.textContent?.replace(/\\s+/g, ' ').trim()",
  );
  if (sizeAfterPress === '0 × 0' || sizeAfterPress === '0*0') {
    throw new Error('右键取消前短暂生成了 0 × 0 选区');
  }
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'right',
    clickCount: 1,
  });
  return { sizeAfterPress };
}

async function rightClick(client, x = 300, y = 300, closesTarget = false) {
  if (closesTarget) {
    await client.evaluate(`document.elementFromPoint(${x}, ${y})?.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: ${x},
      clientY: ${y},
      button: 2,
    })); true`);
    return;
  }
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'right',
    clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'right',
    clickCount: 1,
  });
}

async function leftClick(client, rect) {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
}

async function selectWithMask(client, rect, initialSnapshot) {
  const initial = initialSnapshot ?? (await assertSelectionLayerIsTransparent(client));
  if (initial.maskCount < 1 || initial.maskBackground === 'rgba(0, 0, 0, 0)') {
    throw new Error(`选区前缺少有效遮罩：${JSON.stringify(initial)}`);
  }
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: rect.x,
    y: rect.y,
    button: 'left',
    clickCount: 1,
  });
  const chromeAfterPointerDown = await client.evaluate(`(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    return {
      toolbarVisible: isVisible('.capture-mode-toolbar'),
      helpVisible: isVisible('.selection-help'),
    };
  })()`);
  if (chromeAfterPointerDown.toolbarVisible || chromeAfterPointerDown.helpVisible) {
    throw new Error(`鼠标按下后顶部捕获控件仍然可见：${JSON.stringify(chromeAfterPointerDown)}`);
  }
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: rect.x + rect.width,
    y: rect.y + rect.height,
    button: 'left',
    buttons: 1,
  });
  const selected = await waitFor(
    '选区内透明、选区外遮罩',
    () =>
      client.evaluate(`(() => {
        const overlay = document.querySelector('.selection-overlay');
        const box = document.querySelector('.selection-box');
        return {
          hasSelection: overlay?.classList.contains('selection-overlay-has-selection'),
          overlayBackground: overlay ? getComputedStyle(overlay).backgroundColor : undefined,
          boxShadow: box ? getComputedStyle(box).boxShadow : undefined,
          maskCount: document.querySelectorAll('.selection-mask').length,
          frame: box?.getBoundingClientRect().toJSON(),
        };
      })()`),
    (value) =>
      value?.hasSelection &&
      value.overlayBackground === 'rgba(0, 0, 0, 0)' &&
      value.maskCount === 4 &&
      !value.boxShadow?.includes('9999px'),
  );
  await client.evaluate(`(() => {
    if (window.__valleyScreenshotHandoffProbe) {
      window.__valleyScreenshotHandoffProbe.releaseAt = performance.now();
    }
    return true;
  })()`);
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: rect.x + rect.width,
    y: rect.y + rect.height,
    button: 'left',
    clickCount: 1,
  });
  return { initial, selected, chromeAfterPointerDown };
}

async function inspectScreenshotEditor(port) {
  const editor = await connectTarget(port, 'selection');
  const approximately = (actual, expected) => Math.abs(actual - expected) < 1;
  const view = await waitFor(
    '截图标注工具挂载',
    () =>
      editor.evaluate(`({
        hasCanvas: Boolean(document.querySelector('.screenshot-canvas-wrap canvas')),
        tools: [...document.querySelectorAll('.screenshot-toolbar button')].map((item) => item.getAttribute('aria-label')),
        canvas: document.querySelector('.screenshot-canvas-wrap canvas')?.getBoundingClientRect().toJSON(),
        animationName: getComputedStyle(document.querySelector('.screenshot-editor-overlay')).animationName,
        visibility: getComputedStyle(document.querySelector('.screenshot-editor-overlay')).visibility,
        oldSelectionRemoved: !document.querySelector('.selection-overlay'),
        activeTool: document.querySelector('.screenshot-toolbar .screenshot-tool-active')?.getAttribute('aria-label'),
      })`),
    (value) =>
      value?.hasCanvas &&
      value.canvas?.width > 0 &&
      value.animationName === 'none' &&
      value.visibility === 'visible' &&
      value.oldSelectionRemoved &&
      value.activeTool === '移动选区',
  );
  const readyAt = Date.now();
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: view.canvas.x + view.canvas.width / 2,
    y: view.canvas.y + view.canvas.height / 2,
    button: 'left',
    clickCount: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.canvas.x + view.canvas.width / 2 + 24,
    y: view.canvas.y + view.canvas.height / 2 + 16,
    button: 'left',
    buttons: 1,
  });
  const liveSelection = await waitFor(
    '截图选区拖动实时跟随',
    () =>
      editor.evaluate(`(() => {
        const frame = document.querySelector('.screenshot-canvas-wrap');
        const canvas = frame?.querySelector('canvas');
        const rect = frame?.getBoundingClientRect();
        return rect && canvas ? {
          x: rect.x,
          y: rect.y,
          moving: frame.classList.contains('screenshot-selection-moving'),
          canvasOpacity: getComputedStyle(canvas).opacity,
          frozenFrameReady: (() => {
            const image = document.querySelector('.screenshot-frozen-frame');
            return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
          })(),
        } : undefined;
      })()`),
    (value) =>
      approximately(value?.x, view.canvas.x + 24) &&
      approximately(value?.y, view.canvas.y + 16) &&
      value?.moving === true &&
      value?.canvasOpacity === '0' &&
      value?.frozenFrameReady === true,
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: view.canvas.x + view.canvas.width / 2 + 24,
    y: view.canvas.y + view.canvas.height / 2 + 16,
    button: 'left',
    clickCount: 1,
  });
  const movedSelection = await waitFor(
    '截图选区移动提交完成',
    () =>
      editor.evaluate(`(() => {
        const frame = document.querySelector('.screenshot-canvas-wrap');
        const canvas = frame?.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        return rect && canvas ? {
          rect: rect.toJSON(),
          moving: frame.classList.contains('screenshot-selection-moving'),
          canvasOpacity: getComputedStyle(canvas).opacity,
        } : undefined;
      })()`),
    (value) =>
      approximately(value?.rect?.x, view.canvas.x + 24) &&
      approximately(value?.rect?.y, view.canvas.y + 16) &&
      value?.moving === false &&
      value?.canvasOpacity === '0',
  );
  view.canvas = movedSelection.rect;
  view.liveSelection = liveSelection;
  const resizeHandle = await editor.evaluate(`(() => {
    const rect = document.querySelector('[data-screenshot-selection-handle="se"]')?.getBoundingClientRect();
    if (!rect) return undefined;
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    return {
      x,
      y,
      hitHandle: document.elementFromPoint(x, y)?.closest('[data-screenshot-selection-handle]')?.getAttribute('data-screenshot-selection-handle'),
    };
  })()`);
  if (!resizeHandle) throw new Error('截图选区缺少东南缩放点');
  if (resizeHandle.hitHandle !== 'se') {
    throw new Error(`截图选区东南缩放点被其他图层遮挡：${JSON.stringify(resizeHandle)}`);
  }
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: resizeHandle.x,
    y: resizeHandle.y,
    button: 'left',
    clickCount: 1,
  });
  await waitFor(
    '截图选区缩放手势开始',
    () =>
      editor.evaluate(`(() => {
        const frame = document.querySelector('.screenshot-canvas-wrap');
        const canvas = frame?.querySelector('canvas');
        return frame && canvas ? {
          moving: frame.classList.contains('screenshot-selection-moving'),
          canvasOpacity: getComputedStyle(canvas).opacity,
        } : undefined;
      })()`),
    (value) => value?.moving === true && value?.canvasOpacity === '0',
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: resizeHandle.x + 36,
    y: resizeHandle.y + 24,
    button: 'left',
    buttons: 1,
  });
  const liveResize = await waitFor(
    '截图选区缩放期间保持原色',
    () =>
      editor.evaluate(`(() => {
        const frame = document.querySelector('.screenshot-canvas-wrap');
        const canvas = frame?.querySelector('canvas');
        const rect = frame?.getBoundingClientRect();
        return rect && canvas ? {
          width: rect.width,
          height: rect.height,
          moving: frame.classList.contains('screenshot-selection-moving'),
          canvasOpacity: getComputedStyle(canvas).opacity,
          frozenFrameReady: (() => {
            const image = document.querySelector('.screenshot-frozen-frame');
            return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
          })(),
        } : undefined;
      })()`),
    (value) =>
      approximately(value?.width, view.canvas.width + 36) &&
      approximately(value?.height, view.canvas.height + 24) &&
      value?.moving === true &&
      value?.canvasOpacity === '0' &&
      value?.frozenFrameReady === true,
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: resizeHandle.x + 36,
    y: resizeHandle.y + 24,
    button: 'left',
    clickCount: 1,
  });
  const resizedSelection = await waitFor(
    '截图选区缩放提交',
    () =>
      editor.evaluate(
        "document.querySelector('.screenshot-canvas-wrap canvas')?.getBoundingClientRect().toJSON()",
      ),
    (value) =>
      approximately(value?.width, view.canvas.width + 36) &&
      approximately(value?.height, view.canvas.height + 24),
  );
  view.canvas = resizedSelection;
  view.liveResize = liveResize;
  const centerY = view.canvas.y + Math.min(80, view.canvas.height / 2);
  const tools = ['方框', '圆框', '箭头', '画笔', '马赛克', '文字', '吸色'];
  if (!tools.every((tool) => view.tools.includes(tool))) {
    throw new Error(`截图工具不完整：${JSON.stringify(view.tools)}`);
  }
  await editor.evaluate(
    `document.querySelector('.screenshot-toolbar button[aria-label="移动选区"]')?.focus(); true`,
  );
  const tooltip = await waitFor(
    '截图工具 Tooltip',
    () =>
      editor.evaluate(`({
        text: document.querySelector('.ui-tooltip-root:focus-within [role="tooltip"]')?.textContent?.trim(),
        opacity: getComputedStyle(document.querySelector('.ui-tooltip-root:focus-within [role="tooltip"]')).opacity,
      })`),
    (value) => value?.text === '移动选区' && Number(value.opacity) >= 0.4,
  );
  await editor.evaluate(
    'document.querySelector(\'.screenshot-toolbar button[aria-label="吸色"]\')?.click()',
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.canvas.x + view.canvas.width / 2,
    y: centerY,
  });
  const colorPicker = await waitFor(
    '截图内吸色',
    () =>
      editor.evaluate(`({
        primary: document.querySelector('.screenshot-color-picker-card strong')?.textContent?.trim(),
        secondary: document.querySelector('.screenshot-color-picker-card small')?.textContent?.trim(),
      })`),
    (value) => /^#[0-9A-F]{6}$/.test(value?.primary ?? '') && value?.secondary?.startsWith('rgb('),
  );
  await editor.evaluate(
    'document.querySelector(\'.screenshot-toolbar button[aria-label="方框"]\')?.click()',
  );
  const waitForActiveTool = (label) =>
    waitFor(
      `激活截图工具 ${label}`,
      () =>
        editor.evaluate(
          `document.querySelector('.screenshot-toolbar button[aria-label=${JSON.stringify(label)}]')?.classList.contains('screenshot-tool-active')`,
        ),
      (active) => active === true,
    );
  await waitForActiveTool('方框');
  const stylePopover = await waitFor(
    '标注样式弹层',
    () =>
      editor.evaluate(`({
        label: document.querySelector('.annotation-style-popover')?.getAttribute('aria-label'),
        colors: document.querySelectorAll('.annotation-style-popover [aria-label^="颜色"]').length,
        widths: document.querySelectorAll('.annotation-style-popover [aria-label^="粗细"]').length,
      })`),
    (value) => value?.label === '方框样式' && value.colors === 4 && value.widths === 3,
  );
  await editor.evaluate(
    'document.querySelector(\'.annotation-style-popover button[aria-label="粗细 8"]\')?.click()',
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: view.canvas.x + 30,
    y: centerY - 30,
    button: 'left',
    clickCount: 1,
  });
  await editor.evaluate(
    'document.querySelector(\'.screenshot-toolbar button[aria-label="圆框"]\')?.click()',
  );
  await waitForActiveTool('圆框');
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: view.canvas.x + 55,
    y: centerY - 15,
    button: 'left',
    clickCount: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.canvas.x + Math.min(155, view.canvas.width - 20),
    y: centerY + 45,
    button: 'left',
    buttons: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: view.canvas.x + Math.min(155, view.canvas.width - 20),
    y: centerY + 45,
    button: 'left',
    clickCount: 1,
  });
  await editor.evaluate(
    'document.querySelector(\'.screenshot-toolbar button[aria-label="马赛克"]\')?.click()',
  );
  await waitForActiveTool('马赛克');
  const mosaicSizeOptions = await waitFor(
    '马赛克大小选项',
    () =>
      editor.evaluate(
        `([...document.querySelectorAll('.annotation-style-popover [aria-label^="大小"]')].map((item) => item.getAttribute('aria-label')))`,
      ),
    (value) => value?.length === 3,
  );
  await editor.evaluate(
    'document.querySelector(\'.annotation-style-popover button[aria-label="大小 大"]\')?.click()',
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: view.canvas.x + 180,
    y: centerY - 20,
    button: 'left',
    clickCount: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.canvas.x + Math.min(260, view.canvas.width - 15),
    y: centerY + 25,
    button: 'left',
    buttons: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: view.canvas.x + Math.min(260, view.canvas.width - 15),
    y: centerY + 25,
    button: 'left',
    clickCount: 1,
  });
  await editor.evaluate(
    'document.querySelector(\'.screenshot-toolbar button[aria-label="文字"]\')?.click()',
  );
  await waitForActiveTool('文字');
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: view.canvas.x + 90,
    y: centerY,
    button: 'left',
    clickCount: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: view.canvas.x + 90,
    y: centerY,
    button: 'left',
    clickCount: 1,
  });
  await waitFor(
    '文字输入框',
    () => editor.evaluate("Boolean(document.querySelector('.screenshot-text-input'))"),
    Boolean,
  );
  await editor.send('Input.insertText', { text: 'Valley' });
  await editor.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await waitFor(
    '文字提交完成',
    () => editor.evaluate("Boolean(document.querySelector('.screenshot-text-input'))"),
    (visible) => visible === false,
  );
  const beforeTextMove = await editor.evaluate(
    "document.querySelector('.screenshot-canvas-wrap canvas')?.toDataURL()",
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: view.canvas.x + 95,
    y: centerY + 8,
    button: 'left',
    clickCount: 1,
  });
  await waitFor(
    '文字拖动状态',
    () =>
      editor.evaluate(
        "document.querySelector('.screenshot-canvas-wrap')?.classList.contains('screenshot-canvas-text-moving')",
      ),
    (moving) => moving === true,
  );
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.canvas.x + 155,
    y: centerY + 38,
    button: 'left',
    buttons: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: view.canvas.x + 155,
    y: centerY + 38,
    button: 'left',
    clickCount: 1,
  });
  const textMoved = await waitFor(
    '文字移动后重绘',
    () => editor.evaluate("document.querySelector('.screenshot-canvas-wrap canvas')?.toDataURL()"),
    (value) => Boolean(value && value !== beforeTextMove),
  );
  const beforeTextResize = textMoved;
  await editor.evaluate(
    'document.querySelector(\'.annotation-style-popover button[aria-label="字号 大"]\')?.click()',
  );
  const textResized = await waitFor(
    '文字放大后重绘',
    () => editor.evaluate("document.querySelector('.screenshot-canvas-wrap canvas')?.toDataURL()"),
    (value) => Boolean(value && value !== beforeTextResize),
  );
  await editor.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.canvas.x + Math.min(180, view.canvas.width - 20),
    y: centerY + 30,
    button: 'left',
    buttons: 1,
  });
  await editor.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: view.canvas.x + Math.min(180, view.canvas.width - 20),
    y: centerY + 30,
    button: 'left',
    clickCount: 1,
  });
  await waitFor(
    '标注进入撤销历史',
    () =>
      editor.evaluate(
        'document.querySelector(\'.screenshot-toolbar button[aria-label="撤销"]\')?.disabled',
      ),
    (disabled) => disabled === false,
  );
  await editor.evaluate(
    'document.querySelector(\'.screenshot-toolbar button[aria-label="保存并复制截图"]\')?.click()',
  );
  editor.close();
  return {
    ...view,
    readyAt,
    annotationCommitted: true,
    defaultTool: view.activeTool,
    movedSelection,
    mosaicSizeOptions,
    tooltip,
    colorPicker,
    stylePopover,
    textCommitted: true,
    textMoved: Boolean(textMoved),
    textResized: Boolean(textResized),
  };
}

async function startScreenshotHandoffProbe(client) {
  await client.evaluate(`(() => {
    const result = {
      frames: [],
      done: false,
      releaseAt: undefined,
      lastSelection: undefined,
      firstEditor: undefined,
    };
    let selectionFrozenFrameSrc;
    window.__valleyScreenshotHandoffProbe = result;
    const sample = () => {
      const selectionOverlay = document.querySelector('.selection-overlay');
      const selectionBox = document.querySelector('.selection-box');
      const selectionVisible = Boolean(selectionOverlay);
      const editor = document.querySelector('.screenshot-editor-overlay');
      const editorVisible = Boolean(
        editor &&
          getComputedStyle(editor).visibility !== 'hidden' &&
          getComputedStyle(editor).opacity !== '0'
      );
      if (selectionVisible && selectionBox) {
        const rect = selectionBox.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          result.lastSelection = {
            rect: rect.toJSON(),
            borderColor: getComputedStyle(selectionBox).outlineColor,
          };
          selectionFrozenFrameSrc = document.querySelector('.screenshot-frozen-frame')?.getAttribute('src');
        }
      }
      result.frames.push({ editorVisible, selectionVisible, timestamp: performance.now() });
      if (editorVisible) {
        const frame = document.querySelector('.screenshot-canvas-wrap');
        const canvas = frame?.querySelector('canvas');
        const rect = frame?.getBoundingClientRect();
        result.firstEditor = rect && canvas ? {
          rect: rect.toJSON(),
          borderColor: getComputedStyle(frame).outlineColor,
          canvasOpacity: getComputedStyle(canvas).opacity,
          sameFrozenFrame:
            selectionFrozenFrameSrc ===
            document.querySelector('.screenshot-frozen-frame')?.getAttribute('src'),
        } : undefined;
        result.done = true;
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return true;
  })()`);
}

async function readScreenshotHandoffProbe(client) {
  const result = await waitFor(
    '截图选区到编辑器连续交接',
    () => client.evaluate('window.__valleyScreenshotHandoffProbe'),
    (value) => value?.done === true,
  );
  const blankFrames = result.frames.filter(
    (frame) => !frame.selectionVisible && !frame.editorVisible,
  );
  if (blankFrames.length > 0) {
    throw new Error(`截图编辑器出现前露出了桌面：${JSON.stringify({ blankFrames, result })}`);
  }
  const sameRect = (before, after) =>
    before &&
    after &&
    Math.abs(before.x - after.x) < 1 &&
    Math.abs(before.y - after.y) < 1 &&
    Math.abs(before.width - after.width) < 1 &&
    Math.abs(before.height - after.height) < 1;
  if (!sameRect(result.lastSelection?.rect, result.firstEditor?.rect)) {
    throw new Error(`截图松手后替换了选区几何：${JSON.stringify(result)}`);
  }
  if (result.lastSelection?.borderColor !== result.firstEditor?.borderColor) {
    throw new Error(`截图松手前后边框颜色不一致：${JSON.stringify(result)}`);
  }
  if (result.firstEditor?.canvasOpacity !== '0' || result.firstEditor?.sameFrozenFrame !== true) {
    throw new Error(`截图松手后替换了固定画面层：${JSON.stringify(result)}`);
  }
  const editorChrome = await client.evaluate(`({
    handles: document.querySelectorAll('[data-screenshot-selection-handle]').length,
    toolbarVisible: Boolean(document.querySelector('.screenshot-toolbar')),
    activeTool: document.querySelector('.screenshot-toolbar .screenshot-tool-active')?.getAttribute('aria-label'),
  })`);
  if (
    editorChrome.handles !== 8 ||
    !editorChrome.toolbarVisible ||
    editorChrome.activeTool !== '移动选区'
  ) {
    throw new Error(`截图松手后的工具或缩放点不完整：${JSON.stringify(editorChrome)}`);
  }
  const editorFrame = result.frames.find((frame) => frame.editorVisible);
  return {
    blankFrames: blankFrames.length,
    sampledFrames: result.frames.length,
    ...editorChrome,
    readyMilliseconds:
      editorFrame && typeof result.releaseAt === 'number'
        ? Math.round(editorFrame.timestamp - result.releaseAt)
        : undefined,
  };
}

async function inspectConfiguredSelection(port, initialRect) {
  const selection = await connectTarget(port, 'selection');
  try {
    const initial = await waitFor(
      '可调整录屏选区挂载',
      () =>
        selection.evaluate(`(() => {
          const overlay = document.querySelector('.selection-overlay');
          const box = document.querySelector('.selection-box');
          return {
            configuring: overlay?.classList.contains('selection-overlay-configuring'),
            frame: box?.getBoundingClientRect().toJSON(),
            handles: document.querySelectorAll('[data-selection-handle]').length,
            help: document.querySelector('.selection-help')?.textContent?.trim(),
            boxShadow: box ? getComputedStyle(box).boxShadow : undefined,
            maskCount: document.querySelectorAll('.selection-mask').length,
            handleCenters: Object.fromEntries([...document.querySelectorAll('[data-selection-handle]')].map((item) => {
              const rect = item.getBoundingClientRect();
              return [item.dataset.selectionHandle, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }];
            })),
          };
        })()`),
      (value) =>
        value?.configuring &&
        value.handles === 8 &&
        value.frame?.width === initialRect.width &&
        value.frame?.height === initialRect.height &&
        value.maskCount === 4 &&
        !value.boxShadow?.includes('9999px'),
    );
    const tolerance = 0.6;
    const expectedCenters = {
      e: { x: initial.frame.right, y: initial.frame.y + initial.frame.height / 2 },
      s: { x: initial.frame.x + initial.frame.width / 2, y: initial.frame.bottom },
    };
    for (const [name, expected] of Object.entries(expectedCenters)) {
      const actual = initial.handleCenters[name];
      if (
        !actual ||
        Math.abs(actual.x - expected.x) > tolerance ||
        Math.abs(actual.y - expected.y) > tolerance
      ) {
        throw new Error(`选区控制点 ${name} 未居中：${JSON.stringify({ actual, expected })}`);
      }
    }
    const handle = await selection.evaluate(`(() => {
      const rect = document.querySelector('.selection-handle-se')?.getBoundingClientRect();
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : undefined;
    })()`);
    if (!handle) throw new Error('未找到选区东南缩放控制点');
    const target = {
      x: initial.frame.right + 80,
      y: initial.frame.bottom + 60,
    };
    await selection.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: handle.x,
      y: handle.y,
      button: 'left',
      clickCount: 1,
    });
    await selection.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: target.x,
      y: target.y,
      button: 'left',
      buttons: 1,
    });
    await selection.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: target.x,
      y: target.y,
      button: 'left',
      clickCount: 1,
    });
    const adjusted = await waitFor(
      '录屏选区缩放结果同步',
      () =>
        selection.evaluate(`(() => {
          const rect = document.querySelector('.selection-box')?.getBoundingClientRect();
          return rect?.toJSON();
        })()`),
      (value) =>
        value?.width === initialRect.width + 80 && value?.height === initialRect.height + 60,
    );
    return { initial, adjusted };
  } finally {
    selection.close();
  }
}

async function inspectRecordingSetup(port, initialRect, preferMp4 = false, enabledOptions = []) {
  const setup = await connectTarget(port, 'recording-setup');
  const view = await waitFor(
    '录屏设置面板挂载',
    () =>
      setup.evaluate(`({
        visible: Boolean(document.querySelector('.recording-setup-card')),
        startText: document.querySelector('.recording-setup-start')?.textContent?.trim(),
        format: document.querySelector('.recording-format-row')?.textContent?.replace(/\\s+/g, ' ').trim(),
        formats: [...document.querySelectorAll('.recording-format-options button')].map((item) => ({
          text: item.textContent?.trim(),
          disabled: item.disabled,
          selected: item.getAttribute('aria-checked') === 'true',
        })),
        options: [...document.querySelectorAll('.recording-option-grid strong')].map((item) => item.textContent?.trim()),
        optionDetails: [...document.querySelectorAll('.recording-option-grid button')].map((item) => ({
          label: item.querySelector('strong')?.textContent?.trim(),
          status: item.querySelector('small')?.textContent?.trim(),
          disabled: item.disabled,
          enabled: item.getAttribute('aria-pressed') === 'true',
        })),
        volume: (() => {
          const input = document.querySelector('.recording-volume-row input');
          return input ? { value: input.value, disabled: input.disabled } : undefined;
        })(),
        lucideIcons: document.querySelectorAll('.recording-option-grid svg.lucide').length,
        closeRect: document.querySelector('.recording-setup-cancel')?.getBoundingClientRect().toJSON(),
      })`),
    (value) =>
      value?.visible &&
      value.startText === '开始录制' &&
      value.formats?.length === 2 &&
      value.lucideIcons === 4 &&
      value.volume?.value === '100' &&
      value.optionDetails?.find((item) => item.label === '系统声音')?.enabled === true &&
      value.optionDetails
        ?.filter((item) => item.label === '摄像头' || item.label === '麦克风')
        .every((item) => item.status !== '检测中'),
  );
  const deviceKinds = await setup.evaluate(
    'navigator.mediaDevices.enumerateDevices().then((devices) => devices.map((device) => device.kind))',
  );
  const cameraOption = view.optionDetails.find((item) => item.label === '摄像头');
  if (
    !deviceKinds.includes('videoinput') &&
    (!cameraOption?.disabled || cameraOption.status !== '未检测到设备')
  ) {
    throw new Error(`无摄像头时未提前禁用选项：${JSON.stringify({ deviceKinds, cameraOption })}`);
  }
  await setup.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: view.closeRect.x + view.closeRect.width / 2,
    y: view.closeRect.y + view.closeRect.height / 2,
  });
  const closeHover = await waitFor(
    '录屏设置关闭按钮 hover',
    () =>
      setup.evaluate(
        "getComputedStyle(document.querySelector('.recording-setup-cancel')).backgroundColor",
      ),
    (color) => color === 'rgb(233, 54, 76)',
  );
  const configuredSelection = initialRect
    ? await inspectConfiguredSelection(port, initialRect)
    : undefined;
  const mp4 = view.formats.find((item) => item.text === 'MP4');
  if (preferMp4 && !mp4?.disabled) {
    await setup.evaluate(
      "[...document.querySelectorAll('.recording-format-options button')].find((item) => item.textContent?.trim() === 'MP4')?.click()",
    );
  }
  for (const label of enabledOptions) {
    await setup.evaluate(`(() => {
      const button = [...document.querySelectorAll('.recording-option-grid button')]
        .find((item) => item.querySelector('strong')?.textContent?.trim() === ${JSON.stringify(label)});
      if (!button || button.disabled) throw new Error('录制选项不可用：${label}');
      if (button.getAttribute('aria-pressed') !== 'true') button.click();
      return true;
    })()`);
  }
  const optionStates = await setup.evaluate(`Object.fromEntries(
    [...document.querySelectorAll('.recording-option-grid button')].map((item) => [
      item.querySelector('strong')?.textContent?.trim(),
      { enabled: item.getAttribute('aria-pressed') === 'true', disabled: item.disabled },
    ]),
  )`);
  const selectedFormat = await setup.evaluate(
    'document.querySelector(\'.recording-format-options button[aria-checked="true"]\')?.textContent?.trim()',
  );
  await setup.evaluate(
    "setTimeout(() => document.querySelector('.recording-setup-start')?.click(), 0); true",
  );
  setup.close();
  return {
    ...view,
    closeHover,
    configuredSelection,
    selectedFormat,
    optionStates,
    deviceKinds,
    cameraPreflight: cameraOption,
  };
}

async function inspectCompletion(port) {
  const completion = await connectTarget(port, 'completion');
  try {
    const view = await waitFor(
      '录屏完成反馈挂载',
      () =>
        completion.evaluate(`({
          visible: Boolean(document.querySelector('.recording-completion-card')),
          title: document.querySelector('.recording-completion-card header strong')?.textContent?.trim(),
          path: document.querySelector('.recording-completion-card code')?.textContent?.trim(),
          actions: [...document.querySelectorAll('.recording-completion-card footer button')].map((item) => item.textContent?.trim()),
        })`),
      (value) =>
        value?.visible &&
        value.title === '录屏已保存' &&
        value.path &&
        value.actions?.includes('播放视频') &&
        value.actions?.includes('打开所在文件夹'),
    );
    await completion.evaluate(
      "setTimeout(() => document.querySelector('.recording-completion-close')?.click(), 0); true",
    );
    return view;
  } finally {
    completion.close();
  }
}

async function inspectLongScreenshotIndicator(port, expectedRect) {
  const indicator = await connectTarget(port, 'long-screenshot-indicator');
  try {
    return await waitFor(
      '长截图选区遮罩挂载',
      () =>
        indicator.evaluate(`({
          visible: Boolean(document.querySelector('.long-screenshot-indicator')),
          frame: document.querySelector('.long-screenshot-selection-frame')?.getBoundingClientRect().toJSON(),
          frameShadow: getComputedStyle(document.querySelector('.long-screenshot-selection-frame')).boxShadow,
          text: document.querySelector('.long-screenshot-selection-frame span')?.textContent?.trim(),
          rootBackground: getComputedStyle(document.documentElement).backgroundColor,
        })`),
      (value) =>
        value?.visible &&
        value.frame?.x === expectedRect.x &&
        value.frame?.y === expectedRect.y &&
        value.frame?.width === expectedRect.width &&
        value.frame?.height === expectedRect.height &&
        value.frameShadow?.includes('9999px') &&
        value.text?.includes('长截图区域') &&
        value.rootBackground === 'rgba(0, 0, 0, 0)',
    );
  } finally {
    indicator.close();
  }
}

async function inspectRecordingIndicator(port, expectedMode, expectedPhase) {
  const indicator = await connectTarget(port, 'indicator');
  try {
    return await waitFor(
      '录制状态提示挂载',
      () =>
        indicator.evaluate(`({
          visible: Boolean(document.querySelector('.recording-indicator')),
          mode: document.querySelector('.recording-indicator')?.getAttribute('data-recording-mode'),
          phase: document.querySelector('.recording-indicator')?.getAttribute('data-recording-phase'),
          frame: document.querySelector('.recording-indicator-frame')?.getBoundingClientRect().toJSON(),
          frameShadow: getComputedStyle(document.querySelector('.recording-indicator-frame')).boxShadow,
          text: document.body.innerText,
          rootBackground: getComputedStyle(document.documentElement).backgroundColor,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          screen: { width: window.screen.width, height: window.screen.height },
        })`),
      (value) =>
        value?.visible &&
        value.mode === expectedMode &&
        (!expectedPhase || value.phase === expectedPhase) &&
        (expectedPhase !== 'configuring' || value.frameShadow?.includes('9999px')) &&
        value.rootBackground === 'rgba(0, 0, 0, 0)' &&
        (expectedMode !== 'screen' ||
          (value.viewport.width === value.screen.width &&
            value.viewport.height === value.screen.height &&
            value.frame.x === 2 &&
            value.frame.y === 2 &&
            value.frame.right === value.viewport.width - 2 &&
            value.frame.bottom === value.viewport.height - 2)),
    );
  } finally {
    indicator.close();
  }
}

async function inspectRecordingControl(port) {
  const control = await connectTarget(port, 'control');
  try {
    return await waitFor(
      '悬浮录制控制条挂载',
      () =>
        control.evaluate(`({
          visible: Boolean(document.querySelector('.recording-control')),
          buttonText: document.querySelector('.recording-control button')?.textContent,
          rootBackground: getComputedStyle(document.documentElement).backgroundColor,
        })`),
      (value) => value?.visible && value.rootBackground === 'rgba(0, 0, 0, 0)',
    );
  } finally {
    control.close();
  }
}

async function inspectPinnedScreenshot(app, port) {
  const existingPinnedScreenshotTargets = await targetIdsForMode(port, 'selection');
  await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
  const pinSelection = await connectTarget(port, 'selection', existingPinnedScreenshotTargets);
  await assertSelectionLayerIsTransparent(pinSelection);
  await pinSelection.evaluate(
    'void window.screenRecorder.confirmSelection({ x: 140, y: 120, width: 260, height: 180 }); true',
  );
  await waitFor(
    '固定截图按钮',
    () =>
      pinSelection.evaluate(
        `Boolean(document.querySelector('.screenshot-toolbar button[aria-label="固定截图"]'))`,
      ),
    Boolean,
  );
  await pinSelection.evaluate(
    `setTimeout(() => document.querySelector('.screenshot-toolbar button[aria-label="固定截图"]')?.click(), 0); true`,
  );
  await waitForScreenshotState(app.main, 'idle', 10_000);
  const pinnedScreenshot = await connectTarget(port, 'pinned-screenshot');
  const pinnedView = await waitFor(
    '固定截图窗口',
    () =>
      pinnedScreenshot.evaluate(`({
        imageReady: (() => {
          const image = document.querySelector('.pinned-screenshot img');
          return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
        })(),
        closeButton: Boolean(document.querySelector('button[aria-label="关闭固定图片"]')),
        draggable: getComputedStyle(document.querySelector('.pinned-screenshot-surface')).webkitAppRegion,
        border: getComputedStyle(document.querySelector('.pinned-screenshot-surface')).borderTopWidth,
        shadow: getComputedStyle(document.querySelector('.pinned-screenshot-surface')).boxShadow,
        padding: getComputedStyle(document.querySelector('.pinned-screenshot')).paddingTop,
        rootBackground: getComputedStyle(document.documentElement).backgroundColor,
      })`),
    (value) =>
      value?.imageReady &&
      value.closeButton &&
      value.draggable === 'drag' &&
      value.border === '1px' &&
      value.shadow !== 'none' &&
      value.padding === '12px' &&
      value.rootBackground === 'rgba(0, 0, 0, 0)',
  );
  await pinnedScreenshot.evaluate(`(() => {
    document.querySelector('.pinned-screenshot-surface')?.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 64,
      clientY: 64,
    }));
    return true;
  })()`);
  const customMenu = await waitFor(
    '固定截图自定义菜单',
    () =>
      pinnedScreenshot.evaluate(
        `document.querySelector('.pinned-screenshot-menu [role="menuitem"]')?.textContent?.trim()`,
      ),
    (value) => value === '关闭固定图片',
  );
  const pinnedTargetId = pinnedScreenshot.targetId;
  await pinnedScreenshot.evaluate(
    `setTimeout(() => document.querySelector('.pinned-screenshot-menu [role="menuitem"]')?.click(), 0); true`,
  );
  pinnedScreenshot.close();
  await waitFor(
    '固定截图关闭',
    async () => (await targets(port)).some((target) => target.id === pinnedTargetId),
    (exists) => exists === false,
  );
  pinSelection.close();
  return { ...pinnedView, customMenu, closed: true };
}

async function inspectCurrentFixes(app, port, { includePinnedScreenshot = true } = {}) {
  console.error('[runtime] fixes window snap start');
  const existingSelectionTargets = await targetIdsForMode(port, 'selection');
  await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
  const selection = await connectTarget(port, 'selection', existingSelectionTargets);
  await assertSelectionLayerIsTransparent(selection);
  const startedAt = Date.now();
  const responseTimes = [];
  const windowTargets = await waitFor(
    '预热后的 Windows 窗口候选',
    async () => {
      const responseStartedAt = Date.now();
      const targets = await selection.evaluate('window.screenRecorder.getWindowTargets()');
      const responseMilliseconds = Date.now() - responseStartedAt;
      responseTimes.push(responseMilliseconds);
      if (responseMilliseconds > 350) {
        throw new Error(`Windows 窗口识别阻塞选择层：${responseMilliseconds}ms`);
      }
      return targets;
    },
    (targets) => Array.isArray(targets) && targets.length > 0,
    15_000,
  );
  console.error('[runtime] fixes window targets received');
  const windowTargetsMilliseconds = Date.now() - startedAt;
  const snapTarget = windowTargets[0];
  await selection.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: snapTarget.rect.x + snapTarget.rect.width / 2,
    y: snapTarget.rect.y + snapTarget.rect.height / 2,
  });
  const windowSnap = await waitFor(
    '鼠标悬停自动吸附窗口',
    () =>
      selection.evaluate(`(() => {
        const frame = document.querySelector('.selection-box')?.getBoundingClientRect();
        return frame ? { x: frame.x, y: frame.y, width: frame.width, height: frame.height } : undefined;
      })()`),
    (value) =>
      value?.x === snapTarget.rect.x &&
      value?.y === snapTarget.rect.y &&
      value?.width === snapTarget.rect.width &&
      value?.height === snapTarget.rect.height,
  );
  console.error('[runtime] fixes window snap complete');
  await startScreenshotHandoffProbe(selection);
  const selectionAppearance = await selectWithMask(selection, {
    x: 100,
    y: 100,
    width: 320,
    height: 240,
  });
  const handoff = await readScreenshotHandoffProbe(selection);
  selection.close();
  const editor = await inspectScreenshotEditor(port);
  console.error('[runtime] fixes live selection complete');
  await waitForScreenshotState(app.main, 'completed', 10_000);
  const interactionResult = {
    windowTargetsMilliseconds,
    windowTargetResponseMilliseconds: responseTimes,
    windowSnap,
    selectionAppearance,
    handoff,
    editor,
  };
  if (!includePinnedScreenshot) return interactionResult;
  const pinnedScreenshot = await inspectPinnedScreenshot(app, port);
  console.error('[runtime] fixes pinned screenshot complete');
  return {
    ...interactionResult,
    pinnedScreenshot,
  };
}

async function inspectScreenshotHandoff(app, port) {
  const existingSelectionTargets = await targetIdsForMode(port, 'selection');
  await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
  const selection = await connectTarget(port, 'selection', existingSelectionTargets);
  const selectionTargetId = selection.targetId;
  const initial = await assertSelectionLayerIsTransparent(selection);
  await startScreenshotHandoffProbe(selection);
  const selectionAppearance = await selectWithMask(
    selection,
    { x: 100, y: 100, width: 320, height: 240 },
    initial,
  );
  const handoff = await readScreenshotHandoffProbe(selection);
  const readyMilliseconds = handoff.readyMilliseconds;
  const currentTargets = await targets(port);
  const reusedSelectionSurface = currentTargets.some((item) => item.id === selectionTargetId);
  const problems = [];
  if (!reusedSelectionSurface) {
    problems.push('截图编辑器没有复用已经显示的选区窗口');
  }
  if (typeof readyMilliseconds !== 'number' || readyMilliseconds > 150) {
    problems.push(`选区确认到编辑状态耗时 ${readyMilliseconds}ms`);
  }
  if (problems.length > 0) {
    selection.close();
    throw new Error(`截图交接不符合预期：${problems.join('；')}`);
  }
  const plan = await selection.evaluate('window.screenRecorder.getScreenshotEditPlan()');
  if (!plan?.operationId) throw new Error('截图编辑任务缺少 operationId');
  await selection.evaluate(
    `setTimeout(() => window.screenRecorder.cancelScreenshotEdit(${JSON.stringify(plan.operationId)}), 0); true`,
  );
  selection.close();
  await waitForScreenshotState(app.main, 'idle', 10_000);
  return {
    ...handoff,
    selectionAppearance,
    readyMilliseconds,
    reusedSelectionSurface,
  };
}

async function measureShortcutSurfaceActivation(app, port, purpose) {
  console.error(`[runtime] ${purpose} activation prepare`);
  await waitForPreparedSelectionSurface(port);
  const existingTargets = await targetIdsForMode(port, 'selection');
  const preparedSurface = await connectTarget(port, 'selection', retiredSelectionTargetIds);
  const startedAt = performance.now();
  console.error(`[runtime] ${purpose} activation trigger`);
  await app.main.evaluate(
    purpose === 'screenshot'
      ? "window.screenRecorder.startScreenshot('region')"
      : "window.screenRecorder.start('region')",
  );
  console.error(`[runtime] ${purpose} activation triggered`);
  const surface = preparedSurface ?? (await connectTargetFast(port, 'selection', existingTargets));
  console.error(`[runtime] ${purpose} activation target ready`);
  await waitFor(
    `${purpose} 选择层首帧`,
    () =>
      surface.evaluate(`(() => {
        const overlay = document.querySelector('.selection-overlay');
        return Boolean(overlay && getComputedStyle(overlay).opacity === '1');
      })()`),
    Boolean,
    5_000,
  );
  const milliseconds = Math.round(performance.now() - startedAt);
  const frameTiming = await surface.evaluate(`new Promise((resolve) => {
    const timestamps = [];
    const startedAt = performance.now();
    const sample = (timestamp) => {
      timestamps.push(timestamp);
      if (timestamp - startedAt < 180) {
        requestAnimationFrame(sample);
        return;
      }
      const intervals = timestamps.slice(1).map((value, index) => value - timestamps[index]);
      resolve({
        frames: timestamps.length,
        maxFrameInterval: Math.max(0, ...intervals),
      });
    };
    requestAnimationFrame(sample);
  })`);
  console.error(`[runtime] ${purpose} activation ${milliseconds}ms`);
  await surface.evaluate('void window.screenRecorder.cancelSelection(); true');
  retiredSelectionTargetIds.add(surface.targetId);
  surface.close();
  if (milliseconds > 120) {
    throw new Error(`${purpose} 快捷捕获激活过慢：${milliseconds}ms`);
  }
  if (purpose === 'screenshot' && frameTiming.maxFrameInterval > 50) {
    throw new Error(`截图遮罩首帧卡顿：${JSON.stringify(frameTiming)}`);
  }
  return { frameTiming, milliseconds };
}

async function inspectShiftColorPicker(app, port) {
  await waitForPreparedSelectionSurface(port);
  const existingTargets = await targetIdsForMode(port, 'selection');
  const preparedSurface = await connectTarget(port, 'selection', retiredSelectionTargetIds);
  await app.main.evaluate('window.screenRecorder.startColorPicker()');
  const surface = preparedSurface ?? (await connectTargetFast(port, 'selection', existingTargets));
  await waitFor(
    '吸色画面首帧',
    () => surface.evaluate("document.querySelector('.color-picker-canvas')?.width"),
    (width) => width > 0,
  );
  await surface.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 320, y: 240 });
  const readout = () =>
    surface.evaluate(`({
      primary: document.querySelector('.color-picker-card strong')?.textContent?.trim(),
      secondary: document.querySelector('.color-picker-card > div:nth-child(2) span')?.textContent?.trim(),
    })`);
  const hex = await waitFor('吸色默认 HEX', readout, (value) =>
    /^#[0-9A-F]{6}$/.test(value?.primary ?? ''),
  );
  await surface.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Shift',
    code: 'ShiftLeft',
    modifiers: 8,
    windowsVirtualKeyCode: 16,
  });
  const rgb = await waitFor(
    '按住 Shift 切换 RGB',
    readout,
    (value) => value?.primary?.startsWith('rgb(') && /^#[0-9A-F]{6}$/.test(value?.secondary ?? ''),
  );
  await surface.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Shift',
    code: 'ShiftLeft',
    windowsVirtualKeyCode: 16,
  });
  const returnedHex = await waitFor(
    '松开 Shift 返回 HEX',
    readout,
    (value) => value?.primary === hex.primary,
  );
  await surface.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Shift',
    code: 'ShiftLeft',
    modifiers: 8,
    windowsVirtualKeyCode: 16,
  });
  await surface.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 320,
    y: 240,
    button: 'left',
    buttons: 1,
    clickCount: 1,
    modifiers: 8,
  });
  retiredSelectionTargetIds.add(surface.targetId);
  surface.close();
  const clipboard = await waitFor(
    '吸色结果写入系统剪贴板',
    readWindowsClipboard,
    (value) => value === rgb.primary,
    5_000,
  );
  if (clipboard !== rgb.primary) {
    throw new Error(`吸色结果未按 RGB 写入剪贴板：${JSON.stringify({ clipboard, rgb })}`);
  }
  return { hex, rgb, returnedHex, clipboard };
}

async function inspectSettingsSurface(app) {
  console.error('[runtime] settings surface activate');
  await launchSecondInstance(app);
  console.error('[runtime] settings surface inspect layout');
  const beforeScroll = await app.main.evaluate(`(() => {
    const shell = document.querySelector('.settings-shell');
    const titlebar = document.querySelector('.settings-titlebar');
    const close = document.querySelector('.settings-close');
    const content = document.querySelector('.settings-content');
    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.scrollingElement?.scrollHeight,
      shell: shell?.getBoundingClientRect().toJSON(),
      titlebar: titlebar?.getBoundingClientRect().toJSON(),
      close: close?.getBoundingClientRect().toJSON(),
      contentClientHeight: content?.clientHeight,
      contentScrollHeight: content?.scrollHeight,
      contentScrollbarWidth: content ? getComputedStyle(content).scrollbarWidth : undefined,
    };
  })()`);
  await app.main.evaluate(`(() => {
    document.scrollingElement?.scrollTo(0, document.scrollingElement.scrollHeight);
    const content = document.querySelector('.settings-content');
    if (content) content.scrollTop = content.scrollHeight;
  })()`);
  const afterScroll = await app.main.evaluate(`({
    documentScrollTop: document.scrollingElement?.scrollTop,
    titlebar: document.querySelector('.settings-titlebar')?.getBoundingClientRect().toJSON(),
    close: document.querySelector('.settings-close')?.getBoundingClientRect().toJSON(),
  })`);
  if (
    beforeScroll.documentHeight !== beforeScroll.viewportHeight ||
    beforeScroll.shell?.height !== beforeScroll.viewportHeight ||
    beforeScroll.contentScrollbarWidth !== 'none' ||
    afterScroll.documentScrollTop !== 0 ||
    afterScroll.titlebar?.top !== 0 ||
    !afterScroll.close ||
    afterScroll.close.top < 0 ||
    afterScroll.close.bottom > beforeScroll.viewportHeight
  ) {
    throw new Error(`设置窗口滚动布局不符合预期：${JSON.stringify({ beforeScroll, afterScroll })}`);
  }

  console.error('[runtime] settings surface complete');
  return { beforeScroll, afterScroll };
}

async function runCoreScenarios() {
  const app = await launch(9333, {
    VALLEY_SCREEN_RECORDER_TEST_AUTO_STOP_MS: '5000',
    ...(scenario === 'long-only'
      ? { VALLEY_SCREEN_RECORDER_TEST_LONG_SCREENSHOT_FIXTURE: '1' }
      : {}),
  });
  const results = {};
  try {
    if (scenario === 'region-only') {
      console.error('[runtime] region-only start');
      const before = await listVideoFiles();
      await app.main.evaluate("window.screenRecorder.start('region')");
      const selection = await connectTarget(9333, 'selection');
      const selectionAppearance = await assertSelectionLayerIsTransparent(selection);
      await selection.evaluate(
        'void window.screenRecorder.confirmSelection({ x: 100, y: 100, width: 320, height: 240 }); true',
      );
      selection.close();
      const setup = await inspectRecordingSetup(
        9333,
        { x: 100, y: 100, width: 320, height: 240 },
        true,
      );
      const indicator = await inspectRecordingIndicator(9333, 'region');
      const control = await inspectRecordingControl(9333);
      const output = await waitForNewOutput(before);
      const expectedExtension = setup.selectedFormat === 'MP4' ? '.mp4' : '.webm';
      if (!output.path.endsWith(expectedExtension)) {
        throw new Error(`录屏格式与输出扩展名不匹配：${JSON.stringify({ setup, output })}`);
      }
      const completion = await inspectCompletion(9333);
      return {
        region: {
          selection: { x: 100, y: 100, width: 320, height: 240 },
          selectionAppearance,
          setup,
          indicator,
          control,
          completion,
          state: 'completed',
          ...output,
        },
      };
    }

    if (scenario === 'long-only') {
      console.error('[runtime] long screenshot start');
      const before = await listPngFiles();
      const fixture = await connectTargetByTitle(9333, 'Valley Long Screenshot Fixture');
      const fixtureGeometry = await fixture.evaluate(`({
          x: window.screenX,
          y: window.screenY,
          width: window.innerWidth,
          height: window.innerHeight,
        })`);
      await fixture.evaluate(`(() => {
          window.__valleyLongScreenshotAutoScroll = setTimeout(() => {
            let remaining = 5;
            const timer = setInterval(() => {
              window.scrollBy({ top: 120, behavior: 'instant' });
              remaining -= 1;
              if (remaining === 0) clearInterval(timer);
            }, 900);
          }, 6_000);
        })()`);
      const existingSelectionTargets = await targetIdsForMode(9333, 'selection');
      await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
      const selection = await connectTarget(9333, 'selection', existingSelectionTargets);
      console.error('[runtime] long screenshot selection connected');
      const selectionOrigin = await selection.evaluate(
        `({ x: window.screenX, y: window.screenY })`,
      );
      const rect = {
        x: fixtureGeometry.x - selectionOrigin.x + 40,
        y: fixtureGeometry.y - selectionOrigin.y + 56,
        width: 400,
        height: 420,
      };
      await selection.evaluate(
        `void window.screenRecorder.confirmSelection(${JSON.stringify(rect)}); true`,
      );
      console.error('[runtime] long screenshot selection confirmed');
      await waitFor(
        '无窗口切换的截图编辑器',
        () =>
          selection.evaluate(`({
            editorVisible: getComputedStyle(document.querySelector('.screenshot-editor-overlay')).visibility,
            oldSelectionRemoved: !document.querySelector('.selection-overlay'),
            hasLongButton: Boolean(document.querySelector('.screenshot-toolbar button[aria-label="长截图"]')),
          })`),
        (value) =>
          value?.editorVisible === 'visible' && value.oldSelectionRemoved && value.hasLongButton,
      );
      console.error('[runtime] long screenshot editor ready');
      await selection.evaluate(
        `document.querySelector('.screenshot-toolbar button[aria-label="长截图"]')?.click()`,
      );
      console.error('[runtime] long screenshot command sent');
      const control = await connectTarget(9333, 'long-screenshot-control');
      console.error('[runtime] long screenshot control connected');
      const initialCapture = await waitFor(
        '长截图控制条',
        () => snapshot(control),
        (value) => value?.screenshot?.state === 'long-capturing' && value.screenshot.longCapture,
      );
      const initialPreview = await waitFor(
        '长截图实时预览首帧',
        () =>
          control.evaluate(`({
            visible: Boolean(document.querySelector('.long-screenshot-preview')),
            images: document.querySelectorAll('.long-screenshot-preview-scroll img').length,
            viewport: document.querySelector('.long-screenshot-preview-scroll')?.getBoundingClientRect().toJSON(),
            actions: [...document.querySelectorAll('.long-screenshot-actions button')]
              .map((item) => item.getAttribute('aria-label')),
          })`),
        (value) =>
          value?.visible &&
          value.images === 1 &&
          value.viewport?.height > 100 &&
          value.actions?.join(',') === '取消长截图,完成并复制长截图',
      );
      console.error('[runtime] long screenshot initial preview ready');
      await control.evaluate(`(() => {
        window.__valleyLongScreenshotHiddenTransitions = 0;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            window.__valleyLongScreenshotHiddenTransitions += 1;
          }
        });
      })()`);
      const longIndicator = await inspectLongScreenshotIndicator(
        9333,
        initialCapture.screenshot.longCapture.selectionFrame,
      );
      console.error('[runtime] long screenshot indicator ready');
      await control.evaluate(`(() => {
        window.__valleyLongScreenshotFinishTimer = setTimeout(() => {
            const scroll = document.querySelector('.long-screenshot-preview-scroll');
          localStorage.setItem('valley-long-screenshot-smoke', JSON.stringify({
              images: scroll?.querySelectorAll('img').length,
              scrollHeight: scroll?.scrollHeight,
              clientHeight: scroll?.clientHeight,
              scrollTop: scroll?.scrollTop,
            visibility: document.visibilityState,
            hiddenTransitions: window.__valleyLongScreenshotHiddenTransitions,
          }));
          document.querySelector('button[aria-label="完成并复制长截图"]')?.click();
        }, 13_000);
      })()`);
      await delay(15_000);
      await waitForScreenshotState(app.main, 'completed', 25_000);
      const completed = await waitFor(
        '长截图复制到剪贴板',
        () => snapshot(app.main),
        (value) =>
          value?.screenshot?.state === 'completed' &&
          value.screenshot.copiedToClipboard === true &&
          !value.screenshot.outputPath &&
          !value.completion,
      );
      const afterComplete = await listPngFiles();
      const createdFiles = afterComplete.filter((file) => !before.includes(file));
      if (createdFiles.length > 0) {
        throw new Error(`长截图完成不应自动写入文件：${JSON.stringify(createdFiles)}`);
      }
      control.close();
      selection.close();

      console.error('[runtime] long screenshot cancel start');
      const beforeCancel = await listPngFiles();
      const existingCancelSelectionTargets = await targetIdsForMode(9333, 'selection');
      await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
      const cancelSelection = await connectTarget(
        9333,
        'selection',
        existingCancelSelectionTargets,
      );
      await cancelSelection.evaluate(
        `void window.screenRecorder.confirmSelection(${JSON.stringify(rect)}); true`,
      );
      await waitFor(
        '长截图取消入口',
        () =>
          cancelSelection.evaluate(
            `Boolean(document.querySelector('.screenshot-toolbar button[aria-label="长截图"]'))`,
          ),
        Boolean,
      );
      await cancelSelection.evaluate(
        `document.querySelector('.screenshot-toolbar button[aria-label="长截图"]')?.click()`,
      );
      const cancelControl = await connectTarget(9333, 'long-screenshot-control');
      const stitchedPreview = await cancelControl.evaluate(
        `JSON.parse(localStorage.getItem('valley-long-screenshot-smoke') ?? 'null')`,
      );
      if (
        stitchedPreview?.images < 3 ||
        stitchedPreview.scrollHeight <= stitchedPreview.clientHeight ||
        stitchedPreview.scrollTop + stitchedPreview.clientHeight <
          stitchedPreview.scrollHeight - 2 ||
        stitchedPreview.visibility !== 'visible' ||
        stitchedPreview.hiddenTransitions !== 0
      ) {
        throw new Error(`长截图实时预览或稳定性不符合预期：${JSON.stringify(stitchedPreview)}`);
      }
      await cancelControl.evaluate(
        `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`,
      );
      await waitForScreenshotState(app.main, 'idle', 10_000);
      const afterCancel = await listPngFiles();
      cancelControl.close();
      cancelSelection.close();
      fixture?.close();
      console.error('[runtime] long screenshot complete');
      return {
        longScreenshot: {
          selection: rect,
          frames: stitchedPreview.images,
          indicator: longIndicator,
          preview: { initial: initialPreview, stitched: stitchedPreview },
          captureUiStability: {
            visibility: stitchedPreview.visibility,
            hiddenTransitions: stitchedPreview.hiddenTransitions,
          },
          copiedToClipboard: completed.screenshot.copiedToClipboard,
          createdFiles,
          cancelledBy: 'Escape',
          cancelCreatedFiles: afterCancel.filter((file) => !beforeCancel.includes(file)),
        },
      };
    }

    const toolbar = await app.main.evaluate(`({
      visibility: document.visibilityState,
      hasSettings: Boolean(document.querySelector('.settings-shell')),
      title: document.querySelector('.settings-brand strong')?.textContent?.trim(),
      nativeMenuRemoved: window.innerHeight >= 560,
      hasStartupSetting: Boolean(document.querySelector('.settings-switch')),
      hasStorageSetting: Boolean(document.querySelector('.settings-storage-row button')),
      logo: (() => {
        const image = document.querySelector('.settings-brand img');
        return image ? { complete: image.complete, width: image.naturalWidth, height: image.naturalHeight } : undefined;
      })(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    })`);
    const launchSnapshot = await snapshot(app.main);
    toolbar.settingsVisible = launchSnapshot.settingsVisible;
    if (
      toolbar.settingsVisible ||
      !toolbar.hasSettings ||
      toolbar.title !== 'Valley Capture' ||
      !toolbar.nativeMenuRemoved ||
      !toolbar.hasStartupSetting ||
      !toolbar.hasStorageSetting ||
      !toolbar.logo?.complete ||
      toolbar.logo.width < 1
    ) {
      throw new Error(`托盘启动状态不符合预期：${JSON.stringify(toolbar)}`);
    }
    results.toolbar = toolbar;

    if (scenario === 'activation-only' || scenario === 'activation-surfaces-only') {
      results.activation = {
        screenshotMilliseconds: await measureShortcutSurfaceActivation(app, 9333, 'screenshot'),
      };
      await waitForPreparedSelectionSurface(9333);
      results.activation.recordingMilliseconds = await measureShortcutSurfaceActivation(
        app,
        9333,
        'recording',
      );
      if (scenario === 'activation-only') {
        results.activation.colorPicker = await inspectShiftColorPicker(app, 9333);
      }
      return results;
    }

    if (scenario === 'settings-surface-only') {
      results.settingsSurface = await inspectSettingsSurface(app);
      return results;
    }

    if (scenario === 'screenshot-handoff-only') {
      results.screenshotHandoff = await inspectScreenshotHandoff(app, 9333);
      return results;
    }

    if (scenario === 'fixes-only') {
      results.fixes = await inspectCurrentFixes(app, 9333);
      return results;
    }

    if (scenario === 'selection-interactions-only') {
      results.selectionInteractions = await inspectCurrentFixes(app, 9333, {
        includePinnedScreenshot: false,
      });
      return results;
    }

    console.error('[runtime] single-instance activation start');
    results.singleInstance = await launchSecondInstance(app);
    const beforeSettingsSnapshot = await snapshot(app.main);
    const notificationDefault = beforeSettingsSnapshot.notificationsEnabled;
    if (notificationDefault !== false) throw new Error('系统通知必须默认关闭');
    await app.main.evaluate(`document.querySelectorAll('[role="switch"]')[1]?.click(); true`);
    const notificationEnabled = await waitFor(
      '开启系统通知',
      () => snapshot(app.main),
      (value) => value?.notificationsEnabled === true,
    );
    await waitFor(
      '通知开关界面更新',
      () =>
        app.main.evaluate(
          `document.querySelectorAll('[role="switch"]')[1]?.getAttribute('aria-checked')`,
        ),
      (value) => value === 'true',
    );
    await app.main.evaluate(`document.querySelectorAll('[role="switch"]')[1]?.click(); true`);
    const notificationDisabled = await waitFor(
      '关闭系统通知',
      () => snapshot(app.main),
      (value) => value?.notificationsEnabled === false,
    );
    const shortcutInputRect = await app.main.evaluate(
      `document.querySelectorAll('.shortcut-input')[0]?.getBoundingClientRect().toJSON()`,
    );
    await leftClick(app.main, shortcutInputRect);
    const shortcutCaptureStarted = await waitFor(
      '快捷键录入状态开启',
      () => snapshot(app.main),
      (value) => value?.shortcutCaptureActive === true && value?.settingsVisible === true,
    );
    await app.main.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: '1',
      code: 'Digit1',
      modifiers: 11,
      windowsVirtualKeyCode: 49,
    });
    await app.main.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: '1',
      code: 'Digit1',
      modifiers: 11,
      windowsVirtualKeyCode: 49,
    });
    const shortcutCaptureEnded = await waitFor(
      '快捷键录入完成不隐藏设置',
      () => snapshot(app.main),
      (value) => value?.shortcutCaptureActive === false && value?.settingsVisible === true,
    );
    await leftClick(app.main, shortcutInputRect);
    await waitFor(
      '快捷键录入再次开启',
      () => snapshot(app.main),
      (value) => value?.shortcutCaptureActive === true,
    );
    await leftClick(app.main, shortcutInputRect);
    const shortcutCaptureCancelled = await waitFor(
      '再次点击取消快捷键录入',
      () => snapshot(app.main),
      (value) => value?.shortcutCaptureActive === false && value?.settingsVisible === true,
    );
    results.settings = {
      notificationDefault,
      notificationToggle: [
        notificationEnabled.notificationsEnabled,
        notificationDisabled.notificationsEnabled,
      ],
      captureStarted: shortcutCaptureStarted.shortcutCaptureActive,
      captureEnded: shortcutCaptureEnded.shortcutCaptureActive,
      captureCancelled: shortcutCaptureCancelled.shortcutCaptureActive,
      settingsVisible: shortcutCaptureCancelled.settingsVisible,
    };
    if (shortcutCaptureCancelled.warning?.includes('快捷键')) {
      throw new Error(
        `快捷键录入后没有恢复：${shortcutCaptureCancelled.warning}；初始提示：${beforeSettingsSnapshot.warning ?? '无'}`,
      );
    }
    if (scenario === 'settings-only') return results;
    await app.main.evaluate('window.screenRecorder.hideSettings()');
    await waitFor(
      '单实例激活后重新隐藏控制台',
      () => snapshot(app.main),
      (value) => value?.settingsVisible === false,
    );
    console.error('[runtime] single-instance activation complete');

    console.error('[runtime] color picker start');
    await app.main.evaluate('window.screenRecorder.startColorPicker()');
    const colorPickerSurface = await connectTarget(9333, 'selection');
    const colorPickerCanvas = await waitFor(
      '全屏吸色画面',
      () =>
        colorPickerSurface.evaluate(`(() => {
          const canvas = document.querySelector('.color-picker-canvas');
          return canvas ? { width: canvas.width, height: canvas.height } : undefined;
        })()`),
      (value) => value?.width > 0 && value?.height > 0,
    );
    await colorPickerSurface.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 320,
      y: 240,
    });
    const colorPickerReadout = await waitFor(
      '全屏吸色 HEX/RGB',
      () =>
        colorPickerSurface.evaluate(`({
          primary: document.querySelector('.color-picker-card strong')?.textContent?.trim(),
          secondary: document.querySelector('.color-picker-card > div:nth-child(2) span')?.textContent?.trim(),
        })`),
      (value) =>
        /^#[0-9A-F]{6}$/.test(value?.primary ?? '') && value?.secondary?.startsWith('rgb('),
    );
    await rightClick(colorPickerSurface, 320, 240, true);
    await waitForScreenshotState(app.main, 'idle', 10_000);
    colorPickerSurface.close();
    results.colorPicker = { canvas: colorPickerCanvas, readout: colorPickerReadout };
    console.error('[runtime] color picker complete');

    console.error('[runtime] full screenshot start');
    const beforeFullScreenshot = await listPngFiles();
    await app.main.evaluate("window.screenRecorder.startScreenshot('screen')");
    await waitForScreenshotState(app.main, 'completed', 10_000);
    results.fullScreenshot = await waitForNewScreenshot(beforeFullScreenshot);
    console.error('[runtime] full screenshot complete');

    console.error('[runtime] region screenshot start');
    const beforeRegionScreenshot = await listPngFiles();
    const existingRegionScreenshotTargets = await targetIdsForMode(9333, 'selection');
    await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
    const screenshotSelection = await connectTarget(
      9333,
      'selection',
      existingRegionScreenshotTargets,
    );
    const initialSelectionAppearance = await assertSelectionLayerIsTransparent(screenshotSelection);
    const windowTargetsStartedAt = Date.now();
    const windowTargets = await screenshotSelection.evaluate(
      'window.screenRecorder.getWindowTargets()',
    );
    const windowTargetsMilliseconds = Date.now() - windowTargetsStartedAt;
    if (!Array.isArray(windowTargets) || windowTargets.length === 0) {
      throw new Error('Windows 可见窗口识别没有返回候选目标');
    }
    if (windowTargetsMilliseconds > 350) {
      throw new Error(`Windows 窗口识别响应过慢：${windowTargetsMilliseconds}ms`);
    }
    const snapTarget = windowTargets[0];
    await screenshotSelection.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: snapTarget.rect.x + snapTarget.rect.width / 2,
      y: snapTarget.rect.y + snapTarget.rect.height / 2,
    });
    const windowSnap = await waitFor(
      '鼠标悬停自动吸附窗口',
      () =>
        screenshotSelection.evaluate(`(() => {
          const frame = document.querySelector('.selection-box')?.getBoundingClientRect();
          return frame ? {
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            label: document.querySelector('.selection-size')?.textContent?.trim(),
          } : undefined;
        })()`),
      (value) =>
        value?.x === snapTarget.rect.x &&
        value?.y === snapTarget.rect.y &&
        value?.width === snapTarget.rect.width &&
        value?.height === snapTarget.rect.height &&
        value?.label?.includes(snapTarget.title),
    );
    const screenshotSelectionRect = { x: 100, y: 100, width: 320, height: 240 };
    const screenshotSelectionViewport = await screenshotSelection.evaluate(`({
      width: window.innerWidth,
      height: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
    })`);
    const screenshotReadyStartedAt = Date.now();
    const screenshotSelectionAppearance = await selectWithMask(
      screenshotSelection,
      screenshotSelectionRect,
      initialSelectionAppearance,
    );
    screenshotSelection.close();
    const screenshotEditor = await inspectScreenshotEditor(9333);
    screenshotEditor.readyMilliseconds = screenshotEditor.readyAt - screenshotReadyStartedAt;
    delete screenshotEditor.readyAt;
    await waitForScreenshotState(app.main, 'completed', 10_000);
    const screenshotCompletedSnapshot = await snapshot(app.main);
    if (!screenshotCompletedSnapshot.screenshot.copiedToClipboard) {
      throw new Error('截图保存后没有写入剪贴板');
    }
    const regionScreenshotOutput = await waitForNewScreenshot(beforeRegionScreenshot);
    const expectedRegionSize = {
      width:
        Math.ceil(
          (420 * results.fullScreenshot.size.width) / screenshotSelectionViewport.screenWidth,
        ) -
        Math.floor(
          (100 * results.fullScreenshot.size.width) / screenshotSelectionViewport.screenWidth,
        ),
      height:
        Math.ceil(
          (340 * results.fullScreenshot.size.height) / screenshotSelectionViewport.screenHeight,
        ) -
        Math.floor(
          (100 * results.fullScreenshot.size.height) / screenshotSelectionViewport.screenHeight,
        ),
    };
    if (
      regionScreenshotOutput.size.width !== expectedRegionSize.width ||
      regionScreenshotOutput.size.height !== expectedRegionSize.height
    ) {
      throw new Error(
        `区域截图尺寸错误：${JSON.stringify({ actual: regionScreenshotOutput.size, expected: expectedRegionSize })}`,
      );
    }
    results.regionScreenshot = {
      selection: { x: 100, y: 100, width: 320, height: 240 },
      selectionViewport: screenshotSelectionViewport,
      selectionAppearance: screenshotSelectionAppearance,
      windowTargets: windowTargets.slice(0, 5).map((target) => ({
        title: target.title,
        rect: target.rect,
      })),
      windowTargetsMilliseconds,
      windowSnap,
      editor: screenshotEditor,
      expectedSize: expectedRegionSize,
      copiedToClipboard: screenshotCompletedSnapshot.screenshot.copiedToClipboard,
      ...regionScreenshotOutput,
    };
    console.error('[runtime] region screenshot complete');
    if (scenario === 'screenshot-only') return results;

    console.error('[runtime] pinned screenshot start');
    results.pinnedScreenshot = await inspectPinnedScreenshot(app, 9333);
    console.error('[runtime] pinned screenshot complete');

    console.error('[runtime] screenshot cancel start');
    const beforeScreenshotCancel = await listPngFiles();
    const existingScreenshotCancelTargets = await targetIdsForMode(9333, 'selection');
    await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
    const screenshotCancelSelection = await connectTarget(
      9333,
      'selection',
      existingScreenshotCancelTargets,
    );
    await waitFor(
      '截图选择层挂载',
      () =>
        screenshotCancelSelection.evaluate("Boolean(document.querySelector('.selection-overlay'))"),
      Boolean,
    );
    await screenshotCancelSelection.evaluate(
      "document.querySelectorAll('.capture-mode-toolbar button')[1]?.click()",
    );
    await waitFor(
      '切换到录屏选择模式',
      () => snapshot(app.main),
      (value) => value?.selectionPurpose === 'recording' && value?.state === 'selecting',
    );
    await screenshotCancelSelection.evaluate(
      "document.querySelectorAll('.capture-mode-toolbar button')[0]?.click()",
    );
    await waitFor(
      '切回截图选择模式',
      () => snapshot(app.main),
      (value) =>
        value?.selectionPurpose === 'screenshot' && value?.screenshot?.state === 'selecting',
    );
    const screenshotRightClick = await rightClickSelection(screenshotCancelSelection);
    const screenshotCancelled = await waitForScreenshotState(app.main, 'idle', 10_000);
    screenshotCancelSelection.close();
    const afterScreenshotCancel = await listPngFiles();
    results.screenshotCancel = {
      state: screenshotCancelled.screenshot.state,
      modeSwitch: 'screenshot → recording → screenshot',
      cancelledBy: 'right-click',
      rightClick: screenshotRightClick,
      createdFiles: afterScreenshotCancel.filter((file) => !beforeScreenshotCancel.includes(file)),
    };
    console.error('[runtime] screenshot cancel complete');

    console.error('[runtime] screenshot editor cancel start');
    const beforeEditorCancel = await listPngFiles();
    const existingEditorCancelTargets = await targetIdsForMode(9333, 'selection');
    await app.main.evaluate("window.screenRecorder.startScreenshot('region')");
    const editorCancelSelection = await connectTarget(
      9333,
      'selection',
      existingEditorCancelTargets,
    );
    await assertSelectionLayerIsTransparent(editorCancelSelection);
    await editorCancelSelection.evaluate(
      'void window.screenRecorder.confirmSelection({ x: 80, y: 80, width: 240, height: 180 }); true',
    );
    const editorCancel = editorCancelSelection;
    await waitFor(
      '截图编辑取消按钮',
      () =>
        editorCancel.evaluate(`({
          cancelButton: Boolean(document.querySelector('.screenshot-toolbar button[aria-label="取消截图"]')),
          visible: getComputedStyle(document.querySelector('.screenshot-editor-overlay')).visibility,
          oldSelectionRemoved: !document.querySelector('.selection-overlay'),
        })`),
      (value) => value?.cancelButton && value.visible === 'visible' && value.oldSelectionRemoved,
    );
    await rightClick(editorCancel, 24, 24);
    const editorCancelled = await waitForScreenshotState(app.main, 'idle', 10_000);
    editorCancel.close();
    const afterEditorCancel = await listPngFiles();
    results.screenshotEditorCancel = {
      state: editorCancelled.screenshot.state,
      cancelledBy: 'right-click',
      createdFiles: afterEditorCancel.filter((file) => !beforeEditorCancel.includes(file)),
    };
    console.error('[runtime] screenshot editor cancel complete');

    console.error('[runtime] recording setup cancel start');
    const beforeSetupCancel = await listVideoFiles();
    const existingSetupCancelTargets = await targetIdsForMode(9333, 'selection');
    await app.main.evaluate("window.screenRecorder.start('region')");
    const setupCancelSelection = await connectTarget(9333, 'selection', existingSetupCancelTargets);
    await assertSelectionLayerIsTransparent(setupCancelSelection);
    await setupCancelSelection.evaluate(
      'void window.screenRecorder.confirmSelection({ x: 80, y: 80, width: 240, height: 180 }); true',
    );
    const setupCancel = await connectTarget(9333, 'recording-setup');
    await waitFor(
      '录屏设置取消按钮',
      () => setupCancel.evaluate("Boolean(document.querySelector('.recording-setup-cancel'))"),
      Boolean,
    );
    const setupRightClick = await rightClickSelection(setupCancelSelection, 32, 32);
    const setupCancelled = await waitForState(app.main, 'idle', 10_000);
    setupCancelSelection.close();
    setupCancel.close();
    const afterSetupCancel = await listVideoFiles();
    results.recordingSetupCancel = {
      state: setupCancelled.state,
      cancelledBy: 'selection-right-click',
      rightClick: setupRightClick,
      createdFiles: afterSetupCancel.filter((file) => !beforeSetupCancel.includes(file)),
    };
    console.error('[runtime] recording setup cancel complete');

    const previousShortcuts = (await snapshot(app.main)).shortcuts;
    const shortcutSnapshot = await snapshot(app.main);
    if (shortcutSnapshot.warning?.includes('快捷键')) {
      results.shortcuts = {
        skipped: true,
        reason: shortcutSnapshot.warning,
        settings: previousShortcuts,
      };
    } else {
      const smokeShortcuts = {
        screenshot: 'Control+Alt+Shift+8',
        recording: 'Control+Alt+Shift+9',
        colorPicker: 'Control+Alt+Shift+7',
      };
      await app.main.evaluate(
        `window.screenRecorder.updateShortcuts(${JSON.stringify(smokeShortcuts)})`,
      );
      results.shortcuts = (await snapshot(app.main)).shortcuts;
      await app.main.evaluate(
        `window.screenRecorder.updateShortcuts(${JSON.stringify(previousShortcuts)})`,
      );
    }

    console.error('[runtime] full-screen start');
    const beforeFullScreen = await listVideoFiles();
    const duplicate = await app.main.evaluate(
      `Promise.allSettled([
        window.screenRecorder.start('screen'),
        window.screenRecorder.start('screen'),
      ]).then((items) => items.map((item) => item.status))`,
    );
    const fullSetup = await inspectRecordingSetup(9333, undefined, false, ['系统声音']);
    const fullIndicator = await inspectRecordingIndicator(9333, 'screen');
    const fullControl = await inspectRecordingControl(9333);
    const fullOutput = await waitForNewOutput(beforeFullScreen);
    console.error('[runtime] full-screen complete');
    results.fullScreen = {
      duplicateStartResults: duplicate,
      setup: fullSetup,
      indicator: fullIndicator,
      control: fullControl,
      ...fullOutput,
    };

    console.error('[runtime] region start');
    const beforeRegion = await listVideoFiles();
    const previousSelectionTargetIds = await targetIdsForMode(9333, 'selection');
    await app.main.evaluate("window.screenRecorder.start('region')");
    const selection = await connectTarget(9333, 'selection', previousSelectionTargetIds);
    const selectionAppearance = await selectWithMask(selection, {
      x: 100,
      y: 100,
      width: 320,
      height: 240,
    });
    selection.close();
    const regionSetup = await inspectRecordingSetup(
      9333,
      { x: 100, y: 100, width: 320, height: 240 },
      true,
    );
    const regionIndicator = await inspectRecordingIndicator(9333, 'region');
    const regionControl = await inspectRecordingControl(9333);
    const regionOutput = await waitForNewOutput(beforeRegion);
    const expectedRegionExtension = regionSetup.selectedFormat === 'MP4' ? '.mp4' : '.webm';
    if (!regionOutput.path.endsWith(expectedRegionExtension)) {
      throw new Error(
        `录屏格式与输出扩展名不匹配：${JSON.stringify({ regionSetup, regionOutput })}`,
      );
    }
    console.error('[runtime] region complete');
    results.region = {
      selection: { x: 100, y: 100, width: 320, height: 240 },
      selectionAppearance,
      setup: regionSetup,
      indicator: regionIndicator,
      control: regionControl,
      ...regionOutput,
    };

    console.error('[runtime] cancel start');
    const beforeCancel = await listVideoFiles();
    const existingCancelTargets = await targetIdsForMode(9333, 'selection');
    await app.main.evaluate("window.screenRecorder.start('region')");
    const cancelSelection = await connectTarget(9333, 'selection', existingCancelTargets);
    await waitFor(
      '选择层挂载',
      () => cancelSelection.evaluate("Boolean(document.querySelector('.selection-overlay'))"),
      Boolean,
    );
    const recordingRightClick = await rightClickSelection(cancelSelection);
    const cancelledSnapshot = await waitForState(app.main, 'idle', 10_000);
    cancelSelection.close();
    const afterCancel = await listVideoFiles();
    results.cancel = {
      state: cancelledSnapshot.state,
      cancelledBy: 'right-click',
      rightClick: recordingRightClick,
      createdFiles: afterCancel.filter((file) => !beforeCancel.includes(file)),
    };
    console.error('[runtime] cancel complete');

    console.error('[runtime] floating cancel start');
    const beforeFloatingCancel = await listVideoFiles();
    await app.main.evaluate("window.screenRecorder.start('screen')");
    await inspectRecordingSetup(9333, undefined);
    const floatingControl = await connectTarget(9333, 'control');
    await waitFor(
      '倒计时取消按钮',
      () =>
        floatingControl.evaluate(
          "document.querySelector('.recording-control button')?.textContent",
        ),
      (text) => text === '取消',
    );
    await floatingControl.evaluate("document.querySelector('.recording-control button')?.click()");
    floatingControl.close();
    const cancelledCountdown = await waitForState(app.main, 'idle', 10_000);
    const afterFloatingCancel = await listVideoFiles();
    results.floatingCancel = {
      state: cancelledCountdown.state,
      createdFiles: afterFloatingCancel.filter((file) => !beforeFloatingCancel.includes(file)),
    };
    console.error('[runtime] floating cancel complete');

    console.error('[runtime] floating stop start');
    await delay(250);
    const beforeFloatingStop = await listVideoFiles();
    await app.main.evaluate("window.screenRecorder.start('screen')");
    await inspectRecordingSetup(9333, undefined);
    const stopControl = await connectTarget(9333, 'control');
    await waitFor(
      '悬浮停止录制按钮',
      () =>
        stopControl.evaluate("document.querySelector('.recording-control button')?.textContent"),
      (text) => text === '停止录制',
    );
    await delay(1_200);
    await stopControl.evaluate("document.querySelector('.recording-control button')?.click()");
    stopControl.close();
    const floatingStopOutput = await waitForNewOutput(beforeFloatingStop);
    const stoppedSnapshot = await waitForState(app.main, 'completed', 10_000);
    const completion = await inspectCompletion(9333);
    results.floatingStop = {
      state: stoppedSnapshot.state,
      completion,
      ...floatingStopOutput,
    };
    console.error('[runtime] floating stop complete');
    return results;
  } finally {
    await stopApp(app);
  }
}

async function runErrorScenario(port, environment, action, expectedText) {
  console.error(`[runtime] error scenario ${port}`);
  const before = await listVideoFiles();
  const app = await launch(port, environment);
  try {
    if (action) {
      await app.main.evaluate(action);
      const current = await snapshot(app.main);
      if (current.state === 'configuring') {
        await inspectRecordingSetup(port, undefined);
      }
    }
    const result = action
      ? await waitForState(app.main, 'error', 20_000)
      : await snapshot(app.main);
    const after = await listVideoFiles();
    if (!String(result.error ?? result.warning).includes(expectedText)) {
      throw new Error(`错误文案不匹配：${JSON.stringify(result)}`);
    }
    return {
      state: result.state,
      message: result.error ?? result.warning,
      createdFiles: after.filter((file) => !before.includes(file)),
    };
  } finally {
    await stopApp(app);
  }
}

async function runScreenshotErrorScenario(port, environment, expectedText) {
  console.error(`[runtime] screenshot error scenario ${port}`);
  const before = await listPngFiles();
  const app = await launch(port, environment);
  try {
    await app.main.evaluate("window.screenRecorder.startScreenshot('screen')");
    const result = await waitForScreenshotState(app.main, 'error', 10_000);
    const after = await listPngFiles();
    if (!String(result.error).includes(expectedText)) {
      throw new Error(`截图错误文案不匹配：${JSON.stringify(result)}`);
    }
    return {
      state: result.screenshot.state,
      message: result.error,
      createdFiles: after.filter((file) => !before.includes(file)),
    };
  } finally {
    await stopApp(app);
  }
}

async function runErrorScenarios() {
  return {
    permission: await runErrorScenario(
      9334,
      { VALLEY_SCREEN_RECORDER_TEST_PERMISSION_DENIED: '1' },
      "window.screenRecorder.start('screen')",
      '权限被拒绝',
    ),
    shortcut: await runErrorScenario(
      9335,
      { VALLEY_SCREEN_RECORDER_TEST_SHORTCUT_FAILURE: '1' },
      undefined,
      '快捷键',
    ),
    write: await runErrorScenario(
      9336,
      { VALLEY_SCREEN_RECORDER_TEST_WRITE_FAILURE: '1' },
      "window.screenRecorder.start('screen')",
      '文件写入失败',
    ),
    screenshotPermission: await runScreenshotErrorScenario(
      9337,
      { VALLEY_SCREEN_RECORDER_TEST_PERMISSION_DENIED: '1' },
      '权限被拒绝',
    ),
    screenshotWrite: await runScreenshotErrorScenario(
      9338,
      { VALLEY_SCREEN_RECORDER_TEST_WRITE_FAILURE: '1' },
      '文件写入失败',
    ),
  };
}

await accessExecutable();
if (scenario === 'region-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'long-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'core-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'fixes-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'selection-interactions-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'activation-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'activation-surfaces-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'settings-surface-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'screenshot-handoff-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'settings-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'screenshot-only') {
  console.log(JSON.stringify({ core: await runCoreScenarios() }, null, 2));
  process.exit(0);
}
if (scenario === 'errors-only') {
  console.log(JSON.stringify({ errors: await runErrorScenarios() }, null, 2));
  process.exit(0);
}
const report = {
  core: await runCoreScenarios(),
  errors: await runErrorScenarios(),
};

console.log(JSON.stringify(report, null, 2));

async function accessExecutable() {
  await stat(executable);
}
