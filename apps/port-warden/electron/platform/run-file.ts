import { spawn } from 'node:child_process';

type RunFileOptions = {
  allowExitCodes?: number[];
  maxOutputBytes?: number;
};

export async function runFile(
  executable: string,
  args: readonly string[],
  options: RunFileOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const maxOutputBytes = options.maxOutputBytes ?? 16 * 1024 * 1024;
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;

    const collect = (chunks: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        reject(new Error(`${executable} 输出超过安全限制`));
        return;
      }
      chunks.push(chunk);
    };

    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const exitCode = code ?? -1;
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        code: exitCode,
      };
      if (exitCode === 0 || options.allowExitCodes?.includes(exitCode)) resolve(result);
      else reject(new Error(`${executable} 执行失败 (${exitCode}): ${result.stderr.trim()}`));
    });
  });
}
