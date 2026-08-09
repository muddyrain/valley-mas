import { dipRectToVideoPixels } from '../core/geometry';
import { chooseRecordingMimeType } from '../core/mime';
import { getCameraOverlayRect } from '../core/recording-options';
import type { CapturePlan, RecorderApi } from '../shared/contracts';
import { getDisplayMediaOptions, getUserMediaOptions, shouldCompositeVideo } from './media-capture';
import { RecordingResources } from './recording-resources';

type ActiveRecording = {
  mediaRecorder: MediaRecorder;
  resources: RecordingResources;
  sessionId: string;
  writeQueue: Promise<void>;
  finishing: boolean;
};

function errorText(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '媒体权限被拒绝。请在系统隐私设置中允许屏幕、麦克风或摄像头访问。';
  }
  return error instanceof Error ? error.message : fallback;
}

export class RecorderRuntime {
  private active: ActiveRecording | undefined;
  private attemptRevision = 0;
  private disposed = false;
  private operationId: string | undefined;
  private pendingResources: RecordingResources | undefined;

  constructor(
    private readonly api: RecorderApi,
    private readonly onCountdown: (seconds: number) => void,
    private readonly onError: (message: string) => void,
  ) {}

  async begin(plan: CapturePlan): Promise<void> {
    if (this.disposed || this.operationId === plan.operationId || this.active) {
      return;
    }
    const revision = this.attemptRevision;
    const resources = new RecordingResources();
    this.pendingResources = resources;
    this.operationId = plan.operationId;
    try {
      this.onCountdown(Math.max(0, Math.ceil((plan.countdownEndsAt - Date.now()) / 1000)));
      const confirmedPlan = await this.api.prepareCapture(plan.operationId);
      if (!this.isCurrentAttempt(revision, plan.operationId)) {
        resources.cleanup();
        return;
      }
      this.onCountdown(0);
      const sourceStream = await navigator.mediaDevices.getDisplayMedia(
        getDisplayMediaOptions(confirmedPlan.options),
      );
      resources.addStream(sourceStream);
      if (!this.isCurrentAttempt(revision, plan.operationId)) {
        resources.cleanup();
        return;
      }
      const localMediaOptions = getUserMediaOptions(confirmedPlan.options);
      const localStream = localMediaOptions
        ? await navigator.mediaDevices.getUserMedia(localMediaOptions)
        : undefined;
      if (localStream) resources.addStream(localStream);
      const videoStream = shouldCompositeVideo(confirmedPlan.mode, confirmedPlan.options.camera)
        ? await this.createCompositedVideoStream(
            sourceStream,
            localStream,
            confirmedPlan,
            resources,
          )
        : sourceStream;
      const recordingStream = await this.createRecordingStream(
        videoStream,
        [
          { stream: sourceStream, gain: confirmedPlan.options.audioGain },
          ...(localStream ? [{ stream: localStream, gain: 1 }] : []),
        ],
        resources,
      );
      if (!this.isCurrentAttempt(revision, plan.operationId)) {
        resources.cleanup();
        return;
      }
      const mimeType = chooseRecordingMimeType(confirmedPlan.container, (candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      );
      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType,
        ...(recordingStream.getAudioTracks().length > 0 ? { audioBitsPerSecond: 128_000 } : {}),
        videoBitsPerSecond:
          confirmedPlan.mode === 'region'
            ? Math.max(
                750_000,
                Math.min(
                  8_000_000,
                  (recordingStream.getVideoTracks()[0]?.getSettings().width ?? 1280) *
                    (recordingStream.getVideoTracks()[0]?.getSettings().height ?? 720) *
                    6,
                ),
              )
            : 8_000_000,
      });
      const { sessionId } = await this.api.startWriting(mimeType);
      if (!this.isCurrentAttempt(revision, plan.operationId)) {
        resources.cleanup();
        await this.api.abort(sessionId, '录制宿主已关闭').catch(() => undefined);
        return;
      }
      const active: ActiveRecording = {
        mediaRecorder,
        resources,
        sessionId,
        writeQueue: Promise.resolve(),
        finishing: false,
      };
      this.active = active;
      this.pendingResources = undefined;

      const onData = (event: BlobEvent) => {
        if (event.data.size === 0) {
          return;
        }
        active.writeQueue = active.writeQueue.then(async () => {
          const chunk = await event.data.arrayBuffer();
          await this.api.appendChunk(sessionId, chunk);
        });
      };
      const onStop = () => void this.finish(active);
      const onRecorderError = (event: Event) => {
        const recorderError = (event as Event & { error?: DOMException }).error;
        void this.abort(active, errorText(recorderError, 'MediaRecorder 录制失败'));
      };
      mediaRecorder.addEventListener('dataavailable', onData);
      mediaRecorder.addEventListener('stop', onStop, { once: true });
      mediaRecorder.addEventListener('error', onRecorderError);
      resources.addListener(() => mediaRecorder.removeEventListener('dataavailable', onData));
      resources.addListener(() => mediaRecorder.removeEventListener('stop', onStop));
      resources.addListener(() => mediaRecorder.removeEventListener('error', onRecorderError));

      for (const track of sourceStream.getVideoTracks()) {
        const onEnded = () => void this.api.stop();
        track.addEventListener('ended', onEnded, { once: true });
        resources.addListener(() => track.removeEventListener('ended', onEnded));
      }
      mediaRecorder.start(1000);
    } catch (error) {
      if (!this.isCurrentAttempt(revision, plan.operationId)) {
        resources.cleanup();
        return;
      }
      const message = errorText(error, '无法开始屏幕录制');
      resources.cleanup();
      this.pendingResources = undefined;
      this.operationId = undefined;
      this.onError(message);
      await this.api.abort(this.active?.sessionId, message).catch(() => undefined);
      this.active = undefined;
    }
  }

  requestStop(): void {
    const recorder = this.active?.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }
    recorder.requestData();
    recorder.stop();
  }

  dispose(): void {
    this.disposed = true;
    this.attemptRevision += 1;
    this.pendingResources?.cleanup();
    this.pendingResources = undefined;
    const active = this.active;
    if (active) {
      active.resources.cleanup();
      if (active.mediaRecorder.state !== 'inactive') {
        active.mediaRecorder.stop();
      }
      void this.api.abort(active.sessionId, '录制宿主已关闭').catch(() => undefined);
      this.active = undefined;
    }
    this.operationId = undefined;
  }

  private async createCompositedVideoStream(
    sourceStream: MediaStream,
    localStream: MediaStream | undefined,
    plan: CapturePlan,
    resources: RecordingResources,
  ): Promise<MediaStream> {
    if (plan.mode === 'region' && !plan.selection) {
      throw new Error('区域录制缺少有效选区');
    }
    const track = sourceStream.getVideoTracks()[0];
    if (!track) {
      throw new Error('屏幕捕获流没有视频轨道');
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = sourceStream;
    video.style.position = 'fixed';
    video.style.left = '0';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '1';
    document.body.append(video);
    let stopped = false;
    let frameCallbackId: number | undefined;
    resources.addListener(() => {
      stopped = true;
      if (frameCallbackId !== undefined) {
        video.cancelVideoFrameCallback(frameCallbackId);
      }
      video.pause();
      video.srcObject = null;
      video.remove();
    });
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('无法读取屏幕捕获流')), {
        once: true,
      });
    });
    await video.play();

    const settings = track.getSettings();
    const fallbackWidth = Math.round(plan.display.bounds.width * plan.display.scaleFactor);
    const fallbackHeight = Math.round(plan.display.bounds.height * plan.display.scaleFactor);
    const actualWidth = settings.width ?? fallbackWidth;
    const actualHeight = settings.height ?? fallbackHeight;
    const sourceSize = {
      width: actualWidth > 0 ? actualWidth : fallbackWidth,
      height: actualHeight > 0 ? actualHeight : fallbackHeight,
    };
    const crop = plan.selection
      ? dipRectToVideoPixels(plan.selection, plan.display, sourceSize)
      : { x: 0, y: 0, width: sourceSize.width, height: sourceSize.height };
    let cameraVideo: HTMLVideoElement | undefined;
    if (plan.options.camera) {
      if (!localStream?.getVideoTracks()[0]) throw new Error('摄像头没有产生有效视频轨道');
      cameraVideo = document.createElement('video');
      cameraVideo.muted = true;
      cameraVideo.playsInline = true;
      cameraVideo.srcObject = localStream;
      cameraVideo.style.position = 'fixed';
      cameraVideo.style.left = '0';
      cameraVideo.style.top = '0';
      cameraVideo.style.width = '1px';
      cameraVideo.style.height = '1px';
      cameraVideo.style.opacity = '0';
      document.body.append(cameraVideo);
      const activeCameraVideo = cameraVideo;
      resources.addListener(() => {
        activeCameraVideo.pause();
        activeCameraVideo.srcObject = null;
        activeCameraVideo.remove();
      });
      await new Promise<void>((resolve, reject) => {
        activeCameraVideo.addEventListener('loadedmetadata', () => resolve(), { once: true });
        activeCameraVideo.addEventListener('error', () => reject(new Error('无法读取摄像头画面')), {
          once: true,
        });
      });
      await activeCameraVideo.play();
    }
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    canvas.style.position = 'fixed';
    canvas.style.left = `${-(crop.width + 1)}px`;
    canvas.style.top = `${-(crop.height + 1)}px`;
    document.body.append(canvas);
    resources.addListener(() => canvas.remove());
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('无法创建区域裁剪画布');
    }

    const croppedStream = canvas.captureStream(30);
    await new Promise<void>((resolve, reject) => {
      let firstFrameDrawn = false;
      const timeout = setTimeout(() => {
        if (!firstFrameDrawn) {
          stopped = true;
          reject(new Error('区域录制未收到有效视频帧'));
        }
      }, 5_000);
      resources.setTimer(timeout);
      const drawFrame: VideoFrameRequestCallback = () => {
        try {
          context.drawImage(
            video,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height,
          );
          if (cameraVideo) {
            const overlay = getCameraOverlayRect({ width: crop.width, height: crop.height });
            const radius = Math.max(8, Math.round(overlay.width * 0.035));
            context.save();
            context.beginPath();
            context.roundRect(overlay.x, overlay.y, overlay.width, overlay.height, radius);
            context.clip();
            context.translate(overlay.x + overlay.width, overlay.y);
            context.scale(-1, 1);
            context.drawImage(cameraVideo, 0, 0, overlay.width, overlay.height);
            context.restore();
            context.save();
            context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
            context.lineWidth = Math.max(2, Math.round(overlay.width / 120));
            context.beginPath();
            context.roundRect(overlay.x, overlay.y, overlay.width, overlay.height, radius);
            context.stroke();
            context.restore();
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
          return;
        }
        if (!firstFrameDrawn) {
          firstFrameDrawn = true;
          clearTimeout(timeout);
          resolve();
        }
        if (!stopped) {
          frameCallbackId = video.requestVideoFrameCallback(drawFrame);
        }
      };
      frameCallbackId = video.requestVideoFrameCallback(drawFrame);
    });
    resources.addStream(croppedStream);
    return croppedStream;
  }

  private async createRecordingStream(
    videoStream: MediaStream,
    audioStreams: Array<{ stream: MediaStream; gain: number }>,
    resources: RecordingResources,
  ): Promise<MediaStream> {
    const videoTracks = videoStream.getVideoTracks();
    const audioTracks = audioStreams.flatMap(({ stream, gain }) =>
      stream.getAudioTracks().map((track) => ({ track, gain })),
    );
    if (audioTracks.length === 0) return videoStream;
    if (audioTracks.length === 1 && audioTracks[0].gain === 1) {
      return new MediaStream([...videoTracks, audioTracks[0].track]);
    }

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const sourceNodes = audioTracks.map(({ track, gain }) => {
      const node = audioContext.createMediaStreamSource(new MediaStream([track]));
      const gainNode = audioContext.createGain();
      gainNode.gain.value = gain;
      node.connect(gainNode);
      gainNode.connect(destination);
      return { node, gainNode };
    });
    resources.addStream(destination.stream);
    resources.addListener(() => {
      for (const { node, gainNode } of sourceNodes) {
        node.disconnect();
        gainNode.disconnect();
      }
      void audioContext.close();
    });
    if (audioContext.state === 'suspended') await audioContext.resume();
    const mixedTrack = destination.stream.getAudioTracks()[0];
    if (!mixedTrack) throw new Error('无法合成系统声音和麦克风');
    return new MediaStream([...videoTracks, mixedTrack]);
  }

  private isCurrentAttempt(revision: number, operationId: string): boolean {
    return !this.disposed && this.attemptRevision === revision && this.operationId === operationId;
  }

  private async finish(active: ActiveRecording): Promise<void> {
    if (active.finishing) {
      return;
    }
    active.finishing = true;
    try {
      await active.writeQueue;
      active.resources.cleanup();
      await this.api.finish(active.sessionId);
      this.active = undefined;
      this.operationId = undefined;
    } catch (error) {
      await this.abort(active, `无法保存录制文件：${errorText(error, '未知错误')}`);
    }
  }

  private async abort(active: ActiveRecording, message: string): Promise<void> {
    if (this.active !== active) {
      return;
    }
    active.finishing = true;
    active.resources.cleanup();
    this.active = undefined;
    this.operationId = undefined;
    this.onError(message);
    await this.api.abort(active.sessionId, message).catch(() => undefined);
  }
}
