// src/app/core/services/debug-challenge.service.ts
import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc,
  Timestamp
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class DebugChallengeService {
  private firestore = inject(Firestore);

  // ✅ TESTE SIMPLES DE CRIAÇÃO
  async createSimpleChallenge(challengerId: string, challengedId: string): Promise<string> {
    try {
      console.log('🧪 Teste simples de criação de desafio');

      const now = new Date();
      const simpleChallenge = {
        challengerId,
        challengedId,
        challengerName: 'Teste Challenger',
        challengedName: 'Teste Challenged',
        status: 'pending_response',
        createdAt: Timestamp.fromDate(now),
        responseDeadline: Timestamp.fromDate(new Date(now.getTime() + (24 * 60 * 60 * 1000))),
        history: [{
          id: 'test_' + Date.now(),
          action: 'created',
          performedBy: challengerId,
          performedByName: 'Teste',
          timestamp: Timestamp.fromDate(now)
        }],
        config: {
          responseTimeHours: 24,
          datesTimeHours: 24,
          finalTimeHours: 24,
          requireWeekendDate: true,
          minProposedDates: 3
        }
      };

      const docRef = await addDoc(collection(this.firestore, 'challenges'), simpleChallenge);
      
      console.log('✅ Desafio teste criado:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      throw error;
    }
  }
}