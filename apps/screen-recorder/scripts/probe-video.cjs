const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const videoPath = process.argv[2];
const expectedWidth = process.argv[3] ? Number(process.argv[3]) : undefined;
const expectedHeight = process.argv[4] ? Number(process.argv[4]) : undefined;
const expectAudio = process.argv[5] === 'audio';
const videoUrl = videoPath ? pathToFileURL(videoPath).href : undefined;

if (!videoPath) {
  console.error('Usage: electron scripts/probe-video.cjs <video> [width] [height] [audio]');
  process.exit(2);
}

const fail = (message) => {
  console.error(message);
  app.exit(1);
};

app.commandLine.appendSwitch('allow-file-access-from-files');

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Test-only data page: allow its <video> element to decode the explicit local fixture path.
      // Product windows keep webSecurity enabled and never accept renderer-provided paths.
      webSecurity: false,
    },
  });

  try {
    const html = `<!doctype html><meta charset="utf-8"><video src="${videoUrl}"></video>`;
    await window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const video = document.querySelector('video');
        if (!video) throw new Error('没有找到视频解码器元素');
        video.muted = true;
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('读取视频元数据超时')), 10000);
            video.addEventListener('loadedmetadata', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
            video.addEventListener('error', () => {
              clearTimeout(timeout);
              reject(new Error(video.error?.message ?? '视频解码失败'));
            }, { once: true });
          });
        }
        const startedAt = video.currentTime;
        await video.play();
        const decodedStream = video.captureStream();
        await new Promise((resolve) => setTimeout(resolve, 600));
        video.pause();
        return {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number.isFinite(video.duration) ? video.duration : String(video.duration),
          advancedSeconds: video.currentTime - startedAt,
          audioTracks: decodedStream.getAudioTracks().length,
          readyState: video.readyState,
        };
      })()
    `);

    if (result.width < 1 || result.height < 1 || result.advancedSeconds <= 0) {
      throw new Error(`视频未成功解码播放：${JSON.stringify(result)}`);
    }
    if (
      (expectedWidth !== undefined && result.width !== expectedWidth) ||
      (expectedHeight !== undefined && result.height !== expectedHeight)
    ) {
      throw new Error(
        `视频尺寸不匹配：${JSON.stringify({ result, expectedWidth, expectedHeight })}`,
      );
    }
    if (expectAudio && result.audioTracks < 1) {
      throw new Error(`视频缺少可解码音轨：${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({ path: videoPath, ...result }, null, 2));
    app.exit(0);
  } catch (error) {
    fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
});
