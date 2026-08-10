import { randomUUID } from 'node:crypto';
import { type FileHandle, mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRecordingFilename } from '../src/core/filename';
import { recordingContainerForMime } from '../src/core/mime';

const MAX_CHUNK_BYTES = 32 * 1024 * 1024;

type ActiveFile = {
  sessionId: string;
  finalPath: string;
  temporaryPath: string;
  handle: FileHandle;
  bytesWritten: number;
  queue: Promise<void>;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export class RecordingFileWriter {
  private active: ActiveFile | undefined;
  private directory: string;

  constructor(
    saveDirectory: string,
    private readonly forceWriteFailure = false,
  ) {
    this.directory = saveDirectory;
  }

  get saveDirectory(): string {
    return this.directory;
  }

  setSaveDirectory(saveDirectory: string): void {
    if (this.active) throw new Error('录制期间不能更改保存目录');
    if (!saveDirectory) throw new Error('保存目录无效');
    this.directory = saveDirectory;
  }

  async begin(mimeType: string): Promise<{ sessionId: string; outputPath: string }> {
    if (this.active) {
      throw new Error('已有文件写入会话');
    }
    if (this.forceWriteFailure) {
      throw new Error('测试模式：文件写入失败');
    }

    await mkdir(this.saveDirectory, { recursive: true });
    const container = recordingContainerForMime(mimeType);
    if (!container) {
      throw new Error('录制 MIME 与输出容器不匹配');
    }
    const baseName = createRecordingFilename(new Date(), container);
    const extension = path.extname(baseName);
    const stem = path.basename(baseName, extension);
    let finalPath = path.join(this.saveDirectory, baseName);
    for (let suffix = 2; await exists(finalPath); suffix += 1) {
      finalPath = path.join(this.saveDirectory, `${stem}-${suffix}${extension}`);
    }

    const sessionId = randomUUID();
    const temporaryPath = `${finalPath}.part-${sessionId}`;
    const handle = await open(temporaryPath, 'wx');
    this.active = {
      sessionId,
      finalPath,
      temporaryPath,
      handle,
      bytesWritten: 0,
      queue: Promise.resolve(),
    };
    return { sessionId, outputPath: finalPath };
  }

  async append(sessionId: string, chunk: Uint8Array): Promise<void> {
    const active = this.requireActive(sessionId);
    if (chunk.byteLength === 0) {
      return;
    }
    if (chunk.byteLength > MAX_CHUNK_BYTES) {
      throw new Error('录制数据块超过安全上限');
    }
    const copy = Buffer.from(chunk);
    active.queue = active.queue.then(async () => {
      await active.handle.write(copy);
      active.bytesWritten += copy.byteLength;
    });
    await active.queue;
  }

  async finish(sessionId: string): Promise<string> {
    const active = this.requireActive(sessionId);
    try {
      await active.queue;
      await active.handle.sync();
      await active.handle.close();
      if (active.bytesWritten === 0) {
        await rm(active.temporaryPath, { force: true });
        throw new Error('录制没有产生有效视频数据');
      }
      await rename(active.temporaryPath, active.finalPath);
      return active.finalPath;
    } finally {
      this.active = undefined;
    }
  }

  async abort(sessionId?: string): Promise<void> {
    const active = this.active;
    if (!active || (sessionId && active.sessionId !== sessionId)) {
      return;
    }
    this.active = undefined;
    try {
      await active.queue.catch(() => undefined);
      await active.handle.close().catch(() => undefined);
    } finally {
      await rm(active.temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  private requireActive(sessionId: string): ActiveFile {
    if (!this.active || this.active.sessionId !== sessionId) {
      throw new Error('录制文件会话无效');
    }
    return this.active;
  }
}
