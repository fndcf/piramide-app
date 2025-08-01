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
    ChallengeComponent,
    PhonePipe
  ],
  templateUrl: './player-dashboard.html',
  styleUrls: ['./player-dashboard.scss']
})
export class PlayerDashboardComponent implements OnInit {
  currentUser: User | null = null;
  myCouple$!: Observable<Couple | null>;
  allCouples$!: Observable<Couple[]>;
  challenges$!: Observable<Challenge[]>;
  
  isLoading = false;
  selectedTab = 'ranking'; // 'ranking' | 'challenges'

  // ✅ NOVOS CAMPOS PARA CONTROLE DE DESAFIO ATIVO
  hasActiveChallenge = false;
  activeChallengeInfo: {
    challengeType?: 'as_challenger' | 'as_challenged';
    challengeStatus?: string;
    opponentName?: string;
    challengeId?: string;
  } = {};

  // ✅ NOVO CAMPO: Controle de duplas com desafios ativos
  couplesWithActiveChallenges = new Set<string>();

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private challengeService: ChallengeService
  ) {}

  private gameTimeInterval?: any;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadPlayerData();

    // ✅ INICIAR VERIFICAÇÃO AUTOMÁTICA A CADA 30 SEGUNDOS
    this.startGameTimeCheck();
  }

  ngOnDestroy(): void {
    // ✅ LIMPAR INTERVAL AO DESTRUIR COMPONENTE
    if (this.gameTimeInterval) {
      clearInterval(this.gameTimeInterval);
    }
  }

  // ✅ NOVO MÉTODO: Verificação automática
  private startGameTimeCheck(): void {
    // Verificar imediatamente
    this.checkScheduledGames();
    
    // Verificar a cada 30 segundos
    this.gameTimeInterval = setInterval(() => {
      this.checkScheduledGames();
    }, 30000); // 30 segundos
    
    console.log('🕐 Verificação automática de horários iniciada (30s)');
  }

  // ✅ NOVO MÉTODO: Verificar jogos agendados
  private async checkScheduledGames(): Promise<void> {
    try {
      console.log('🔍 Verificando se há jogos na hora...');
      await this.challengeService.checkGameTimes();
    } catch (error) {
      console.error('❌ Erro ao verificar jogos:', error);
    }
  }

  private loadPlayerData(): void {
    if (this.currentUser?.phone) {
      const userPhone = this.currentUser.phone;
      this.myCouple$ = this.firebaseService.getCoupleByPhone(userPhone);
      
      // ✅ CARREGAR DESAFIOS E VERIFICAR DESAFIO ATIVO
      this.myCouple$.subscribe(async couple => {
        if (couple?.id) {
          this.challenges$ = this.challengeService.getChallengesForCouple(couple.id);
          
          // ✅ VERIFICAR SE TEM DESAFIO ATIVO
          await this.checkActiveChallenge(couple.id);
          
          // ✅ NOVO: Carregar duplas com desafios ativos
          await this.loadCouplesWithActiveChallenges();
        }
      });
    }
    this.allCouples$ = this.firebaseService.getCouples();
  }

  // ✅ NOVO MÉTODO: Carregar duplas que têm desafios ativos
  private async loadCouplesWithActiveChallenges(): Promise<void> {
    try {
      console.log('🔍 Carregando duplas com desafios ativos...');
      
      const activeCouplesSet = await this.challengeService.getAllCouplesWithActiveChallenges();
      this.couplesWithActiveChallenges = activeCouplesSet;
      
      console.log('📋 Duplas com desafios ativos:', Array.from(activeCouplesSet));
      
    } catch (error) {
      console.error('❌ Erro ao carregar duplas com desafios ativos:', error);
      this.couplesWithActiveChallenges = new Set();
    }
  }

  // ✅ NOVO MÉTODO: Verificar se a dupla alvo tem desafio ativo
  targetHasActiveChallenge(targetCoupleId: string): boolean {
    return this.couplesWithActiveChallenges.has(targetCoupleId);
  }
  private async checkActiveChallenge(coupleId: string): Promise<void> {
    try {
      const status = await this.challengeService.getCouplechallengeStatus(coupleId);
      
      this.hasActiveChallenge = status.hasActiveChallenge;
      
      if (status.hasActiveChallenge) {
        this.activeChallengeInfo = {
          challengeType: status.challengeType,
          challengeStatus: status.challengeStatus,
          opponentName: status.opponentName,
          challengeId: status.challengeId
        };
        
        console.log('⚠️ Dupla tem desafio ativo:', this.activeChallengeInfo);
      } else {
        this.activeChallengeInfo = {};
        console.log('✅ Dupla livre para novos desafios');
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar desafio ativo:', error);
      this.hasActiveChallenge = false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  // ✅ DESAFIAR DUPLA - ATUALIZADO COM VERIFICAÇÃO
  async challengeCouple(targetCouple: Couple): Promise<void> {
    if (!this.currentUser?.phone) {
      console.log('❌ Usuário não tem telefone');
      return;
    }

    // ✅ VERIFICAÇÃO: Se já tem desafio ativo, não permitir
    if (this.hasActiveChallenge) {
      const message = this.getActiveChallengeMessage();
      alert(`❌ ${message}\n\nFinalize seu desafio atual antes de criar um novo.`);
      return;
    }

    const userPhone = this.currentUser.phone;
    console.log('🎯 Iniciando desafio para:', targetCouple);

    try {
      this.isLoading = true;
      
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

      console.log('⚔️ Chamando challengeService.createChallenge...');
      const challengeId = await this.challengeService.createChallenge(myCouple.id, targetCouple.id);
      
      console.log('✅ Desafio criado com ID:', challengeId);
      alert(`✅ Desafio enviado com sucesso para ${targetCouple.player1Name} / ${targetCouple.player2Name}!`);
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS CRIAR DESAFIO
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
    } catch (error: any) {
      console.error('❌ Erro detalhado ao enviar desafio:', error);
      console.error('Stack trace:', error.stack);
      alert(`❌ Erro: ${error.message || 'Erro desconhecido ao enviar desafio'}`);
    } finally {
      console.log('🏁 Finalizando - removendo loading');
      this.isLoading = false;
    }
  }

  // ✅ NOVO MÉTODO: Obter mensagem do desafio ativo (PUBLIC para template)
  getActiveChallengeMessage(): string {
    const info = this.activeChallengeInfo;
    
    if (info.challengeType === 'as_challenger') {
      return `Você já desafiou ${info.opponentName}. Status: ${this.getStatusDescription(info.challengeStatus)}`;
    } else if (info.challengeType === 'as_challenged') {
      return `Você foi desafiado por ${info.opponentName}. Status: ${this.getStatusDescription(info.challengeStatus)}`;
    }
    
    return 'Você já tem um desafio ativo';
  }

  // ✅ NOVO MÉTODO: Descrição amigável do status (PUBLIC para template)
  getStatusDescription(status?: string): string {
    switch (status) {
      case 'pending_response': return 'Aguardando resposta';
      case 'pending_dates': return 'Aguardando propostas de datas';
      case 'pending_date_selection': return 'Aguardando seleção de data';
      case 'pending_counter_response': return 'Aguardando resposta à contraproposta';
      case 'scheduled': return 'Jogo agendado';
      case 'game_time': return 'Jogo pode ser realizado';
      case 'pending_result': return 'Aguardando resultado';
      case 'pending_confirmation': return 'Aguardando confirmação do resultado';
      default: return 'Em andamento';
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
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS RESPONDER
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
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
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS PROPOR DATAS
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
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
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS SELECIONAR DATA
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
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
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS CONTRAPROPOSTA
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
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
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS RESPONDER CONTRAPROPOSTA
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
    } catch (error: any) {
      console.error('❌ Erro ao responder contraproposta:', error);
      alert(error.message || 'Erro ao responder contraproposta');
    } finally {
      this.isLoading = false;
    }
  }

  async onReportResult(event: {challengeId: string, winnerId: string, score?: string, notes?: string}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      const score = event.score && event.score.trim() !== '' ? event.score.trim() : undefined;
      const notes = event.notes && event.notes.trim() !== '' ? event.notes.trim() : undefined;

      console.log('📊 Enviando resultado:', {
        challengeId: event.challengeId,
        winnerId: event.winnerId,
        score,
        notes,
        reporterId: myCouple.id
      });

      await this.challengeService.reportGameResult(
        event.challengeId, 
        myCouple.id, 
        event.winnerId, 
        score, 
        notes
      );
      
      alert('✅ Resultado lançado! Aguardando confirmação da outra dupla.');
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS LANÇAR RESULTADO
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
    } catch (error: any) {
      console.error('❌ Erro ao lançar resultado:', error);
      alert(error.message || 'Erro ao lançar resultado');
    } finally {
      this.isLoading = false;
    }
  }

  async onConfirmResult(event: {challengeId: string, agree: boolean}): Promise<void> {
    if (!this.currentUser?.phone) return;

    try {
      this.isLoading = true;
      
      const myCouple = await this.getCurrentCouple();
      if (!myCouple?.id) throw new Error('Dupla não encontrada');

      await this.challengeService.confirmGameResult(event.challengeId, myCouple.id, event.agree);
      
      if (event.agree) {
        alert('✅ Resultado confirmado! Ranking atualizado.');
      } else {
        alert('⚠️ Resultado contestado. Um administrador irá resolver a situação.');
      }
      
      // ✅ RECARREGAR STATUS E DUPLAS ATIVAS APÓS CONFIRMAR RESULTADO
      await this.checkActiveChallenge(myCouple.id);
      await this.loadCouplesWithActiveChallenges();
      
    } catch (error: any) {
      console.error('❌ Erro ao confirmar resultado:', error);
      alert(error.message || 'Erro ao confirmar resultado');
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
    
    const phone = this.currentUser.phone;
    
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
    return currentCouple?.position || 0;
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

  getPositionDescription(position: number): string {
    if (position === 1) return '👑 Campeão - Topo do ranking';
    if (position === 2) return '🥈 Vice-campeão - Segundo lugar';
    if (position === 3) return '🥉 Terceiro lugar - Pódio';
    if (position <= 5) return '⭐ Top 5 - Posição de destaque';
    if (position <= 10) return '🔥 Top 10 - Boa posição';
    return `${position}º lugar no ranking`;
  }

  getPositionBadgeClass(position: number): string {
    if (position === 1) return 'first top-3';
    if (position === 2) return 'second top-3';
    if (position === 3) return 'third top-3';
    return 'regular';
  }

  getMathAbs(value: number): number {
    return Math.abs(value);
  }

  getStreakLabel(streak: number): string {
    if (streak > 0) return 'Vitórias';
    if (streak < 0) return 'Derrotas';
    return 'Neutro';
  }

  getStreakDisplay(streak: number): string {
    if (streak >= 3) return `🔥${streak}`;
    if (streak <= -3) return `❄️${Math.abs(streak)}`;
    if (streak > 0) return `↗️${streak}`;
    if (streak < 0) return `↘️${Math.abs(streak)}`;
    return '';
  }

  // ✅ SIMPLIFICADO: Verificar regras básicas de desafio (sem verificação de desafio ativo)
  canChallenge(myCouple: Couple, targetCouple: Couple): boolean {
    // ✅ VERIFICAÇÃO: Se EU tenho desafio ativo, não pode desafiar
    if (this.hasActiveChallenge) {
      return false;
    }

    // Verificações básicas de ranking
    if (!myCouple || !targetCouple || myCouple.id === targetCouple.id) {
      return false;
    }
    
    const myPosition = myCouple.position;
    const targetPosition = targetCouple.position;
    
    // Pode desafiar duplas até 2 posições acima
    const maxChallengePosition = Math.max(1, myPosition - 2);
    
    return targetPosition >= maxChallengePosition && targetPosition < myPosition;
  }

  // ✅ ATUALIZADO: Motivo completo por que não pode desafiar
  getCannotChallengeReason(myCouple: Couple, targetCouple: Couple): string {
    // ✅ PRIORIDADE 1: Se EU tenho desafio ativo
    if (this.hasActiveChallenge) {
      return this.getActiveChallengeShortMessage();
    }

    // ✅ PRIORIDADE 2: Se a DUPLA ALVO tem desafio ativo
    if (this.targetHasActiveChallenge(targetCouple.id!)) {
      return 'Dupla já tem desafio ativo';
    }

    // ✅ PRIORIDADE 3: Regras de ranking
    if (targetCouple.position >= myCouple.position) {
      return 'Posição inferior à sua';
    }
    
    const maxChallengePosition = Math.max(1, myCouple.position - 2);
    if (targetCouple.position < maxChallengePosition) {
      return 'Muito acima (máx. 2 posições)';
    }
    
    return 'Não pode desafiar';
  }

  // ✅ NOVO MÉTODO: Mensagem curta do desafio ativo (PUBLIC para template)
  getActiveChallengeShortMessage(): string {
    const info = this.activeChallengeInfo;
    
    if (info.challengeType === 'as_challenger') {
      return `Você já desafiou ${info.opponentName?.split(' / ')[0] || 'outra dupla'}`;
    } else if (info.challengeType === 'as_challenged') {
      return `Você foi desafiado por ${info.opponentName?.split(' / ')[0] || 'outra dupla'}`;
    }
    
    return 'Desafio ativo';
  }

  // ✅ MÉTODO PARA VERIFICAÇÃO MANUAL DE HORÁRIOS
  async forceCheckGameTime(): Promise<void> {
    try {
      console.log('🔄 Forçando verificação de horários...');
      await this.challengeService.checkGameTimes();
      alert('✅ Verificação concluída! Verifique os desafios.');
    } catch (error) {
      console.error('❌ Erro na verificação:', error);
      alert('❌ Erro na verificação: ' + error);
    }
  }

  // ✅ NOVO MÉTODO: Ir direto para o desafio ativo
  goToActiveChallenge(): void {
    if (this.hasActiveChallenge && this.activeChallengeInfo.challengeId) {
      this.selectTab('challenges');
      // Opcional: scroll para o desafio específico
      setTimeout(() => {
        const element = document.getElementById(`challenge-${this.activeChallengeInfo.challengeId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }
}