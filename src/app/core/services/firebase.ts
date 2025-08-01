// src/app/core/services/firebase.service.ts (SIMPLIFICADO - Foco apenas em couples)
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// ✅ NOVA API FIREBASE MODULAR
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
  DocumentData
} from '@angular/fire/firestore';

export interface Couple {
  id?: string;
  player1Name: string;
  player2Name: string;
  responsiblePhone: string;
  createdAt: Date;
  position: number;
  stats: CoupleStats;
}

// ✅ NOVA INTERFACE: Estatísticas da dupla
export interface CoupleStats {
  totalGames: number;
  victories: number;
  defeats: number;
  winRate: number;
  challengesSent: number;
  challengesReceived: number;
  challengesAccepted: number;
  challengesDeclined: number;
  currentStreak: number;
  bestStreak: number;
  lastGameDate?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private firestore = inject(Firestore);
  private couplesCollection = 'couples';

  // ✅ ADICIONAR DUPLA COM ESTATÍSTICAS INICIAIS
  async addCouple(couple: Omit<Couple, 'id' | 'position' | 'stats'>): Promise<any> {
    try {
      // Buscar próxima posição
      const nextPosition = await this.getNextPosition();
      
      // Stats iniciais
      const initialStats: CoupleStats = {
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
      
      const coupleData: Couple = {
        ...couple,
        createdAt: new Date(),
        position: nextPosition,
        stats: initialStats
      };
      
      console.log('📝 Adicionando dupla na posição:', nextPosition);
      
      const colRef = collection(this.firestore, this.couplesCollection);
      const docRef = await addDoc(colRef, coupleData);
      
      console.log('✅ Dupla adicionada:', docRef.id);
      return docRef;
    } catch (error) {
      console.error('❌ Erro ao adicionar dupla:', error);
      throw error;
    }
  }

  // ✅ LISTAR DUPLAS ORDENADAS POR POSIÇÃO (SEM PONTOS)
  getCouples(): Observable<Couple[]> {
    try {
      const q = query(
        collection(this.firestore, this.couplesCollection),
        orderBy('position', 'asc') // ✅ APENAS POR POSIÇÃO
      );
      
      return collectionData(q, { idField: 'id' }).pipe(
        map((docs: any[]) => {
          console.log('📋 Duplas carregadas:', docs.length);
          return docs.map(doc => this.mapDocumentToCouple(doc));
        }),
        catchError(error => {
          console.error('❌ Erro ao carregar duplas:', error);
          return of([]);
        })
      );
    } catch (error) {
      console.error('❌ Erro ao configurar query de duplas:', error);
      return of([]);
    }
  }

  // ✅ BUSCAR DUPLA POR TELEFONE (SEM PONTOS)
  getCoupleByPhone(phone: string): Observable<Couple | null> {
    try {
      const q = query(
        collection(this.firestore, this.couplesCollection),
        where('responsiblePhone', '==', phone),
        limit(1)
      );
      
      return collectionData(q, { idField: 'id' }).pipe(
        map((docs: any[]) => {
          if (docs.length > 0) {
            return this.mapDocumentToCouple(docs[0]);
          }
          return null;
        }),
        catchError(error => {
          console.error('❌ Erro ao buscar dupla por telefone:', error);
          return of(null);
        })
      );
    } catch (error) {
      console.error('❌ Erro ao configurar query por telefone:', error);
      return of(null);
    }
  }

  // ✅ NOVO MÉTODO: Atualizar estatísticas após jogo
  async updateCoupleStats(coupleId: string, won: boolean, gameDate: Date): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.couplesCollection, coupleId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Dupla não encontrada');
      }
      
      const couple = this.mapDocumentToCouple({ id: docSnap.id, ...docSnap.data() });
      const currentStats = couple.stats;
      
