// src/app/core/services/challenge-scheduler.service.ts
import { Injectable, inject } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  Timestamp 
} from '@angular/fire/firestore';

import { 
  Challenge, 
  ChallengeStatus, 
  ChallengeAction 
} from '../interfaces/challenge.interfaces';

import { ChallengeService } from './challenge';

@Injectable({
  providedIn: 'root'
})
export class ChallengeSchedulerService {
  private firestore = inject(Firestore);
  private challengesCollection = 'challenges';
  private schedulerSubscription?: Subscription;

  constructor() {
    this.startScheduler();
  }

  // ✅ VERIFICAR DESAFIOS EXPIRADOS
  private async checkExpiredChallenges(): Promise<void> {
    try {
      const now = new Date();
      const nowTimestamp = Timestamp.fromDate(now);

      // Buscar desafios com status que podem expirar
      const expirableStatuses = [
        ChallengeStatus.PENDING_RESPONSE,
        ChallengeStatus.PENDING_DATES,
        ChallengeStatus.PENDING_DATE_SELECTION,
        ChallengeStatus.PENDING_COUNTER_RESPONSE
      ];

      const q = query(
        collection(this.firestore, this.challengesCollection),
        where('status', 'in', expirableStatuses)
      );

      const snapshot = await getDocs(q);
      
      for (const docSnap of snapshot.docs) {
        const challenge = { id: docSnap.id, ...docSnap.data() } as Challenge;
        
        if (this.isChallengeExpired(challenge, now)) {
          await this.expireChallenge(docSnap.id, challenge);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao verificar desafios expirados:', error);
    }
  }

  // ✅ VERIFICAR SE UM DESAFIO EXPIROU
  private isChallengeExpired(challenge: any, now: Date): boolean {
    let deadline: Date | null = null;

    switch (challenge.status) {
      case ChallengeStatus.PENDING_RESPONSE:
        deadline = challenge.responseDeadline?.toDate ? challenge.responseDeadline.toDate() : challenge.responseDeadline;
        break;
      case ChallengeStatus.PENDING_DATES:
        deadline = challenge.datesDeadline?.toDate ? challenge.datesDeadline.toDate() : challenge.datesDeadline;
        break;
      case ChallengeStatus.PENDING_DATE_SELECTION:
      case ChallengeStatus.PENDING_COUNTER_RESPONSE:
        deadline = challenge.finalDeadline?.toDate ? challenge.finalDeadline.toDate() : challenge.finalDeadline;
        break;
    }

    return deadline ? now > deadline : false;
  }

  // ✅ MARCAR DESAFIO COMO EXPIRADO
  private async expireChallenge(challengeId: string, challenge: any): Promise<void> {
    try {
      const now = new Date();
      
      // Determinar se deve trocar posições
      let shouldSwapPositions = false;
      
      if (challenge.status === ChallengeStatus.PENDING_RESPONSE) {
        // ✅ Se não respondeu no prazo, desafiante assume posição
        shouldSwapPositions = true;
      }

      const updates = {
        status: ChallengeStatus.EXPIRED,
        history: [
          ...challenge.history,
          {
            id: this.generateId(),
            action: ChallengeAction.EXPIRED,
            performedBy: 'system',
            performedByName: 'Sistema',
            timestamp: Timestamp.fromDate(now)
          }
        ]
      };

      await updateDoc(doc(this.firestore, this.challengesCollection, challengeId), updates);

      // ✅ Se necessário, trocar posições no ranking
      if (shouldSwapPositions) {
        console.log('⏰ Desafio expirado - aplicando troca de posições');
        
        // Importar e usar o ChallengeService
        const challengeService = inject(ChallengeService);
        await challengeService['swapRankingPositions'](challenge.challengerId, challenge.challengedId);
      }

      console.log('⏰ Desafio expirado:', challengeId);

    } catch (error) {
      console.error('❌ Erro ao expirar desafio:', error);
    }
  }

  // ✅ VERIFICAÇÃO MANUAL DE EXPIRAÇÃO
  async checkSpecificChallenge(challengeId: string): Promise<boolean> {
    try {
      const docSnap = await getDocs(query(
        collection(this.firestore, this.challengesCollection),
        where('__name__', '==', challengeId)
      ));

      if (!docSnap.empty) {
        const challenge = { id: docSnap.docs[0].id, ...docSnap.docs[0].data() };
        const now = new Date();
        
        if (this.isChallengeExpired(challenge, now)) {
          await this.expireChallenge(challengeId, challenge);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erro ao verificar desafio específico:', error);
      return false;
    }
  }

  // ✅ PARAR O AGENDADOR
  stopScheduler(): void {
    if (this.schedulerSubscription) {
      this.schedulerSubscription.unsubscribe();
    }
  }

  // ✅ MÉTODOS AUXILIARES
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // ✅ CONFIGURAR INTERVALO PERSONALIZADO (para testes)
  setCustomInterval(minutes: number): void {
    this.stopScheduler();
    this.schedulerSubscription = interval(minutes * 60 * 1000).subscribe(() => {
      this.checkExpiredChallenges();
    });
  }

  // ✅ OBTER STATUS DO AGENDADOR
  isSchedulerRunning(): boolean {
    return !!this.schedulerSubscription && !this.schedulerSubscription.closed;
  }

  // ✅ ADICIONAR VERIFICAÇÃO DE HORÁRIOS DE JOGOS
  private async checkGameTimes(): Promise<void> {
    try {
      const challengeService = inject(ChallengeService);
      await challengeService['checkGameTimes']();
    } catch (error) {
      console.error('❌ Erro ao verificar horários dos jogos no scheduler:', error);
    }
  }

  // ✅ ATUALIZAR O MÉTODO startScheduler para incluir verificação de jogos
  private startScheduler(): void {
  // Verificar a cada 1 minuto (ao invés de 5 minutos)
  this.schedulerSubscription = interval(60 * 1000).subscribe(() => {
    this.checkExpiredChallenges();
    this.checkScheduledGames();
  });

  // Verificar imediatamente ao iniciar
  this.checkExpiredChallenges();
  this.checkScheduledGames();
  
  console.log('⏰ Scheduler iniciado - verificação a cada 1 minuto');
}

// ✅ NOVO MÉTODO
private async checkScheduledGames(): Promise<void> {
  try {
    console.log('🔍 Scheduler verificando jogos agendados...');
    
    // Importar ChallengeService dinamicamente
    const challengeService = inject(ChallengeService);
    await challengeService.checkGameTimes();
    
  } catch (error) {
    console.error('❌ Erro no scheduler ao verificar jogos:', error);
  }
}


}