import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type RegistrationFile = {
  version: 1;
  projects: Array<{ path: string; registeredAt: string }>;
};

const MAX_PROJECTS = 200;

export class ProjectRegistrationStore {
  constructor(
    private readonly filePath: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async read(): Promise<RegistrationFile> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<RegistrationFile>;
      const projects = Array.isArray(parsed.projects)
        ? parsed.projects
            .filter(
              (entry): entry is { path: string; registeredAt: string } =>
                typeof entry?.path === 'string' &&
                path.isAbsolute(entry.path) &&
                typeof entry.registeredAt === 'string',
            )
            .slice(0, MAX_PROJECTS)
        : [];
      return { version: 1, projects };
    } catch {
      return { version: 1, projects: [] };
    }
  }

  async load(): Promise<string[]> {
    const registrations = await this.read();
    return [...new Set(registrations.projects.map((entry) => path.normalize(entry.path)))];
  }

  async add(projectPath: string): Promise<void> {
    if (!path.isAbsolute(projectPath)) throw new Error('登记项目必须使用绝对路径');
    const normalized = path.normalize(projectPath);
    const registrations = await this.read();
    const projects = registrations.projects.filter(
      (entry) => path.normalize(entry.path) !== normalized,
    );
    projects.unshift({ path: normalized, registeredAt: this.now().toISOString() });
    const next: RegistrationFile = { version: 1, projects: projects.slice(0, MAX_PROJECTS) };

    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}
