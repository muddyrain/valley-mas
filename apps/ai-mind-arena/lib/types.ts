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
  personaId?: string;
  score: number;
  judgeScore?: number;
  audienceScore?: number;
  judgeNote?: string;
}

export interface DebateResult {
  winner: string;
  finalAdvice: string;
  quote: string;
  scores?: DebateScore[] | null;
}

export interface RoundSupportChoice {
  round: number;
  personaId?: string;
  personaName?: string;
  skipped: boolean;
  supportScore?: number;
  createdAt: string;
}

export interface NeutralJudgeState {
  name: string;
  currentRound: number;
  focus: string;
  summary: string;
  leadingPersona?: string;
  updatedAt: string;
}

export interface DebateSession {
  id: string;
  topic: string;
  mode: DebateMode;
  status: DebateStatus;
  personaCount?: number | null;
  currentRound?: number | null;
  lastCompletedRound?: number | null;
  awaitingSupport?: boolean;
  awaitingSupportRound?: number | null;
  personas?: Persona[] | null;
  messages?: DebateMessage[] | null;
  liveScores?: DebateScore[] | null;
  neutralJudge?: NeutralJudgeState;
  overtimePersonaIds?: string[] | null;
  supportHistory?: RoundSupportChoice[] | null;
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
  personaCount?: number | null;
  currentRound?: number | null;
  personas?: Persona[] | null;
}

export interface SubmitRoundSupportRequest {
  round: number;
  supportedPersonaId?: string;
  skip?: boolean;
}

export interface DebateSSEEvent {
  type: 'personas' | 'message' | 'judge' | 'done' | 'error' | 'support_prompt';
  round?: number;
  roundTitle?: string;
  personaCount?: number;
  personaId?: string;
  personaName?: string;
  content?: string;
  result?: DebateResult;
  sessionId?: string;
  message?: string;
  scores?: DebateScore[] | null;
  personas?: Persona[] | null;
  neutralJudge?: NeutralJudgeState;
  overtimePersonaIds?: string[] | null;
  currentRound?: number;
  awaitingSupport?: boolean;
  awaitingSupportRound?: number;
  supportHistory?: RoundSupportChoice[] | null;
}
