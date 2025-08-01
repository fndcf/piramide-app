// src/app/core/interfaces/challenge.interfaces.ts
export interface Challenge {
  id?: string;
  challengerId: string;
  challengedId: string;
  challengerName: string;
  challengedName: string;
  
  status: ChallengeStatus;
  currentStep: ChallengeStep;
  
  // Prazos e datas
  createdAt: Date;
  responseDeadline: Date;
  datesDeadline?: Date;
  finalDeadline?: Date;
  
  // Datas propostas
  proposedDates?: ChallengeDate[];
  selectedDate?: ChallengeDate;
  counterProposalDate?: ChallengeDate;
  
  // ✅ NOVO: Resultado do jogo
  gameResult?: GameResult;
  
  // Histórico de ações
  history: ChallengeHistoryItem[];
  
  // Configurações
  config: ChallengeConfig;
}

// ✅ NOVA INTERFACE: Resultado do jogo
export interface GameResult {
  winnerId: string; // ID da dupla vencedora
  winnerName: string; // Nome da dupla vencedora
  loserId: string; // ID da dupla perdedora
  loserName: string; // Nome da dupla perdedora
  score?: string; // Placar opcional (ex: "21-15, 18-21, 21-19")
  reportedBy: string; // ID de quem lançou o resultado
  reportedByName: string; // Nome de quem lançou
  reportedAt: Date; // Quando foi lançado
  confirmed: boolean; // Se o resultado foi confirmado pela outra dupla
  confirmedBy?: string; // ID de quem confirmou
  confirmedAt?: Date; // Quando foi confirmado
  notes?: string; // Observações opcionais
}

// ✅ NOVOS STATUS
export enum ChallengeStatus {
  PENDING_RESPONSE = 'pending_response',
  PENDING_DATES = 'pending_dates',
  PENDING_DATE_SELECTION = 'pending_date_selection',
  PENDING_COUNTER_RESPONSE = 'pending_counter_response',
  SCHEDULED = 'scheduled',
  GAME_TIME = 'game_time', // ✅ NOVO: Jogo pode acontecer (após horário)
  PENDING_RESULT = 'pending_result', // ✅ NOVO: Aguardando lançamento do resultado
  PENDING_CONFIRMATION = 'pending_confirmation', // ✅ NOVO: Aguardando confirmação do resultado
  DISPUTED_RESULT = 'disputed_result', // ✅ NOVO: Resultado em disputa
  EXPIRED = 'expired',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

export interface ChallengeDate {
  id: string;
  date: Date;
  isWeekend: boolean;
  proposedBy: 'challenger' | 'challenged';
  description?: string;
}

export interface ChallengeHistoryItem {
  id: string;
  action: ChallengeAction;
  performedBy: string; // ID da dupla
  performedByName: string; // Nome da dupla
  timestamp: Date;
  data?: any; // Dados específicos da ação
}

export interface ChallengeConfig {
  responseTimeHours: number; // Tempo para aceitar/recusar (padrão: 24h)
  datesTimeHours: number; // Tempo para enviar datas (padrão: 24h)
  finalTimeHours: number; // Tempo para etapas finais (padrão: 24h)
  requireWeekendDate: boolean; // Exigir pelo menos uma data no fim de semana
  minProposedDates: number; // Mínimo de datas a propor (padrão: 3)
}

export enum ChallengeStep {
  INITIAL_RESPONSE = 'initial_response', // Aceitar/Recusar desafio
  PROPOSE_DATES = 'propose_dates', // Enviar 3 datas
  SELECT_DATE = 'select_date', // Escolher uma das datas
  COUNTER_PROPOSAL = 'counter_proposal', // Contraproposta de data
  FINAL_CONFIRMATION = 'final_confirmation' // Confirmação final
}

export enum ChallengeAction {
  CREATED = 'created',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  DATES_PROPOSED = 'dates_proposed',
  DATE_SELECTED = 'date_selected',
  DATE_DECLINED = 'date_declined',
  COUNTER_PROPOSED = 'counter_proposed',
  COUNTER_ACCEPTED = 'counter_accepted',
  COUNTER_DECLINED = 'counter_declined',
  GAME_TIME_REACHED = 'game_time_reached', // ✅ NOVO
  RESULT_REPORTED = 'result_reported', // ✅ NOVO
  RESULT_CONFIRMED = 'result_confirmed', // ✅ NOVO
  RESULT_DISPUTED = 'result_disputed', // ✅ NOVO
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

// Interface para configurações globais do sistema
export interface SystemConfig {
  challengeConfig: ChallengeConfig;
  updatedAt: Date;
  updatedBy: string;
}

// Interface para estatísticas de desafios
export interface ChallengeStats {
  coupleId: string;
  totalChallengesSent: number;
  totalChallengesReceived: number;
  challengesWon: number;
  challengesLost: number;
  acceptanceRate: number; // % de desafios aceitos quando desafiado
  successRate: number; // % de desafios bem-sucedidos quando desafiou
  lastChallengeDate?: Date;
}