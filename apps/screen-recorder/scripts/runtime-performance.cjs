// Run with Electron after build. Uses an isolated profile and never changes installed shortcuts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  nativeImage,
  screen,
  systemPreferences,
} = require('electron');

const nativeCapture = process.env.SCREEN_RECORDER_PERF_NATIVE === '1';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'valley-capture-perf-'));
app.setPath('userData', profile);
const shortcuts = new Map();
globalShortcut.register = (accelerator, callback) => {
  shortcuts.set(accelerator, callback);
  return true;
};
const outputFile = path.join(profile, 'export.png');
let copiedImage;
clipboard.writeImage = (image) => {
  copiedImage = image;
};
dialog.showSaveDialog = async () => ({ canceled: false, filePath: outputFile });
if (!nativeCapture) systemPreferences.getMediaAccessStatus = () => 'granted';

const results = { nativeCapture, captures: [], switches: [], hides: 0 };
const capture = desktopCapturer.getSources.bind(desktopCapturer);
let sourceImage;
let rejectNextCapture = false;
desktopCapturer.getSources = async (options) => {
  if (rejectNextCapture) {
    rejectNextCapture = false;
    throw new Error('Injected capture failure');
  }
  const started = performance.now();
  let sources;
  if (nativeCapture) sources = await capture(options);
  else {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const { width, height } = options.thumbnailSize;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        pixels[offset] = (x * 7 + y * 3) % 256;
        pixels[offset + 1] = (x + y) % 256;
        pixels[offset + 2] = x % 256;
        pixels[offset + 3] = 255;
      }
    sources = [
      {
        id: 'screen:0:0',
        display_id: String(screen.getPrimaryDisplay().id),
        thumbnail: nativeImage.createFromBitmap(pixels, { width, height }),
      },
    ];
  }
  results.captures.push(Math.round(performance.now() - started));
  sourceImage = sources.find(
    (source) => source.display_id === String(screen.getPrimaryDisplay().id),
  )?.thumbnail;
  return sources;
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const findWindow = (mode) =>
  BrowserWindow.getAllWindows().find((window) =>
    window.webContents.getURL().includes(`mode=${mode}`),
  );
async function until(read, predicate = Boolean) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await pause(10);
  }
  throw new Error('Timed out waiting for capture UI');
}
const evaluate = async (window, expression) => {
  try {
    return await window.webContents.executeJavaScript(expression);
  } catch (error) {
    throw new Error(`Evaluation failed: ${expression.slice(0, 160)}`, { cause: error });
  }
};
const paint = (window) =>
  evaluate(
    window,
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
const input = (window, type, x, y) => {
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
  return window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
    type: { mouseDown: 'mousePressed', mouseMove: 'mouseMoved', mouseUp: 'mouseReleased' }[type],
    x,
    y,
    button: 'left',
    buttons: type === 'mouseUp' ? 0 : 1,
    clickCount: 1,
  });
};

