// src/app/features/player/player-dashboard/player-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FirebaseService, Couple } from '../../../core/services/firebase';
import { Observable } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button';
import { PhonePipe } from '../../../shared/pipes/phone-pipe';
import { AuthService, User } from '../../../core/services/auth';

@Component({
  selector: 'app-player-dashboard',
  imports: [
    CommonModule,
    AsyncPipe,       // ✅ Para async pipe
    ButtonComponent, // ✅ Para app-button
    PhonePipe       // ✅ Para phone pipe
  ],
  templateUrl: './player-dashboard.html',
  styleUrls: ['./player-dashboard.scss']
})
export class PlayerDashboardComponent implements OnInit {
  currentUser: User | null = null;
  myCouple$!: Observable<Couple | null>;
  allCouples$!: Observable<Couple[]>;

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadPlayerData();
  }

  private loadPlayerData(): void {
    if (this.currentUser?.phone) {
      this.myCouple$ = this.firebaseService.getCoupleByPhone(this.currentUser.phone);
    }
    this.allCouples$ = this.firebaseService.getCouples();
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  getPosition(couples: Couple[], currentCouple: Couple): number {
    if (!currentCouple) return 0;
    
    const sortedCouples = couples
      .sort((a, b) => (b.points || 0) - (a.points || 0));
    
    return sortedCouples.findIndex(c => c.id === currentCouple.id) + 1;
  }

  canChallenge(myCouple: Couple, targetCouple: Couple, myPosition: number, targetPosition: number): boolean {
    // Pode desafiar duplas até 2 posições acima
    return targetPosition >= Math.max(1, myPosition - 2) && targetPosition < myPosition;
  }

  challengeCouple(couple: Couple): void {
    // Implementar lógica de desafio
    alert(`Funcionalidade de desafio será implementada! Desafiando: ${couple.player1Name} / ${couple.player2Name}`);
  }

  trackByCouple(index: number, couple: Couple): any {
    return couple.id || index;
  }
}