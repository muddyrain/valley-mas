export type DebateMode = 'serious' | 'funny' | 'sharp' | 'wild' | 'workplace' | 'emotion';

export type DebateStatus = 'created' | 'running' | 'done' | 'failed';

export interface Persona {
  id: string;
  name: string;
  stance: string;
  personality: string;
  style: string;
  catchphrase: string;
  avatar?: string;
  color?: string;
}

export interface DebateMessage {
  id: string;
  round: number;
  roundTitle: string;
  personaId: string;
  personaName: string;
  content: string;
  createdAt: string;
}

export interface DebateScore {
  persona: string;
  score: number;
}

export interface DebateResult {
  winner: string;
  finalAdvice: string;
  quote: string;
  scores: DebateScore[];
}

export interface DebateSession {
  id: string;
  topic: string;
  mode: DebateMode;
  status: DebateStatus;
  personas: Persona[];
  messages: DebateMessage[];
  result?: DebateResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebateRequest {
  topic: string;
  mode: DebateMode;
  personaCount: number;
}

export interface CreateDebateResponse {
  sessionId: string;
  topic: string;
  mode: DebateMode;
  status: DebateStatus;
  personas: Persona[];
}

export interface DebateSSEEvent {
  type: 'message' | 'judge' | 'done' | 'error';
  round?: number;
  roundTitle?: string;
  personaId?: string;
  personaName?: string;
  content?: string;
  result?: DebateResult;
  sessionId?: string;
  message?: string;
}
