// 1. src/app/core/services/auth.service.ts (CORRIGIDO)
import { Injectable } from '@angular/core';
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
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private auth: Auth,
    private router: Router,
    private firebaseService: FirebaseService
  ) {
    this.initAuthListener();
  }

  private initAuthListener(): void {
    authState(this.auth).subscribe(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // ✅ BUSCAR DADOS DO USUÁRIO NO FIRESTORE
        const userData = await this.firebaseService.getUserData(firebaseUser.uid);
        
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          phone: firebaseUser.phoneNumber || undefined,
          // ✅ IMPORTANTE: Se tem userData, usar role de lá, senão assumir que é admin (login por email)
          role: userData?.role || (firebaseUser.email ? 'admin' : 'player'),
          displayName: firebaseUser.displayName || userData?.name || firebaseUser.email
        };
        
        console.log('🔍 Usuário autenticado:', user); // Debug
        this.currentUserSubject.next(user);
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  // ✅ LOGIN ADMIN - Sempre define role como admin
  async loginWithEmail(email: string, password: string): Promise<void> {
    try {
      console.log('🔐 Tentando login admin com:', email); // Debug
      
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      
      // ✅ GARANTIR QUE É ADMIN
      const adminUser: User = {
        uid: credential.user.uid,
        email: credential.user.email!,
        role: 'admin', // ✅ FORÇAR ROLE ADMIN
        displayName: credential.user.displayName || credential.user.email!
      };
      
      console.log('✅ Login admin bem-sucedido:', adminUser); // Debug
      
      // Salvar dados do admin no Firestore (opcional)
      await this.firebaseService.saveUserData(credential.user.uid, {
        email: credential.user.email,
        role: 'admin',
        name: credential.user.displayName || credential.user.email,
        lastLogin: new Date()
      });
      
      this.currentUserSubject.next(adminUser);
      this.router.navigate(['/admin']);
    } catch (error) {
      console.error('❌ Erro no login admin:', error); // Debug
      throw this.handleError(error);
    }
  }

  // ✅ LOGIN PLAYER - Verifica se telefone existe na coleção couples
  async loginWithPhone(phoneNumber: string): Promise<void> {
    try {
      console.log('📱 Tentando login player com:', phoneNumber); // Debug
      
      const couple = await this.firebaseService.getUserByPhone(phoneNumber);
      if (couple) {
        // ✅ SIMULAR LOGIN PLAYER (sem Firebase Auth)
        const playerUser: User = {
          uid: `player_${phoneNumber}`, // ID único para player
          phone: phoneNumber,
          role: 'player', // ✅ FORÇAR ROLE PLAYER
          displayName: `${couple.player1Name} / ${couple.player2Name}`
        };
        
        console.log('✅ Login player bem-sucedido:', playerUser); // Debug
        
        this.currentUserSubject.next(playerUser);
        this.router.navigate(['/player']);
      } else {
        throw new Error('Telefone não encontrado no sistema');
      }
    } catch (error) {
      console.error('❌ Erro no login player:', error); // Debug
      throw this.handleError(error);
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
      throw this.handleError(error);
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