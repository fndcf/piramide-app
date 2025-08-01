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
  ChallengeStats
} from '../interfaces/challenge.interfaces';

import { FirebaseService, Couple } from './firebase';

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
      
      if (accept) {
        // Aceitar desafio
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
        // Recusar desafio - desafiante assume posição
        await this.declineChallenge(challengeId, coupleId);
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
          couples.push({
            id: docSnap.id,
            player1Name: coupleData['player1Name'],
            player2Name: coupleData['player2Name'],
            responsiblePhone: coupleData['responsiblePhone'],
            createdAt: coupleData['createdAt']?.toDate ? coupleData['createdAt'].toDate() : coupleData['createdAt'],
            position: coupleData['position'] || 0,
            points: coupleData['points'] || 0
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
      // Buscar todas as duplas para calcular ranking
      const q = query(
        collection(this.firestore, 'couples'),
        orderBy('points', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const couples = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        position: index + 1,
        ...doc.data()
      }));
      
      const challenger = couples.find(c => c.id === challengerId);
      const challenged = couples.find(c => c.id === challengedId);
      
      if (!challenger || !challenged) {
        return { valid: false, reason: 'Duplas não encontradas no ranking' };
      }
      
      // Pode desafiar até 2 posições acima
      const maxChallengePosition = Math.max(1, challenger.position - 2);
      
      if (challenged.position < maxChallengePosition) {
        return { 
          valid: false, 
          reason: `Você só pode desafiar duplas até 2 posições acima (posição ${maxChallengePosition} ou abaixo)` 
        };
      }
      
      if (challenged.position >= challenger.position) {
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
      // Buscar dados das duplas
      const challengerDoc = await getDoc(doc(this.firestore, 'couples', challengerId));
      const challengedDoc = await getDoc(doc(this.firestore, 'couples', challengedId));
      
      if (!challengerDoc.exists() || !challengedDoc.exists()) {
        throw new Error('Duplas não encontradas');
      }
      
      const challengerData = challengerDoc.data();
      const challengedData = challengedDoc.data();
      
      const challengerPoints = challengerData['points'] || 0;
      const challengedPoints = challengedData['points'] || 0;
      
      // Trocar pontuações (desafiante assume posição do desafiado)
      await updateDoc(doc(this.firestore, 'couples', challengerId), {
        points: challengedPoints
      });
      
      await updateDoc(doc(this.firestore, 'couples', challengedId), {
        points: challengerPoints
      });
      
      console.log('🔄 Posições trocadas no ranking:', {
        challenger: `${challengerId} agora tem ${challengedPoints} pontos`,
        challenged: `${challengedId} agora tem ${challengerPoints} pontos`
      });
      
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

  private convertDatesToTimestamp(obj: any): any {
    const converted = { ...obj };
    
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
}