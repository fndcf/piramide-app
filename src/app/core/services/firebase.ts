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
  position?: number;
  points?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  // ✅ USAR inject() para resolver contexto de injeção
  private firestore = inject(Firestore);
  
  private couplesCollection = 'couples';

  // ✅ BUSCAR DUPLA POR TELEFONE (Para login de jogador)
  async getUserByPhone(phone: string): Promise<any> {
    try {
      console.log('🔍 Buscando telefone no Firestore:', phone); // Debug
      
      const q = query(
        collection(this.firestore, this.couplesCollection),
        where('responsiblePhone', '==', phone),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        console.log('✅ Telefone encontrado:', data); // Debug
        return { id: querySnapshot.docs[0].id, ...data };
      }
      
      console.log('❌ Telefone não encontrado'); // Debug
      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário por telefone:', error);
      return null;
    }
  }

  // ✅ ADICIONAR DUPLA
  async addCouple(couple: Couple): Promise<any> {
    try {
      const coupleData = {
        ...couple,
        createdAt: new Date(),
        points: 0,
        position: 0
      };
      
      console.log('📝 Adicionando dupla:', coupleData); // Debug
      
      const colRef = collection(this.firestore, this.couplesCollection);
      const docRef = await addDoc(colRef, coupleData);
      
      console.log('✅ Dupla adicionada com ID:', docRef.id); // Debug
      return docRef;
    } catch (error) {
      console.error('❌ Erro ao adicionar dupla:', error);
      throw error;
    }
  }

  // ✅ LISTAR TODAS AS DUPLAS
  getCouples(): Observable<Couple[]> {
    try {
      const q = query(
        collection(this.firestore, this.couplesCollection),
        orderBy('points', 'desc')
      );
      
      return collectionData(q, { idField: 'id' }).pipe(
        map((docs: any[]) => {
          console.log('📋 Duplas carregadas:', docs.length); // Debug
          return docs.map(doc => ({
            id: doc.id,
            player1Name: doc.player1Name,
            player2Name: doc.player2Name,
            responsiblePhone: doc.responsiblePhone,
            createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : doc.createdAt,
            position: doc.position || 0,
            points: doc.points || 0
          } as Couple));
        }),
        catchError(error => {
          console.error('❌ Erro ao carregar duplas:', error);
          return of([]); // Retorna array vazio em caso de erro
        })
      );
    } catch (error) {
      console.error('❌ Erro ao configurar query de duplas:', error);
      return of([]);
    }
  }

  // ✅ ATUALIZAR DUPLA
  async updateCouple(id: string, data: Partial<Couple>): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.couplesCollection, id);
      await updateDoc(docRef, data);
      console.log('✅ Dupla atualizada:', id); // Debug
    } catch (error) {
      console.error('❌ Erro ao atualizar dupla:', error);
      throw error;
    }
  }

  // ✅ EXCLUIR DUPLA
  async deleteCouple(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.couplesCollection, id);
      await deleteDoc(docRef);
      console.log('✅ Dupla excluída:', id); // Debug
    } catch (error) {
      console.error('❌ Erro ao excluir dupla:', error);
      throw error;
    }
  }

  // ✅ BUSCAR DUPLA POR TELEFONE (Para dashboard do jogador)
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
            const doc = docs[0];
            return {
              id: doc.id,
              player1Name: doc.player1Name,
              player2Name: doc.player2Name,
              responsiblePhone: doc.responsiblePhone,
              createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : doc.createdAt,
              position: doc.position || 0,
              points: doc.points || 0
            } as Couple;
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
}