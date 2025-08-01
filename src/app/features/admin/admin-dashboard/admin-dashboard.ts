// src/app/features/admin/admin-dashboard/admin-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FirebaseService, Couple } from '../../../core/services/firebase';
import { Observable } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { AddCoupleComponent } from '../add-couple/add-couple';
import { AuthService, User } from '../../../core/services/auth';
import { PhonePipe } from '../../../shared/pipes/phone-pipe';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    CommonModule,
    AsyncPipe,          // ✅ Para async pipe
    ButtonComponent,    // ✅ Para app-button
    ModalComponent,     // ✅ Para app-modal
    AddCoupleComponent, // ✅ Para app-add-couple
    PhonePipe          // ✅ Para phone pipe
  ],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboardComponent implements OnInit {
  currentUser: User | null = null;
  couples$!: Observable<Couple[]>;
  showAddCoupleModal = false;
  showStatsModal = false;
  selectedCouple: Couple | null = null;
  isLoading = false;

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.couples$ = this.firebaseService.getCouples();
  }

  // ✅ MÉTODO PARA USAR Math NO TEMPLATE
  getMathAbs(value: number): number {
    return Math.abs(value);
  }

  // ✅ NOVOS MÉTODOS PARA ESTATÍSTICAS
  viewStats(couple: Couple): void {
    this.selectedCouple = couple;
    this.showStatsModal = true;
  }

  closeStatsModal(): void {
    this.showStatsModal = false;
    this.selectedCouple = null;
  }

  getStreakIcon(streak: number): string {
    if (streak > 0) return '🔥';
    if (streak < 0) return '❄️';
    return '➖';
  }

  getStreakText(streak: number): string {
    if (streak > 0) return 'Sequência de Vitórias';
    if (streak < 0) return 'Sequência de Derrotas';
    return 'Sem Sequência';
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // ✅ MÉTODOS EXISTENTES MANTIDOS
  openAddCoupleModal(): void {
    this.showAddCoupleModal = true;
  }

  closeAddCoupleModal(): void {
    this.showAddCoupleModal = false;
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  async onCoupleAdded(coupleData: any): Promise<void> {
    this.isLoading = true;
    try {
      await this.firebaseService.addCouple(coupleData);
      this.closeAddCoupleModal();
    } catch (error) {
      console.error('Erro ao adicionar dupla:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async deleteCouple(couple: Couple): Promise<void> {
    if (couple.id && confirm(`Deseja realmente excluir a dupla ${couple.player1Name} / ${couple.player2Name}?`)) {
      try {
        await this.firebaseService.deleteCouple(couple.id);
      } catch (error) {
        console.error('Erro ao excluir dupla:', error);
      }
    }
  }

  trackByCouple(index: number, couple: Couple): any {
    return couple.id || index;
  }

  getPositionClass(index: number): string {
    if (index === 0) return 'first';
    if (index === 1) return 'second';
    if (index === 2) return 'third';
    return 'regular';
  }

}