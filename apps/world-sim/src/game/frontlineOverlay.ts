export type FrontlineSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  leadingFactionId: string;
  contestedStrength: number;
};

export type FrontlineCell = {
  x: number;
  y: number;
  leadingFactionId: string;
  contestedStrength: number;
  pushDirection: 'east' | 'west' | 'south' | 'north';
};

export function buildFrontlineSegments(cells: FrontlineCell[]): FrontlineSegment[] {
  return cells.map((cell) => buildFrontlineSegment(cell));
}

function buildFrontlineSegment(cell: FrontlineCell): FrontlineSegment {
  switch (cell.pushDirection) {
    case 'east':
    case 'west':
      return {
        x1: cell.x + 1,
        y1: cell.y,
        x2: cell.x + 1,
        y2: cell.y + 1,
        leadingFactionId: cell.leadingFactionId,
        contestedStrength: cell.contestedStrength,
      };
    case 'south':
    case 'north':
      return {
        x1: cell.x,
        y1: cell.y + 1,
        x2: cell.x + 1,
        y2: cell.y + 1,
        leadingFactionId: cell.leadingFactionId,
        contestedStrength: cell.contestedStrength,
      };
    default:
      return assertNever(cell.pushDirection);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled frontline direction: ${value}`);
}