      // ✅ CALCULAR NOVAS ESTATÍSTICAS
      const newStats: CoupleStats = {
        ...currentStats,
        totalGames: currentStats.totalGames + 1,
        victories: currentStats.victories + (won ? 1 : 0),
        defeats: currentStats.defeats + (won ? 0 : 1),
        lastGameDate: gameDate
      };
      
      // Calcular taxa de vitória
      newStats.winRate = newStats.totalGames > 0 ? 
        Math.round((newStats.victories / newStats.totalGames) * 100) : 0;
      
      // Calcular sequência atual
      if (won) {
        newStats.currentStreak = currentStats.currentStreak >= 0 ? 
          currentStats.currentStreak + 1 : 1;
        newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
      } else {
        newStats.currentStreak = currentStats.currentStreak <= 0 ? 
          currentStats.currentStreak - 1 : -1;
      }
      
      await updateDoc(docRef, { stats: newStats });
      
      console.log(`📊 Estatísticas atualizadas para ${coupleId}:`, newStats);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar estatísticas:', error);
      throw error;
    }
  }

  // ✅ NOVO MÉTODO: Atualizar estatísticas de desafio
  async updateChallengeStats(coupleId: string, action: 'sent' | 'received' | 'accepted' | 'declined'): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.couplesCollection, coupleId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return;
      
      const couple = this.mapDocumentToCouple({ id: docSnap.id, ...docSnap.data() });
      const currentStats = couple.stats;
      
      const updates: Partial<CoupleStats> = {};
      
      switch (action) {
        case 'sent':
          updates.challengesSent = currentStats.challengesSent + 1;
          break;
        case 'received':
          updates.challengesReceived = currentStats.challengesReceived + 1;
          break;
        case 'accepted':
          updates.challengesAccepted = currentStats.challengesAccepted + 1;
          break;
        case 'declined':
          updates.challengesDeclined = currentStats.challengesDeclined + 1;
          break;
      }
      
      await updateDoc(docRef, { 
        [`stats.${Object.keys(updates)[0]}`]: Object.values(updates)[0]
      });
      
    } catch (error) {
      console.error('❌ Erro ao atualizar estatísticas de desafio:', error);
    }
  }

  // ✅ MÉTODO ATUALIZADO: Aplicar reorganização por vitória em jogo (mesma lógica)
  async swapPositions(winnerId: string, loserId: string): Promise<void> {
    try {
      console.log('🏆 Aplicando reorganização após vitória em jogo:', { winnerId, loserId });
      
      // Buscar dados das duas duplas
      const winnerRef = doc(this.firestore, this.couplesCollection, winnerId);
      const loserRef = doc(this.firestore, this.couplesCollection, loserId);
      
      const [winnerSnap, loserSnap] = await Promise.all([
        getDoc(winnerRef),
        getDoc(loserRef)
      ]);
      
      if (!winnerSnap.exists() || !loserSnap.exists()) {
        throw new Error('Uma ou ambas as duplas não foram encontradas');
      }
      
      const winnerPosition = winnerSnap.data()['position'];
      const loserPosition = loserSnap.data()['position'];
      
      console.log(`📍 Posições atuais - Vencedor: ${winnerPosition}º, Perdedor: ${loserPosition}º`);
      
      // Apenas reorganizar se o vencedor estava em posição pior (número maior)
      if (winnerPosition > loserPosition) {
        console.log('🔄 Vencedor estava abaixo - aplicando reorganização');
        
        // ✅ MESMA LÓGICA: Vencedor assume posição do perdedor, perdedor desce apenas 1 posição
        const newWinnerPosition = loserPosition; // Vencedor assume posição do perdedor
        const newLoserPosition = loserPosition + 1; // Perdedor desce apenas 1 posição
        
        // Buscar todas as duplas para reorganizar
        const allCouplesQuery = query(
          collection(this.firestore, this.couplesCollection),
          orderBy('position', 'asc')
        );
        
        const snapshot = await getDocs(allCouplesQuery);
        const updatePromises: Promise<void>[] = [];
        
        snapshot.docs.forEach(docSnap => {
          const docId = docSnap.id;
          const currentPosition = docSnap.data()['position'];
          
          if (docId === winnerId) {
            // Vencedor assume posição do perdedor
            console.log(`🏆 Vencedor ${winnerId}: ${winnerPosition}º → ${newWinnerPosition}º`);
            updatePromises.push(
              updateDoc(docSnap.ref, { position: newWinnerPosition })
            );
          } else if (docId === loserId) {
            // Perdedor desce apenas 1 posição
            console.log(`🥈 Perdedor ${loserId}: ${loserPosition}º → ${newLoserPosition}º`);
            updatePromises.push(
              updateDoc(docSnap.ref, { position: newLoserPosition })
            );
          } else if (currentPosition >= newLoserPosition && currentPosition < winnerPosition) {
            // Duplas entre a nova posição do perdedor e a posição original do vencedor descem 1 posição
            const newPosition = currentPosition + 1;
            console.log(`⬇️ Dupla ${docId}: ${currentPosition}º → ${newPosition}º (efeito cascata)`);
            updatePromises.push(
              updateDoc(docSnap.ref, { position: newPosition })
            );
          }
          // Duplas acima da posição do perdedor original não são afetadas
        });
        
        await Promise.all(updatePromises);
        
        console.log('✅ Reorganização por vitória concluída!');
        console.log(`📊 Resultado: Vencedor assumiu ${newWinnerPosition}º lugar, Perdedor desceu para ${newLoserPosition}º lugar`);
        
      } else {
        console.log('📊 Vencedor já estava em posição superior - ranking mantido');
      }
      
    } catch (error) {
      console.error('❌ Erro ao aplicar reorganização por vitória:', error);
      throw error;
    }
  }

  // ✅ MÉTODOS AUXILIARES MANTIDOS
  private async getNextPosition(): Promise<number> {
    try {
      const q = query(
        collection(this.firestore, this.couplesCollection),
        orderBy('position', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return 1; // Primeira dupla = 1º lugar
      }
      
      const lastPosition = snapshot.docs[0].data()['position'] || 0;
      return lastPosition + 1; // Próxima posição
    } catch (error) {
      console.error('❌ Erro ao calcular posição:', error);
      return 1;
    }
  }

  // ✅ MAPEAR DOCUMENTO PARA COUPLE (LIMPO)
  private mapDocumentToCouple(doc: any): Couple {
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

    return {
      id: doc.id,
      player1Name: doc.player1Name,
      player2Name: doc.player2Name,
      responsiblePhone: doc.responsiblePhone,
      createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : doc.createdAt,
      position: doc.position || 1,
      stats: doc.stats || defaultStats
    };
  }

  // ✅ EXCLUIR DUPLA E REORGANIZAR POSIÇÕES
  async deleteCouple(id: string): Promise<void> {
    try {
      // 1. Buscar posição da dupla a ser excluída
      const docRef = doc(this.firestore, this.couplesCollection, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Dupla não encontrada');
      }
      
      const deletedPosition = docSnap.data()['position'];
      
      // 2. Excluir a dupla
      await deleteDoc(docRef);
      
      // 3. Reorganizar posições (todas que estavam abaixo sobem uma posição)
      await this.reorganizePositionsAfterDeletion(deletedPosition);
      
      console.log('✅ Dupla excluída e posições reorganizadas:', id);
    } catch (error) {
      console.error('❌ Erro ao excluir dupla:', error);
      throw error;
    }
  }

  private async reorganizePositionsAfterDeletion(deletedPosition: number): Promise<void> {
    try {
      // Buscar todas as duplas com posição maior que a excluída
      const q = query(
        collection(this.firestore, this.couplesCollection),
        where('position', '>', deletedPosition)
      );
      
      const snapshot = await getDocs(q);
      
      // Atualizar posições (diminuir 1 de cada)
      const updatePromises = snapshot.docs.map(doc => {
        const currentPosition = doc.data()['position'];
        const newPosition = currentPosition - 1;
        
        return updateDoc(doc.ref, { position: newPosition });
      });
      
      await Promise.all(updatePromises);
      
      console.log(`✅ ${updatePromises.length} posições reorganizadas após exclusão`);
    } catch (error) {
      console.error('❌ Erro ao reorganizar posições:', error);
    }
  }

  // ✅ MÉTODO CORRETO: Reorganização por recusa de desafio
  async applyChallengeRefusalReorganization(challengerId: string, challengedId: string): Promise<void> {
    try {
      console.log('🔄 Aplicando reorganização CORRETA por recusa/expiração:', { challengerId, challengedId });
      
      // Buscar posições atuais
      const challengerRef = doc(this.firestore, this.couplesCollection, challengerId);
      const challengedRef = doc(this.firestore, this.couplesCollection, challengedId);
      
      const [challengerSnap, challengedSnap] = await Promise.all([
        getDoc(challengerRef),
        getDoc(challengedRef)
      ]);
      
      if (!challengerSnap.exists() || !challengedSnap.exists()) {
        throw new Error('Uma ou ambas as duplas não foram encontradas');
      }
      
      const challengerPosition = challengerSnap.data()['position']; // Ex: 4º lugar
      const challengedPosition = challengedSnap.data()['position']; // Ex: 2º lugar
      
      console.log(`📍 Posições atuais - Desafiante: ${challengerPosition}º, Desafiado: ${challengedPosition}º`);
      
      // ✅ LÓGICA CORRETA:
      // Desafiante (4º) → assume posição do desafiado (2º)
      // Desafiado (2º) → desce apenas 1 posição (3º) como punição
      // Quem estava no 3º → desce para 4º (efeito cascata)
      
      // Buscar todas as duplas para reorganizar
      const allCouplesQuery = query(
        collection(this.firestore, this.couplesCollection),
        orderBy('position', 'asc')
      );
      
      const snapshot = await getDocs(allCouplesQuery);
      const updatePromises: Promise<void>[] = [];
      
      const newChallengerPosition = challengedPosition; // Desafiante vai para posição do desafiado (2º)
      const newChallengedPosition = challengedPosition + 1; // Desafiado desce apenas 1 posição (3º)
      
      snapshot.docs.forEach(docSnap => {
        const docId = docSnap.id;
        const currentPosition = docSnap.data()['position'];
        
        if (docId === challengerId) {
          // Desafiante assume posição do desafiado
          console.log(`🟢 Desafiante ${challengerId}: ${challengerPosition}º → ${newChallengerPosition}º`);
          updatePromises.push(
            updateDoc(docSnap.ref, { position: newChallengerPosition })
          );
        } else if (docId === challengedId) {
          // Desafiado desce apenas 1 posição como punição
          console.log(`🔴 Desafiado ${challengedId}: ${challengedPosition}º → ${newChallengedPosition}º`);
          updatePromises.push(
            updateDoc(docSnap.ref, { position: newChallengedPosition })
          );
        } else if (currentPosition >= newChallengedPosition && currentPosition < challengerPosition) {
          // Duplas entre a nova posição do desafiado e a posição original do desafiante descem 1 posição
          const newPosition = currentPosition + 1;
          console.log(`⬇️ Dupla ${docId}: ${currentPosition}º → ${newPosition}º (efeito cascata)`);
          updatePromises.push(
            updateDoc(docSnap.ref, { position: newPosition })
          );
        }
        // Duplas acima da posição do desafiado original não são afetadas
      });
      
      await Promise.all(updatePromises);
      
      console.log('✅ Reorganização CORRETA concluída!');
      console.log(`📊 Resultado: Desafiante assumiu ${newChallengerPosition}º lugar, Desafiado desceu para ${newChallengedPosition}º lugar`);
      
    } catch (error) {
      console.error('❌ Erro ao aplicar reorganização por recusa:', error);
      throw error;
    }
  }  

}