import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

const years = Number(process.env.EON_SOAK_YEARS ?? 2_000);
const selectedSeeds = process.env.EON_SOAK_SEEDS
  ?.split(',')
  .map((seed) => seed.trim())
  .filter(Boolean);
const seedCount = selectedSeeds?.length ?? Number(process.env.EON_SOAK_SEED_COUNT ?? 10);
const concurrency = Math.max(
  1,
  Math.min(
    seedCount,
    Number(process.env.EON_SOAK_CONCURRENCY ?? Math.min(4, availableParallelism())),
  ),
);
const seeds = selectedSeeds ?? Array.from({ length: seedCount }, (_, index) => `eon-soak-${index}`);
const results = [];
let cursor = 0;

function runSeed(seed) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        'src/simulation/core/longWorldSoak.test.ts',
        '--reporter=verbose',
        '--maxWorkers=1',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          EON_LONG_SOAK: '1',
          EON_SOAK_YEARS: String(years),
          EON_SOAK_SEED: seed,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      const match = output.match(/EON_SOAK_RESULT (\{.+\})/);
      if (code !== 0 || !match?.[1]) {
        reject(new Error(`${seed} soak 失败\n${output}`));
        return;
      }
      const result = JSON.parse(match[1]);
      process.stdout.write(
        `${seed}: ${result.humans} 人 / ${result.animals} 动物 / ${result.entitySlots} 槽位\n`,
      );
      resolve(result);
    });
  });
}

async function worker() {
  while (cursor < seeds.length) {
    const seed = seeds[cursor];
    cursor += 1;
    if (!seed) return;
    results.push(await runSeed(seed));
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
results.sort((first, second) => first.seed.localeCompare(second.seed));
const survivors = results.filter((result) => result.humans > 0);
const extinct = results.filter((result) => result.humans === 0);
const requiredSurvivors = Math.ceil(seedCount * 0.8);
process.stdout.write(
  `EON_SOAK_SUMMARY ${JSON.stringify({ years, seedCount, survivors: survivors.length, extinct })}\n`,
);
if (survivors.length < requiredSurvivors) {
  throw new Error(
    `长局存活门禁失败：${survivors.length}/${seedCount}，要求至少 ${requiredSurvivors}/${seedCount}`,
  );
}
