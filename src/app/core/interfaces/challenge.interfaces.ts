// src/app/core/interfaces/challenge.interfaces.ts
export interface Challenge {
  id?: string;
  challengerId: string; // ID da dupla que desafiou
  challengedId: string; // ID da dupla desafiada
  challengerName: string; // Nome da dupla que desafiou
  challengedName: string; // Nome da dupla desafiada
  
  status: ChallengeStatus;
  currentStep: ChallengeStep;
  
  // Prazos e datas
  createdAt: Date;
  responseDeadline: Date; // Prazo para aceitar/recusar
  datesDeadline?: Date; // Prazo para enviar datas
  finalDeadline?: Date; // Prazo para escolher data final
  
  // Datas propostas
  proposedDates?: ChallengeDate[];
  selectedDate?: ChallengeDate;
  counterProposalDate?: ChallengeDate;
  
  // Histórico de ações
  history: ChallengeHistoryItem[];
  
  // Configurações (vindas dos parâmetros)
  config: ChallengeConfig;
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

export enum ChallengeStatus {
  PENDING_RESPONSE = 'pending_response', // Aguardando aceitar/recusar
  PENDING_DATES = 'pending_dates', // Aguardando envio de datas
  PENDING_DATE_SELECTION = 'pending_date_selection', // Aguardando escolha da data
  PENDING_COUNTER_RESPONSE = 'pending_counter_response', // Aguardando resposta à contraproposta
  SCHEDULED = 'scheduled', // Agendado - data confirmada
  EXPIRED = 'expired', // Prazo expirado
  DECLINED = 'declined', // Recusado
  CANCELLED = 'cancelled', // Cancelado
  COMPLETED = 'completed' // Jogo realizado
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