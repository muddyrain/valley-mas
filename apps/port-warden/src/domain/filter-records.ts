import type { PortProcessRecord } from '../shared/domain';

export function filterRecords(records: PortProcessRecord[], query: string): PortProcessRecord[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return records;

  return records.filter((record) => {
    const searchable = [
      record.port,
      record.process.pid,
      record.process.name,
      record.process.commandLine,
      record.process.executablePath,
      record.process.workingDirectory,
      record.project.path,
      ...record.addresses.map(({ address }) => address),
    ];
    return searchable.some((value) =>
      String(value ?? '')
        .toLocaleLowerCase()
        .includes(normalized),
    );
  });
}
