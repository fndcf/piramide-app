// src/app/core/services/firebase.service.ts (CORRIGIDO - Tipagem)
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  private couplesCollection = 'couples';
  private usersCollection = 'users';

  constructor(private firestore: Firestore) {}

  // ✅ CORRIGIDO - Tipagem
  async getUserData(uid: string): Promise<any> {
    try {
      const docRef = doc(this.firestore, this.usersCollection, uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }

  async getUserByPhone(phone: string): Promise<any> {
    try {
      const q = query(
        collection(this.firestore, this.couplesCollection),
        where('responsiblePhone', '==', phone)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        return { id: querySnapshot.docs[0].id, ...data };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário por telefone:', error);
      return null;
    }
  }

  async addCouple(couple: Couple): Promise<any> {
    const coupleData = {
      ...couple,
      createdAt: new Date(),
      points: 0,
      position: 0
    };
    const colRef = collection(this.firestore, this.couplesCollection);
    return addDoc(colRef, coupleData);
  }

  // ✅ CORRIGIDO - Tipagem explícita
  getCouples(): Observable<Couple[]> {
    const q = query(
      collection(this.firestore, this.couplesCollection),
      orderBy('points', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) => {
        return docs.map(doc => ({
          id: doc.id,
          player1Name: doc.player1Name,
          player2Name: doc.player2Name,
          responsiblePhone: doc.responsiblePhone,
          createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : doc.createdAt,
          position: doc.position || 0,
          points: doc.points || 0
        } as Couple));
      })
    );
  }

  async updateCouple(id: string, data: Partial<Couple>): Promise<void> {
    const docRef = doc(this.firestore, this.couplesCollection, id);
    return updateDoc(docRef, data);
  }

  async deleteCouple(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.couplesCollection, id);
    return deleteDoc(docRef);
  }

  // ✅ CORRIGIDO - Tipagem explícita
  getCoupleByPhone(phone: string): Observable<Couple | null> {
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
      })
    );
  }

  // ✅ MÉTODO PARA SALVAR DADOS DO USUÁRIO
  async saveUserData(uid: string, userData: any): Promise<void> {
    try {
      const docRef = doc(this.firestore, this.usersCollection, uid);
      await updateDoc(docRef, userData).catch(async () => {
        // Se documento não existe, criar
        await addDoc(collection(this.firestore, this.usersCollection), {
          uid,
          ...userData
        });
      });
    } catch (error) {
      console.error('Erro ao salvar dados do usuário:', error);
    }
  }

}