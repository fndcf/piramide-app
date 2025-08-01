// src/app/core/services/auth.service.ts (SIMPLIFICADO - Sem operações extras)
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { 
  Auth, 
  signInWithEmailAndPassword, 
  signOut, 
  authState, 
  User as FirebaseUser 
} from '@angular/fire/auth';
import { FirebaseService } from './firebase';

export interface User {
  uid: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'player';
  displayName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // ✅ USAR inject() para resolver contexto
  private auth = inject(Auth);
  private router = inject(Router);
  private firebaseService = inject(FirebaseService);
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.initAuthListener();
  }

  private initAuthListener(): void {
    authState(this.auth).subscribe(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // ✅ SIMPLES: Apenas criar user objeto sem buscar no Firestore
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          phone: firebaseUser.phoneNumber || undefined,
          role: 'admin', // ✅ Se está autenticado no Firebase Auth, é admin
          displayName: firebaseUser.displayName || firebaseUser.email || 'Admin'
        };
        
        console.log('🔍 Usuário Firebase autenticado:', user); // Debug
        this.currentUserSubject.next(user);
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  // ✅ LOGIN ADMIN - Simples, sem salvar dados extras
  async loginWithEmail(email: string, password: string): Promise<void> {
    try {
      console.log('🔐 Tentando login admin com:', email); // Debug
      
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      
      console.log('✅ Login admin bem-sucedido!'); // Debug
      // ✅ O authState listener já vai atualizar o currentUser
      this.router.navigate(['/admin']);
    } catch (error) {
      console.error('❌ Erro no login admin:', error); // Debug
      throw this.handleError(error);
    }
  }

  // ✅ LOGIN PLAYER - Verifica se telefone existe na coleção couples
  async loginWithPhone(phoneNumber: string): Promise<void> {
    try {
      console.log('📱 Tentando login player com:', phoneNumber);
      
      // ✅ USAR O MÉTODO CORRETO (sem await, retorna Observable)
      const couple$ = this.firebaseService.getCoupleByPhone(phoneNumber);
      
      const couple = await new Promise<any>((resolve, reject) => {
        const subscription = couple$.subscribe({
          next: (result) => {
            subscription.unsubscribe();
            resolve(result);
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error);
          }
        });
      });
      
      if (couple) {
        // ✅ SIMULAR LOGIN PLAYER (sem Firebase Auth)
        const playerUser: User = {
          uid: `player_${phoneNumber}`,
          phone: phoneNumber,
          role: 'player',
          displayName: `${couple.player1Name} / ${couple.player2Name}`
        };
        
        console.log('✅ Login player bem-sucedido:', playerUser);
        
        this.currentUserSubject.next(playerUser);
        this.router.navigate(['/player']);
      } else {
        console.log('❌ Telefone não cadastrado:', phoneNumber);
        throw new Error('Telefone não encontrado no sistema. Verifique se a dupla foi cadastrada pelo administrador.');
      }
    } catch (error) {
      console.error('❌ Erro no login player:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('🚪 Fazendo logout...'); // Debug
      
      // Se é usuário do Firebase Auth, fazer signOut
      if (this.auth.currentUser) {
        await signOut(this.auth);
      }
      
      this.currentUserSubject.next(null);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      // ✅ Mesmo com erro, limpar estado local
      this.currentUserSubject.next(null);
      this.router.navigate(['/']);
    }
  }

  isAuthenticated(): Observable<boolean> {
    return this.currentUser$.pipe(map(user => !!user));
  }

  isAdmin(): Observable<boolean> {
    return this.currentUser$.pipe(map(user => {
      const isAdmin = user?.role === 'admin';
      console.log('🛡️ Verificando se é admin:', isAdmin, user); // Debug
      return isAdmin;
    }));
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleError(error: any): string {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Usuário não encontrado';
      case 'auth/wrong-password':
        return 'Senha incorreta';
      case 'auth/invalid-email':
        return 'Email inválido';
      case 'auth/user-disabled':
        return 'Usuário desativado';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Tente novamente mais tarde.';
      case 'auth/invalid-credential':
        return 'Credenciais inválidas';
      default:
        return error.message || 'Erro de autenticação';
    }
  }
}