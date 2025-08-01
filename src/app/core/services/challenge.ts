// src/app/core/services/challenge.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  collectionData,
  Timestamp
} from '@angular/fire/firestore';

import { 
  Challenge, 
  ChallengeStatus, 
  ChallengeStep, 
  ChallengeAction, 
  ChallengeConfig, 
  ChallengeDate, 
  ChallengeHistoryItem,
  SystemConfig,
  ChallengeStats,
  GameResult
} from '../interfaces/challenge.interfaces';

import { FirebaseService, Couple, CoupleStats } from './firebase';

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private firestore = inject(Firestore);
  private firebaseService = inject(FirebaseService);
  
  private challengesCollection = 'challenges';
  private configCollection = 'system_config';
  
  // Configuração padrão
  private defaultConfig: ChallengeConfig = {
    responseTimeHours: 24,
    datesTimeHours: 24, 
    finalTimeHours: 24,
    requireWeekendDate: true,
    minProposedDates: 3
  };

  // ✅ CRIAR DESAFIO
  async createChallenge(challengerId: string, challengedId: string): Promise<string> {
    try {
      console.log('🎯 Iniciando criação de desafio:', { challengerId, challengedId });

      // Verificar se pode desafiar
      const canChallenge = await this.canChallengeCouple(challengerId, challengedId);
      if (!canChallenge.canChallenge) {
        throw new Error(canChallenge.reason);
      }

      // Buscar dados das duplas
      const couples = await this.getCouplesData([challengerId, challengedId]);
      const challenger = couples.find(c => c.id === challengerId);
      const challenged = couples.find(c => c.id === challengedId);

      if (!challenger || !challenged) {
        throw new Error('Duplas não encontradas');
      }

      console.log('👥 Duplas encontradas:', { challenger, challenged });

      // Buscar configuração
      const config = await this.getSystemConfig();
      
      const now = new Date();
      const responseDeadline = new Date(now.getTime() + (config.responseTimeHours * 60 * 60 * 1000));

      const challenge: Challenge = {
        challengerId,
        challengedId,
        challengerName: `${challenger.player1Name} / ${challenger.player2Name}`,
        challengedName: `${challenged.player1Name} / ${challenged.player2Name}`,
        status: ChallengeStatus.PENDING_RESPONSE,
        currentStep: ChallengeStep.INITIAL_RESPONSE,
        createdAt: now,
        responseDeadline,
        history: [{
          id: this.generateId(),
          action: ChallengeAction.CREATED,
          performedBy: challengerId,
          performedByName: `${challenger.player1Name} / ${challenger.player2Name}`,
          timestamp: now
        }],
        config
      };

      console.log('📋 Dados do desafio preparados:', challenge);

      const docRef = await addDoc(collection(this.firestore, this.challengesCollection), this.convertDatesToTimestamp(challenge));
      
      console.log('✅ Desafio criado com ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erro ao criar desafio:', error);
      throw error;
    }
  }

  // ✅ RESPONDER DESAFIO (Aceitar/Recusar)
  async respondToChallenge(challengeId: string, coupleId: string, accept: boolean): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');

      if (challenge.challengedId !== coupleId) {
        throw new Error('Apenas a dupla desafiada pode responder');
      }

      if (challenge.status !== ChallengeStatus.PENDING_RESPONSE) {
        throw new Error('Desafio não está aguardando resposta');
      }

      const now = new Date();
      
      // ✅ ATUALIZAR ESTATÍSTICAS
      await this.firebaseService.updateChallengeStats(challenge.challengedId, 'received');
      
      if (accept) {
        // ✅ ACEITAR: Atualizar stats
        await this.firebaseService.updateChallengeStats(challenge.challengedId, 'accepted');
        
        const datesDeadline = new Date(now.getTime() + (challenge.config.datesTimeHours * 60 * 60 * 1000));
        
        const updates = {
          status: ChallengeStatus.PENDING_DATES,
          currentStep: ChallengeStep.PROPOSE_DATES,
          datesDeadline,
          history: [
            ...challenge.history,
            {
              id: this.generateId(),
              action: ChallengeAction.ACCEPTED,
              performedBy: coupleId,
              performedByName: challenge.challengedName,
              timestamp: now
            }
          ]
        };

        await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
        
      } else {
        // ✅ RECUSAR: Atualizar stats + trocar posições
        await this.firebaseService.updateChallengeStats(challenge.challengedId, 'declined');
        
        console.log('❌ Desafio recusado - aplicando troca de posições');
        
        const updates = {
          status: ChallengeStatus.DECLINED,
          history: [
            ...challenge.history,
            {
              id: this.generateId(),
              action: ChallengeAction.DECLINED,
              performedBy: coupleId,
              performedByName: challenge.challengedName,
              timestamp: now
            }
          ]
        };

        await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
        
        // Aplicar troca de posições
        await this.swapRankingPositions(challenge.challengerId, challenge.challengedId);
      }

      console.log('✅ Resposta ao desafio processada');
      
    } catch (error) {
      console.error('❌ Erro ao responder desafio:', error);
      throw error;
    }
  }

  // ✅ PROPOR DATAS
  async proposeDates(challengeId: string, coupleId: string, dates: Date[]): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');

      if (challenge.challengedId !== coupleId) {
        throw new Error('Apenas a dupla desafiada pode propor datas');
      }

      if (challenge.status !== ChallengeStatus.PENDING_DATES) {
        throw new Error('Não é possível propor datas neste momento');
      }

      // Validar datas
      this.validateProposedDates(dates, challenge.config);

      const proposedDates: ChallengeDate[] = dates.map(date => ({
        id: this.generateId(),
        date,
        isWeekend: this.isWeekend(date),
        proposedBy: 'challenged'
      }));

      const now = new Date();
      const finalDeadline = new Date(now.getTime() + (challenge.config.finalTimeHours * 60 * 60 * 1000));

      const updates = {
        status: ChallengeStatus.PENDING_DATE_SELECTION,
        currentStep: ChallengeStep.SELECT_DATE,
        proposedDates,
        finalDeadline,
        history: [
          ...challenge.history,
          {
            id: this.generateId(),
            action: ChallengeAction.DATES_PROPOSED,
            performedBy: coupleId,
            performedByName: challenge.challengedName,
            timestamp: now,
            data: { datesCount: dates.length }
          }
        ]
      };

      await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
      console.log('✅ Datas propostas');
    } catch (error) {
      console.error('❌ Erro ao propor datas:', error);
      throw error;
    }
  }

  // ✅ SELECIONAR DATA
  async selectDate(challengeId: string, coupleId: string, dateId: string): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');

      if (challenge.challengerId !== coupleId) {
        throw new Error('Apenas a dupla desafiante pode selecionar a data');
      }

      if (challenge.status !== ChallengeStatus.PENDING_DATE_SELECTION) {
        throw new Error('Não é possível selecionar data neste momento');
      }

      const selectedDate = challenge.proposedDates?.find(d => d.id === dateId);
      if (!selectedDate) throw new Error('Data não encontrada');

      const now = new Date();
      const updates = {
        status: ChallengeStatus.SCHEDULED,
        selectedDate,
        history: [
          ...challenge.history,
          {
            id: this.generateId(),
            action: ChallengeAction.DATE_SELECTED,
            performedBy: coupleId,
            performedByName: challenge.challengerName,
            timestamp: now,
            data: { selectedDate: selectedDate.date }
          }
        ]
      };

      await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
      console.log('✅ Data selecionada');
    } catch (error) {
      console.error('❌ Erro ao selecionar data:', error);
      throw error;
    }
  }

  // ✅ FAZER CONTRAPROPOSTA
  async makeCounterProposal(challengeId: string, coupleId: string, counterDate: Date): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');

      if (challenge.challengerId !== coupleId) {
        throw new Error('Apenas a dupla desafiante pode fazer contraproposta');
      }

      const counterProposal: ChallengeDate = {
        id: this.generateId(),
        date: counterDate,
        isWeekend: this.isWeekend(counterDate),
        proposedBy: 'challenger'
      };

      const now = new Date();
      const finalDeadline = new Date(now.getTime() + (challenge.config.finalTimeHours * 60 * 60 * 1000));

      const updates = {
        status: ChallengeStatus.PENDING_COUNTER_RESPONSE,
        currentStep: ChallengeStep.FINAL_CONFIRMATION,
        counterProposalDate: counterProposal,
        finalDeadline,
        history: [
          ...challenge.history,
          {
            id: this.generateId(),
            action: ChallengeAction.COUNTER_PROPOSED,
            performedBy: coupleId,
            performedByName: challenge.challengerName,
            timestamp: now,
            data: { counterDate }
          }
        ]
      };

      await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
      console.log('✅ Contraproposta enviada');
    } catch (error) {
      console.error('❌ Erro ao fazer contraproposta:', error);
      throw error;
    }
  }

  // ✅ RESPONDER CONTRAPROPOSTA
  async respondToCounterProposal(challengeId: string, coupleId: string, accept: boolean): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');

      if (challenge.challengedId !== coupleId) {
        throw new Error('Apenas a dupla desafiada pode responder à contraproposta');
      }

      const now = new Date();
      
      if (accept) {
        const updates = {
          status: ChallengeStatus.SCHEDULED,
          selectedDate: challenge.counterProposalDate,
          history: [
            ...challenge.history,
            {
              id: this.generateId(),
              action: ChallengeAction.COUNTER_ACCEPTED,
              performedBy: coupleId,
              performedByName: challenge.challengedName,
              timestamp: now
            }
          ]
        };

        await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
      } else {
        await this.cancelChallenge(challengeId, coupleId, ChallengeAction.COUNTER_DECLINED);
      }

      console.log('✅ Resposta à contraproposta processada');
    } catch (error) {
      console.error('❌ Erro ao responder contraproposta:', error);
      throw error;
    }
  }

  // ✅ BUSCAR DESAFIOS DE UMA DUPLA
  getChallengesForCouple(coupleId: string): Observable<Challenge[]> {
    const challengesAsChallenger = query(
      collection(this.firestore, this.challengesCollection),
      where('challengerId', '==', coupleId),
      orderBy('createdAt', 'desc')
    );

    const challengesAsChallenged = query(
      collection(this.firestore, this.challengesCollection),
      where('challengedId', '==', coupleId),
      orderBy('createdAt', 'desc')
    );

    return combineLatest([
      collectionData(challengesAsChallenger, { idField: 'id' }),
      collectionData(challengesAsChallenged, { idField: 'id' })
    ]).pipe(
      map(([asChallenger, asChallenged]) => {
        const allChallenges = [...asChallenger, ...asChallenged];
        return allChallenges
          .map(c => this.convertTimestampsToDates(c))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }),
      catchError(error => {
        console.error('❌ Erro ao buscar desafios:', error);
        return of([]);
      })
    );
  }

  // ✅ VERIFICAR SE PODE DESAFIAR
  private async canChallengeCouple(challengerId: string, challengedId: string): Promise<{canChallenge: boolean, reason?: string}> {
    try {
      console.log('🔍 Verificando se pode desafiar:', { challengerId, challengedId });

      // Verificar se já existe desafio ativo entre as duplas
      const activeQuery = query(
        collection(this.firestore, this.challengesCollection),
        where('challengerId', '==', challengerId),
        where('challengedId', '==', challengedId)
      );

      const activeSnapshot = await getDocs(activeQuery);
      
      // Filtrar apenas desafios realmente ativos
      const activeChallenges = activeSnapshot.docs.filter(doc => {
        const status = doc.data()['status'];
        return [
          ChallengeStatus.PENDING_RESPONSE,
          ChallengeStatus.PENDING_DATES,
          ChallengeStatus.PENDING_DATE_SELECTION,
          ChallengeStatus.PENDING_COUNTER_RESPONSE,
          ChallengeStatus.SCHEDULED
        ].includes(status);
      });

      if (activeChallenges.length > 0) {
        console.log('❌ Já existe desafio ativo');
        return { canChallenge: false, reason: 'Já existe um desafio ativo entre essas duplas' };
      }

      console.log('✅ Pode desafiar - nenhum desafio ativo encontrado');
      return { canChallenge: true };
      
    } catch (error) {
      console.error('❌ Erro ao verificar se pode desafiar:', error);
      // Em caso de erro, permitir o desafio (para não bloquear desnecessariamente)
      return { canChallenge: true };
    }
  }

  // ✅ MÉTODOS AUXILIARES
  private async getChallengeById(id: string): Promise<Challenge | null> {
    try {
      const docSnap = await getDoc(doc(this.firestore, this.challengesCollection, id));
      if (docSnap.exists()) {
        return this.convertTimestampsToDates({ id: docSnap.id, ...docSnap.data() });
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar desafio:', error);
      return null;
    }
  }

  private async getCouplesData(coupleIds: string[]): Promise<Couple[]> {
    try {
      const couples: Couple[] = [];
      
      for (const coupleId of coupleIds) {
        const docSnap = await getDoc(doc(this.firestore, 'couples', coupleId));
        if (docSnap.exists()) {
          const coupleData = docSnap.data();
          
          // ✅ CRIAR STATS PADRÃO SE NÃO EXISTIR
          const defaultStats: CoupleStats = {
            totalGames: 0,
            victories: 0,
            defeats: 0,
            winRate: 0,
            challengesSent: 0,
            challengesReceived: 0,
            challengesAccepted: 0,
            challengesDeclined: 0,
            currentStreak: 0,
            bestStreak: 0
          };
          
          couples.push({
            id: docSnap.id,
            player1Name: coupleData['player1Name'],
            player2Name: coupleData['player2Name'],
            responsiblePhone: coupleData['responsiblePhone'],
            createdAt: coupleData['createdAt']?.toDate ? coupleData['createdAt'].toDate() : coupleData['createdAt'],
            position: coupleData['position'] || 0,
            stats: coupleData['stats'] || defaultStats // ✅ STATS OBRIGATÓRIO
          });
        }
      }
      
      return couples;
    } catch (error) {
      console.error('❌ Erro ao buscar dados das duplas:', error);
      return [];
    }
  }

  private async getSystemConfig(): Promise<ChallengeConfig> {
    try {
      const docSnap = await getDoc(doc(this.firestore, this.configCollection, 'challenge_config'));
      if (docSnap.exists()) {
        const config = docSnap.data() as SystemConfig;
        return config.challengeConfig;
      }
      return this.defaultConfig;
    } catch (error) {
      console.error('❌ Erro ao buscar configuração:', error);
      return this.defaultConfig;
    }
  }

  private validateProposedDates(dates: Date[], config: ChallengeConfig): void {
    if (dates.length < config.minProposedDates) {
      throw new Error(`É necessário propor pelo menos ${config.minProposedDates} datas`);
    }

    if (config.requireWeekendDate) {
      const hasWeekend = dates.some(date => this.isWeekend(date));
      if (!hasWeekend) {
        throw new Error('Pelo menos uma data deve ser no final de semana');
      }
    }

    // Verificar se todas as datas são futuras
    const now = new Date();
    const invalidDates = dates.filter(date => date <= now);
    if (invalidDates.length > 0) {
      throw new Error('Todas as datas devem ser futuras');
    }
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Domingo ou Sábado
  }

  private async validateRankingChallenge(challengerId: string, challengedId: string): Promise<{valid: boolean, reason?: string}> {
    try {
      // Buscar duplas por posição
      const challengerDoc = await getDoc(doc(this.firestore, 'couples', challengerId));
      const challengedDoc = await getDoc(doc(this.firestore, 'couples', challengedId));
      
      if (!challengerDoc.exists() || !challengedDoc.exists()) {
        return { valid: false, reason: 'Duplas não encontradas no ranking' };
      }
      
      const challengerPosition = challengerDoc.data()['position'] || 0;
      const challengedPosition = challengedDoc.data()['position'] || 0;
      
      // Pode desafiar até 2 posições acima
      const maxChallengePosition = Math.max(1, challengerPosition - 2);
      
      if (challengedPosition < maxChallengePosition) {
        return { 
          valid: false, 
          reason: `Você só pode desafiar duplas até 2 posições acima (posição ${maxChallengePosition} ou abaixo)` 
        };
      }
      
      if (challengedPosition >= challengerPosition) {
        return { 
          valid: false, 
          reason: 'Você só pode desafiar duplas que estão acima de você no ranking' 
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      console.error('❌ Erro ao validar ranking:', error);
      return { valid: false, reason: 'Erro ao validar posições no ranking' };
    }
  }

  private async swapRankingPositions(challengerId: string, challengedId: string): Promise<void> {
    try {
      console.log('🔄 Iniciando troca de posições:', { challengerId, challengedId });
      
      // ✅ ATUALIZAR ESTATÍSTICAS DE DESAFIO
      await Promise.all([
        // Desafiante: enviou desafio
        this.firebaseService.updateChallengeStats(challengerId, 'sent'),
        // Desafiado: recebeu e recusou
        this.firebaseService.updateChallengeStats(challengedId, 'received'),
        this.firebaseService.updateChallengeStats(challengedId, 'declined')
      ]);
      
      // Usar o método do FirebaseService
      await this.firebaseService.swapPositions(challengerId, challengedId);
      
      console.log('✅ Troca de posições concluída!');
      
    } catch (error) {
      console.error('❌ Erro ao trocar posições:', error);
      throw error;
    }
  }

  private async declineChallenge(challengeId: string, coupleId: string): Promise<void> {
    const updates = {
      status: ChallengeStatus.DECLINED,
      history: [
        {
          id: this.generateId(),
          action: ChallengeAction.DECLINED,
          performedBy: coupleId,
          timestamp: new Date()
        }
      ]
    };

    await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
  }

  private async cancelChallenge(challengeId: string, coupleId: string, action: ChallengeAction): Promise<void> {
    const updates = {
      status: ChallengeStatus.CANCELLED,
      history: [
        {
          id: this.generateId(),
          action,
          performedBy: coupleId,
          timestamp: new Date()
        }
      ]
    };

    await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // ✅ ATUALIZAR O MÉTODO convertDatesToTimestamp PARA REMOVER UNDEFINED
  private convertDatesToTimestamp(obj: any): any {
    // Primeiro remover campos undefined
    const cleanObj = this.removeUndefinedFields(obj);
    
    // Depois converter datas
    const converted = { ...cleanObj };
    
    // Converter datas específicas para Timestamp
    const dateFields = ['createdAt', 'responseDeadline', 'datesDeadline', 'finalDeadline'];
    dateFields.forEach(field => {
      if (converted[field] instanceof Date) {
        converted[field] = Timestamp.fromDate(converted[field]);
      }
    });

    // Converter datas em arrays aninhados
    if (converted.proposedDates) {
      converted.proposedDates = converted.proposedDates.map((pd: any) => ({
        ...pd,
        date: pd.date instanceof Date ? Timestamp.fromDate(pd.date) : pd.date
      }));
    }

    if (converted.selectedDate?.date instanceof Date) {
      converted.selectedDate.date = Timestamp.fromDate(converted.selectedDate.date);
    }

    if (converted.counterProposalDate?.date instanceof Date) {
      converted.counterProposalDate.date = Timestamp.fromDate(converted.counterProposalDate.date);
    }

    // ✅ CONVERTER DATAS NO GAMERESULT
    if (converted.gameResult) {
      if (converted.gameResult.reportedAt instanceof Date) {
        converted.gameResult.reportedAt = Timestamp.fromDate(converted.gameResult.reportedAt);
      }
      if (converted.gameResult.confirmedAt instanceof Date) {
        converted.gameResult.confirmedAt = Timestamp.fromDate(converted.gameResult.confirmedAt);
      }
    }

    if (converted.history) {
      converted.history = converted.history.map((h: any) => ({
        ...h,
        timestamp: h.timestamp instanceof Date ? Timestamp.fromDate(h.timestamp) : h.timestamp
      }));
    }

    return converted;
  }


  private convertTimestampsToDates(obj: any): any {
    const converted = { ...obj };
    
    // Converter Timestamps específicos para Date
    const dateFields = ['createdAt', 'responseDeadline', 'datesDeadline', 'finalDeadline'];
    dateFields.forEach(field => {
      if (converted[field]?.toDate) {
        converted[field] = converted[field].toDate();
      }
    });

    // Converter datas em arrays aninhados
    if (converted.proposedDates) {
      converted.proposedDates = converted.proposedDates.map((pd: any) => ({
        ...pd,
        date: pd.date?.toDate ? pd.date.toDate() : pd.date
      }));
    }

    if (converted.selectedDate?.date?.toDate) {
      converted.selectedDate.date = converted.selectedDate.date.toDate();
    }

    if (converted.counterProposalDate?.date?.toDate) {
      converted.counterProposalDate.date = converted.counterProposalDate.date.toDate();
    }

    if (converted.history) {
      converted.history = converted.history.map((h: any) => ({
        ...h,
        timestamp: h.timestamp?.toDate ? h.timestamp.toDate() : h.timestamp
      }));
    }

    return converted;
  }

  // ✅ MÉTODO: Verificar se é hora do jogo
  private isGameTime(challenge: Challenge): boolean {
    if (!challenge.selectedDate) {
      console.log('⚠️ Desafio sem data selecionada:', challenge.id);
      return false;
    }
    
    const now = new Date();
    const gameTime = challenge.selectedDate.date;
    
    console.log('🕐 Comparando horários:', {
      now: now.toISOString(),
      gameTime: gameTime.toISOString(),
      isTime: now >= gameTime
    });
    
    return now >= gameTime;
  }

  // ✅ MÉTODO: Atualizar status para GAME_TIME
  async updateGameTimeStatus(challengeId: string): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');
      
      if (challenge.status !== ChallengeStatus.SCHEDULED) {
        console.log('⚠️ Desafio não está agendado:', challengeId);
        return;
      }
      
      if (!this.isGameTime(challenge)) {
        console.log('⚠️ Ainda não é hora do jogo:', challengeId);
        return;
      }
      
      const now = new Date();
      const updates = {
        status: ChallengeStatus.GAME_TIME,
        history: [
          ...challenge.history,
          {
            id: this.generateId(),
            action: ChallengeAction.GAME_TIME_REACHED,
            performedBy: 'system',
            performedByName: 'Sistema',
            timestamp: now
          }
        ]
      };
      
      await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
      
      console.log('✅ Status atualizado para GAME_TIME:', challengeId);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar status do jogo:', error);
    }
  }

  // ✅ MÉTODO: Lançar resultado do jogo
  async reportGameResult(
    challengeId: string, 
    reporterId: string, 
    winnerId: string, 
    score?: string, 
    notes?: string
  ): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');
      
      // Verificar se é hora de lançar resultado
      if (challenge.status !== ChallengeStatus.GAME_TIME && challenge.status !== ChallengeStatus.PENDING_RESULT) {
        throw new Error('Ainda não é possível lançar o resultado');
      }
      
      // Verificar se quem está lançando é uma das duplas
      if (reporterId !== challenge.challengerId && reporterId !== challenge.challengedId) {
        throw new Error('Apenas as duplas participantes podem lançar o resultado');
      }
      
      // Determinar vencedor e perdedor
      const isWinnerChallenger = winnerId === challenge.challengerId;
      const loserId = isWinnerChallenger ? challenge.challengedId : challenge.challengerId;
      const winnerName = isWinnerChallenger ? challenge.challengerName : challenge.challengedName;
      const loserName = isWinnerChallenger ? challenge.challengedName : challenge.challengerName;
      
      // Buscar nome de quem está reportando
      const reporterName = reporterId === challenge.challengerId ? challenge.challengerName : challenge.challengedName;
      
      const now = new Date();
      
      // ✅ CRIAR OBJETO SEM UNDEFINED - APENAS CAMPOS DEFINIDOS
      const gameResult: any = {
        winnerId,
        winnerName,
        loserId,
        loserName,
        reportedBy: reporterId,
        reportedByName: reporterName,
        reportedAt: now,
        confirmed: false
      };
      
      // ✅ ADICIONAR CAMPOS OPCIONAIS APENAS SE TIVEREM VALOR
      if (score && score.trim() !== '') {
        gameResult.score = score.trim();
      }
      
      if (notes && notes.trim() !== '') {
        gameResult.notes = notes.trim();
      }
      
      console.log('📊 GameResult preparado:', gameResult);
      
      const historyItem: any = {
        id: this.generateId(),
        action: ChallengeAction.RESULT_REPORTED,
        performedBy: reporterId,
        performedByName: reporterName,
        timestamp: now,
        data: {
          winnerId,
          winnerName
        }
      };
      
      // ✅ ADICIONAR SCORE NO HISTÓRICO APENAS SE EXISTIR
      if (score && score.trim() !== '') {
        historyItem.data.score = score.trim();
      }
      
      const updates = {
        status: ChallengeStatus.PENDING_CONFIRMATION,
        gameResult,
        history: [
          ...challenge.history,
          historyItem
        ]
      };
      
      console.log('📝 Updates preparados:', updates);
      
      await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
      
      console.log('✅ Resultado lançado com sucesso:', challengeId);
      
    } catch (error) {
      console.error('❌ Erro ao lançar resultado:', error);
      throw error;
    }
  }

  // ✅ MÉTODO AUXILIAR: Remover campos undefined de um objeto
  private removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Recursivamente limpar objetos aninhados
          const cleanedNested = this.removeUndefinedFields(value);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key] = cleanedNested;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  // ✅ MÉTODO: Confirmar resultado
  async confirmGameResult(challengeId: string, confirmerId: string, agree: boolean): Promise<void> {
    try {
      const challenge = await this.getChallengeById(challengeId);
      if (!challenge) throw new Error('Desafio não encontrado');
      
      if (challenge.status !== ChallengeStatus.PENDING_CONFIRMATION) {
        throw new Error('Resultado não está aguardando confirmação');
      }
      
      if (!challenge.gameResult) {
        throw new Error('Nenhum resultado foi lançado');
      }
      
      // Verificar se quem está confirmando é a outra dupla (não quem lançou)
      if (confirmerId === challenge.gameResult.reportedBy) {
        throw new Error('Você não pode confirmar seu próprio resultado');
      }
      
      if (confirmerId !== challenge.challengerId && confirmerId !== challenge.challengedId) {
        throw new Error('Apenas as duplas participantes podem confirmar o resultado');
      }
      
      const confirmerName = confirmerId === challenge.challengerId ? challenge.challengerName : challenge.challengedName;
      const now = new Date();
      
      if (agree) {
        // ✅ CONFIRMAR RESULTADO - CRIAR OBJETO SEM UNDEFINED
        const updatedGameResult: any = {
          ...challenge.gameResult,
          confirmed: true,
          confirmedBy: confirmerId,
          confirmedAt: now
        };
        
        // ✅ REMOVER CAMPOS UNDEFINED DO GAME RESULT
        const cleanGameResult = this.removeUndefinedFields(updatedGameResult);
        
        const updates = {
          status: ChallengeStatus.COMPLETED,
          gameResult: cleanGameResult,
          history: [
            ...challenge.history,
            {
              id: this.generateId(),
              action: ChallengeAction.RESULT_CONFIRMED,
              performedBy: confirmerId,
              performedByName: confirmerName,
              timestamp: now
            }
          ]
        };
        
        await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
        
        // ✅ APLICAR MUDANÇAS NO RANKING BASEADO NO RESULTADO
        await this.applyRankingChanges(challenge.gameResult.winnerId, challenge.gameResult.loserId);
        
        console.log('✅ Resultado confirmado e ranking atualizado');
        
      } else {
        // ❌ CONTESTAR RESULTADO
        const updates = {
          status: ChallengeStatus.DISPUTED_RESULT,
          history: [
            ...challenge.history,
            {
              id: this.generateId(),
              action: ChallengeAction.RESULT_DISPUTED,
              performedBy: confirmerId,
              performedByName: confirmerName,
              timestamp: now
            }
          ]
        };
        
        await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), this.convertDatesToTimestamp(updates));
        
        console.log('⚠️ Resultado contestado - requer intervenção manual');
      }
      
    } catch (error) {
      console.error('❌ Erro ao confirmar resultado:', error);
      throw error;
    }
  }

  // ✅ MÉTODO: Aplicar mudanças no ranking
  private async applyRankingChanges(winnerId: string, loserId: string): Promise<void> {
    try {
      console.log('🏆 Aplicando mudanças no ranking:', { winnerId, loserId });
      
      // Buscar posições atuais
      const winnerDoc = await getDoc(doc(this.firestore, 'couples', winnerId));
      const loserDoc = await getDoc(doc(this.firestore, 'couples', loserId));
      
      if (!winnerDoc.exists() || !loserDoc.exists()) {
        throw new Error('Duplas não encontradas');
      }
      
      const winnerPosition = winnerDoc.data()['position'] || 0;
      const loserPosition = loserDoc.data()['position'] || 0;
      
      // ✅ ATUALIZAR ESTATÍSTICAS DE AMBAS AS DUPLAS
      const gameDate = new Date();
      await Promise.all([
        this.firebaseService.updateCoupleStats(winnerId, true, gameDate),
        this.firebaseService.updateCoupleStats(loserId, false, gameDate)
      ]);
      
      // Se o vencedor tinha posição pior (número maior), ele assume a posição do perdedor
      if (winnerPosition > loserPosition) {
        console.log('🔄 Vencedor estava abaixo - aplicando troca de posições');
        await this.firebaseService.swapPositions(winnerId, loserId);
      } else {
        console.log('📊 Vencedor já estava acima - ranking mantido');
      }
      
    } catch (error) {
      console.error('❌ Erro ao aplicar mudanças no ranking:', error);
      throw error;
    }
  }

  // ✅ MÉTODO: Verificar jogos que estão na hora
  async checkGameTimes(): Promise<void> {
    try {
      console.log('🕐 Verificando horários dos jogos...');
      
      const q = query(
        collection(this.firestore, this.challengesCollection),
        where('status', '==', ChallengeStatus.SCHEDULED)
      );
      
      const snapshot = await getDocs(q);
      console.log(`📋 Encontrados ${snapshot.docs.length} jogos agendados`);
      
      for (const docSnap of snapshot.docs) {
        const challenge = { id: docSnap.id, ...this.convertTimestampsToDates(docSnap.data()) } as Challenge;
        
        if (this.isGameTime(challenge)) {
          console.log('⏰ Atualizando status para GAME_TIME:', challenge.id);
          await this.updateGameTimeStatus(docSnap.id);
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar horários dos jogos:', error);
    }
  }

}