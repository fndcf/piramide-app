// src/app/features/player/player-dashboard/player-dashboard.component.ts - ATUALIZADO
import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { FirebaseService, Couple } from '../../../core/services/firebase';
import { ChallengeService } from '../../../core/services/challenge';
import { Challenge } from '../../../core/interfaces/challenge.interfaces';
import { ButtonComponent } from '../../../shared/components/button/button';
import { ChallengeComponent } from '../../../shared/components/challenge/challenge';
import { PhonePipe } from '../../../shared/pipes/phone-pipe';
import { AuthService, User } from '../../../core/services/auth';

@Component({
  selector: 'app-player-dashboard',
  imports: [
    CommonModule,
    AsyncPipe,
    ButtonComponent,
    ChallengeComponent, // ✅ Novo componente
    PhonePipe
  ],
  templateUrl: './player-dashboard.html',
  styleUrls: ['./player-dashboard.scss']
})
export class PlayerDashboardComponent implements OnInit {
  currentUser: User | null = null;
  myCouple$!: Observable<Couple | null>;
  allCouples$!: Observable<Couple[]>;
  challenges$!: Observable<Challenge[]>; // ✅ Desafios
  
  isLoading = false;
  selectedTab = 'ranking'; // 'ranking' | 'challenges'

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private challengeService: ChallengeService // ✅ Novo serviço
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadPlayerData();
  }

  private loadPlayerData(): void {
    if (this.currentUser?.phone) {
      const userPhone = this.currentUser.phone; // Garantir que não é undefined
      this.myCouple$ = this.firebaseService.getCoupleByPhone(userPhone);
      
      // ✅ Carregar desafios quando soubermos o ID da dupla
      this.myCouple$.subscribe(couple => {
        if (couple?.id) {
          this.challenges$ = this.challengeService.getChallengesForCouple(couple.id);
        }
      });
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

  // ✅ NOVA FUNCIONALIDADE - DESAFIAR DUPLA (VERSÃO DEBUG)
  async challengeCouple(targetCouple: Couple): Promise<void> {
    if (!this.currentUser?.phone) {
      console.log('❌ Usuário não tem telefone');
      return;
    }

    const userPhone = this.currentUser.phone; // Garantir que não é undefined
    console.log('🎯 Iniciando desafio para:', targetCouple);

    try {
      this.isLoading = true;
      
      // Buscar dados da minha dupla de forma síncrona
      console.log('📞 Buscando minha dupla com telefone:', userPhone);
      
      const myCouple = await this.getCurrentCouple();
      console.log('👥 Minha dupla encontrada:', myCouple);

      if (!myCouple?.id || !targetCouple.id) {
        throw new Error(`Erro ao identificar as duplas. Minha dupla: ${myCouple?.id}, Target: ${targetCouple.id}`);
      }

      console.log('📋 Dados para desafio:', { 
        challengerId: myCouple.id, 
        challengedId: targetCouple.id,
        challengerName: `${myCouple.player1Name} / ${myCouple.player2Name}`,
        challengedName: `${targetCouple.player1Name} / ${targetCouple.player2Name}`
      });

      // Tentar criar o desafio
      console.log('⚔️ Chamando challengeService.createChallenge...');
      const challengeId = await this.challengeService.createChallenge(myCouple.id, targetCouple.id);
      
      console.log('✅ Desafio criado com ID:', challengeId);
      alert(`✅ Desafio enviado com sucesso para ${targetCouple.player1Name} / ${targetCouple.player2Name}!`);
      
    } catch (error: any) {
      console.error('❌ Erro detalhado ao enviar desafio:', error);
      console.error('Stack trace:', error.stack);
      alert(`❌ Erro: ${error.message || 'Erro desconhecido ao enviar desafio'}`);
    } finally {
      console.log('🏁 Finalizando - removendo loading');
      this.isLoading = false;
    }
  }

  // ✅ HANDLERS DOS EVENTOS DO COMPONENTE DE DESAFIO
  async onRespondToChallenge(event: {challengeId: string, accept: boolean}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      await this.challengeService.respondToChallenge(event.challengeId, myCouple.id, event.accept);
      
    } catch (error: any) {
      console.error('❌ Erro ao responder desafio:', error);
      alert(error.message || 'Erro ao responder desafio');
    } finally {
      this.isLoading = false;
    }
  }

  async onProposeDates(event: {challengeId: string, dates: Date[]}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      await this.challengeService.proposeDates(event.challengeId, myCouple.id, event.dates);
      
    } catch (error: any) {
      console.error('❌ Erro ao propor datas:', error);
      alert(error.message || 'Erro ao propor datas');
    } finally {
      this.isLoading = false;
    }
  }

  async onSelectDate(event: {challengeId: string, dateId: string}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      await this.challengeService.selectDate(event.challengeId, myCouple.id, event.dateId);
      
    } catch (error: any) {
      console.error('❌ Erro ao selecionar data:', error);
      alert(error.message || 'Erro ao selecionar data');
    } finally {
      this.isLoading = false;
    }
  }

  async onMakeCounterProposal(event: {challengeId: string, date: Date}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      await this.challengeService.makeCounterProposal(event.challengeId, myCouple.id, event.date);
      
    } catch (error: any) {
      console.error('❌ Erro ao fazer contraproposta:', error);
      alert(error.message || 'Erro ao fazer contraproposta');
    } finally {
      this.isLoading = false;
    }
  }

  async onRespondToCounter(event: {challengeId: string, accept: boolean}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      await this.challengeService.respondToCounterProposal(event.challengeId, myCouple.id, event.accept);
      
    } catch (error: any) {
      console.error('❌ Erro ao responder contraproposta:', error);
      alert(error.message || 'Erro ao responder contraproposta');
    } finally {
      this.isLoading = false;
    }
  }

  // ✅ MÉTODOS AUXILIARES
  private async getCurrentCouple(): Promise<Couple | null> {
    if (!this.currentUser?.phone) {
      console.log('❌ getCurrentCouple: Usuário não tem telefone');
      return null;
    }
    
    const phone = this.currentUser.phone; // Garantir que não é undefined
    
    try {
      console.log('🔍 Buscando dupla por telefone:', phone);
      
      const couple = await new Promise<Couple | null>((resolve, reject) => {
        const subscription = this.firebaseService.getCoupleByPhone(phone).subscribe({
          next: (result) => {
            console.log('📱 Resultado da busca por telefone:', result);
            subscription.unsubscribe();
            resolve(result);
          },
          error: (error) => {
            console.error('❌ Erro na busca por telefone:', error);
            subscription.unsubscribe();
            reject(error);
          }
        });
      });
      
      if (couple) {
        console.log('✅ Dupla encontrada:', couple);
      } else {
        console.log('❌ Nenhuma dupla encontrada para este telefone');
      }
      
      return couple;
    } catch (error) {
      console.error('❌ Erro ao buscar dupla atual:', error);
      return null;
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

  trackByCouple(index: number, couple: Couple): any {
    return couple.id || index;
  }

  trackByChallenge(index: number, challenge: Challenge): any {
    return challenge.id || index;
  }

  // ✅ NAVEGAÇÃO ENTRE ABAS
  selectTab(tab: string): void {
    this.selectedTab = tab;
  }
}