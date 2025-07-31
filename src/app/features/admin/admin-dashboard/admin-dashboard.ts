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
  isLoading = false;

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.couples$ = this.firebaseService.getCouples();
  }

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
}