require(path.join(__dirname, '..', 'dist-electron/main.cjs'));
app.whenReady().then(async () => {
  let exitCode = 0;
  try {
    // Pin the test target without moving the user's real cursor between monitors.
    const display = screen.getPrimaryDisplay();
    screen.getCursorScreenPoint = () => ({
      x: display.bounds.x + Math.round(display.bounds.width / 2),
      y: display.bounds.y + Math.round(display.bounds.height / 2),
    });
    const selection = await until(() => findWindow('selection'));
    const main = findWindow('main');
    selection.setIgnoreMouseEvents(true);
    await until(() => evaluate(selection, 'Boolean(window.screenRecorder)'));
    if (nativeCapture && process.platform === 'darwin') {
      assert.equal(
        systemPreferences.getMediaAccessStatus('screen'),
        'granted',
        'Native permission is required; this probe never requests it',
      );
    }
    const snapshot = await evaluate(main, 'window.screenRecorder.getSnapshot()');
    selection.on('hide', () => results.hides++);
    const activationStarted = performance.now();
    shortcuts.get(snapshot.shortcuts.screenshot)();
    await until(() => selection.isVisible());
    await paint(selection);
    results.activationMs = Math.round(performance.now() - activationStarted);
    await until(() =>
      evaluate(selection, 'Boolean(document.querySelector(".screenshot-frozen-frame"))'),
    );
    await evaluate(
      selection,
      'window.perfBackdrop = document.querySelector(".screenshot-frozen-frame")',
    );
    const capturesBeforeSwitch = results.captures.length;
    for (const index of [1, 0, 1, 0, 1, 0]) {
      const started = performance.now();
      await evaluate(selection, `document.querySelectorAll('[role="tab"]')[${index}].click()`);
      await until(() =>
        evaluate(
          selection,
          `document.querySelectorAll('[role="tab"]')[${index}]?.getAttribute('aria-selected') === 'true'`,
        ),
      );
      await paint(selection);
      results.switches.push(Math.round(performance.now() - started));
      assert.equal(
        await evaluate(
          selection,
          'document.querySelector(".screenshot-frozen-frame") === window.perfBackdrop',
        ),
        true,
        'Mode switching replaced the desktop image',
      );
    }
    assert.equal(
      results.captures.length,
      capturesBeforeSwitch,
      'Tab switching captured the desktop again',
    );
    assert.equal(results.hides, 0, 'Tab switching hid the overlay');
    assert.ok(
      [...results.switches].sort((a, b) => a - b)[3] < 120,
      'Median tab switch exceeded 120 ms',
    );

    const dimensions = await evaluate(selection, '({ width: innerWidth, height: innerHeight })');
    const rect = {
      x: 100,
      y: 160,
      width: Math.min(500, dimensions.width - 180),
      height: Math.min(320, dimensions.height - 220),
    };
    await input(selection, 'mouseDown', rect.x, rect.y);
    await paint(selection);
    // Real Chromium input, with a geometry assertion after each painted drag frame.
    for (let step = 1; step <= 8; step++) {
      const x = rect.x + Math.round((rect.width * step) / 8);
      const y = rect.y + Math.round((rect.height * step) / 8);
      await input(selection, 'mouseMove', x, y);
      await paint(selection);
      const geometry = await evaluate(
        selection,
        'document.querySelector(".selection-box").getBoundingClientRect().toJSON()',
      );
      assert.equal(geometry.width, x - rect.x);
      assert.equal(geometry.height, y - rect.y);
    }
    await evaluate(
      selection,
      `(() => {
      window.handoffProbe = { frames: [], readyMs: 0, blankFrames: 0 };
      const start = performance.now();
      const sample = (time) => {
        const probe = window.handoffProbe;
        probe.frames.push(time);
        const editor = document.querySelector('.screenshot-editor-overlay');
        const ready = editor && getComputedStyle(editor).visibility === 'visible';
        if (!ready && !document.querySelector('.selection-overlay')) probe.blankFrames++;
        if (ready) probe.readyMs = performance.now() - start;
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    })()`,
    );
    await input(selection, 'mouseUp', rect.x + rect.width, rect.y + rect.height);
    const handoff = await until(
      () => evaluate(selection, 'window.handoffProbe'),
      (probe) => probe.readyMs > 0,
    );
    results.handoffMs = Math.round(handoff.readyMs);
    results.handoffMaxFrameMs = Math.round(
      Math.max(0, ...handoff.frames.slice(1).map((time, index) => time - handoff.frames[index])),
    );
    assert.equal(handoff.blankFrames, 0);
    assert.ok(results.handoffMs < 150, 'Editor handoff exceeded 150 ms');
    assert.equal(
      await evaluate(
        selection,
        'document.querySelector(".screenshot-frozen-frame") === window.perfBackdrop',
      ),
      true,
      'Handoff replaced the desktop image',
    );

    const handle = await evaluate(
      selection,
      'document.querySelector("[data-screenshot-selection-handle=se]").getBoundingClientRect().toJSON()',
    );
    const handleX = Math.round(handle.x + handle.width / 2);
    const handleY = Math.round(handle.y + handle.height / 2);
    await input(selection, 'mouseDown', handleX, handleY);
    await input(selection, 'mouseMove', handleX + 40, handleY + 30);
    await paint(selection);
    await input(selection, 'mouseUp', handleX + 40, handleY + 30);
    await until(
      () => evaluate(selection, 'window.screenRecorder.getScreenshotEditPlan()'),
      (plan) => plan.selection.width === rect.width + 40,
    );
    await paint(selection);
    const plan = await evaluate(selection, 'window.screenRecorder.getScreenshotEditPlan()');
    assert.equal(plan.selection.height, rect.height + 30);
    // Export through the real editor, IPC validation and file writer; the dialog is isolated.
    await evaluate(
      selection,
      `document.querySelector('button[aria-label="保存截图文件"]').click()`,
    );
    await until(() => fs.existsSync(outputFile));
    const exported = nativeImage.createFromBuffer(fs.readFileSync(outputFile));
    assert.deepEqual(exported.getSize(), plan.pixelSize);
    const source = sourceImage.toBitmap();
    const output = exported.toBitmap();
    const sourceSize = sourceImage.getSize();
    for (const [x, y] of [
      [2, 2],
      [19, 17],
      [plan.pixelSize.width - 3, plan.pixelSize.height - 3],
    ]) {
      const inputOffset = ((plan.sourceRect.y + y) * sourceSize.width + plan.sourceRect.x + x) * 4;
      const outputOffset = (y * plan.pixelSize.width + x) * 4;
      assert.deepEqual(
        [...output.subarray(outputOffset, outputOffset + 4)],
        [...source.subarray(inputOffset, inputOffset + 4)],
        'Export pixels differ from the captured selection',
      );
    }
    results.exportSize = exported.getSize();
    await until(() => copiedImage);
    assert.deepEqual(copiedImage.getSize(), exported.getSize());
    assert.equal(results.captures.length, capturesBeforeSwitch, 'Editing recaptured the desktop');

    // Begin directly in recording mode, switch to screenshot, and cancel without output.
    await until(() => selection.isDestroyed());
    await until(() => findWindow('selection'));
    const recordingSurface = findWindow('selection');
    recordingSurface.setIgnoreMouseEvents(true);
    await until(() => evaluate(recordingSurface, 'Boolean(window.screenRecorder)'));
    await evaluate(main, 'window.screenRecorder.start("region")');
    await until(() => recordingSurface.isVisible());
    const recordingCaptureCount = results.captures.length;
    await evaluate(recordingSurface, 'window.screenRecorder.switchSelectionPurpose("screenshot")');
    assert.equal(results.captures.length, recordingCaptureCount);
    await evaluate(recordingSurface, 'void window.screenRecorder.cancelSelection(); true');
    await until(
      () => evaluate(main, 'window.screenRecorder.getSnapshot()'),
      (state) => state.screenshot.state === 'idle',
    );
    await until(() => recordingSurface.isDestroyed());
    // A rejected capture must not leave either entry point stuck in selecting.
    for (const entry of ['start', 'startScreenshot']) {
      rejectNextCapture = true;
      await assert.rejects(evaluate(main, `window.screenRecorder.${entry}("region")`));
      const failed = await evaluate(main, 'window.screenRecorder.getSnapshot()');
      assert.equal(entry === 'start' ? failed.state : failed.screenshot.state, 'error');
    }
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(error);
    console.error(JSON.stringify(results));
    exitCode = 1;
  } finally {
    app.once('will-quit', () => {
      fs.rmSync(profile, { recursive: true, force: true });
      app.exit(exitCode);
    });
    app.quit();
  }
});
