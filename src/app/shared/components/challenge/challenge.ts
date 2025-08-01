// src/app/shared/components/challenge/challenge.component.ts - VERSÃO COMPLETA
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';

import { ButtonComponent } from '../button/button';
import { InputComponent } from '../input/input';
import { ModalComponent } from '../modal/modal';

import { 
  Challenge, 
  ChallengeStatus, 
  ChallengeStep,
  ChallengeDate 
} from '../../../core/interfaces/challenge.interfaces';

@Component({
  selector: 'app-challenge',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    InputComponent,
    ModalComponent
  ],
  templateUrl: './challenge.html',
  styleUrls: ['./challenge.scss']
})
export class ChallengeComponent implements OnInit {
  @Input() challenge!: Challenge;
  @Input() currentCoupleId!: string;
  @Input() isLoading = false;
  
  @Output() respondToChallenge = new EventEmitter<{challengeId: string, accept: boolean}>();
  @Output() proposeDates = new EventEmitter<{challengeId: string, dates: Date[]}>();
  @Output() selectDate = new EventEmitter<{challengeId: string, dateId: string}>();
  @Output() makeCounterProposal = new EventEmitter<{challengeId: string, date: Date}>();
  @Output() respondToCounter = new EventEmitter<{challengeId: string, accept: boolean}>();

  showDatesModal = false;
  showCounterModal = false;
  datesForm!: FormGroup;
  counterForm!: FormGroup;

  // Enums para template
  ChallengeStatus = ChallengeStatus;
  ChallengeStep = ChallengeStep;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.createForms();
  }

  private createForms(): void {
    // Formulário para propor datas
    this.datesForm = this.fb.group({
      dates: this.fb.array([
        this.createDateControl(),
        this.createDateControl(),
        this.createDateControl()
      ])
    });

    // Formulário para contraproposta
    this.counterForm = this.fb.group({
      counterDate: ['', Validators.required]
    });
  }

  private createDateControl(): FormGroup {
    return this.fb.group({
      date: ['', Validators.required],
      description: ['']
    });
  }

  get datesArray(): FormArray {
    return this.datesForm.get('dates') as FormArray;
  }

  // ✅ GETTERS PARA O TEMPLATE
  get isChallenger(): boolean {
    return this.challenge.challengerId === this.currentCoupleId;
  }

  get isChallenged(): boolean {
    return this.challenge.challengedId === this.currentCoupleId;
  }

  get canRespond(): boolean {
    return this.isChallenged && 
           this.challenge.status === ChallengeStatus.PENDING_RESPONSE &&
           !this.isExpired();
  }

  get canProposeDates(): boolean {
    return this.isChallenged && 
           this.challenge.status === ChallengeStatus.PENDING_DATES &&
           !this.isExpired();
  }

  get canSelectDate(): boolean {
    return this.isChallenger && 
           this.challenge.status === ChallengeStatus.PENDING_DATE_SELECTION &&
           !this.isExpired();
  }

  get canMakeCounter(): boolean {
    return this.isChallenger && 
           this.challenge.status === ChallengeStatus.PENDING_DATE_SELECTION &&
           !this.isExpired();
  }

  get canRespondToCounter(): boolean {
    return this.isChallenged && 
           this.challenge.status === ChallengeStatus.PENDING_COUNTER_RESPONSE &&
           !this.isExpired();
  }

  // ✅ AÇÕES DOS BOTÕES
  onAcceptChallenge(): void {
    this.respondToChallenge.emit({
      challengeId: this.challenge.id!,
      accept: true
    });
  }

  onDeclineChallenge(): void {
    if (confirm('Tem certeza que deseja recusar este desafio? O desafiante assumirá sua posição no ranking.')) {
      this.respondToChallenge.emit({
        challengeId: this.challenge.id!,
        accept: false
      });
    }
  }

  onOpenDatesModal(): void {
    this.showDatesModal = true;
  }

  onCloseDatesModal(): void {
    this.showDatesModal = false;
    this.datesForm.reset();
    // Recriar os 3 campos básicos
    const datesArray = this.datesForm.get('dates') as FormArray;
    datesArray.clear();
    for (let i = 0; i < this.challenge.config.minProposedDates; i++) {
      datesArray.push(this.createDateControl());
    }
  }

  onSubmitDates(): void {
    if (this.datesForm.valid) {
      const formDates = this.datesArray.value;
      const dates = formDates
        .filter((d: any) => d.date)
        .map((d: any) => new Date(d.date));

      // Validar que tem pelo menos uma data de fim de semana
      if (this.challenge.config.requireWeekendDate) {
        const hasWeekend = dates.some((date: Date) => this.isWeekend(date));
        if (!hasWeekend) {
          alert('Pelo menos uma data deve ser no final de semana (sábado ou domingo)');
          return;
        }
      }

      if (dates.length < this.challenge.config.minProposedDates) {
        alert(`É necessário propor pelo menos ${this.challenge.config.minProposedDates} datas`);
        return;
      }

      // Validar se todas as datas são futuras
      const now = new Date();
      const pastDates = dates.filter((date: Date) => date <= now);
      if (pastDates.length > 0) {
        alert('Todas as datas devem ser futuras');
        return;
      }

      this.proposeDates.emit({
        challengeId: this.challenge.id!,
        dates
      });

      this.onCloseDatesModal();
    }
  }

  onSelectDate(dateId: string): void {
    this.selectDate.emit({
      challengeId: this.challenge.id!,
      dateId
    });
  }

  onOpenCounterModal(): void {
    this.showCounterModal = true;
  }

  onCloseCounterModal(): void {
    this.showCounterModal = false;
    this.counterForm.reset();
  }

  onSubmitCounter(): void {
    if (this.counterForm.valid) {
      const counterDate = new Date(this.counterForm.value.counterDate);
      
      // Validar se a data é futura
      const now = new Date();
      if (counterDate <= now) {
        alert('A data da contraproposta deve ser futura');
        return;
      }
      
      this.makeCounterProposal.emit({
        challengeId: this.challenge.id!,
        date: counterDate
      });

      this.onCloseCounterModal();
    }
  }

  onAcceptCounter(): void {
    this.respondToCounter.emit({
      challengeId: this.challenge.id!,
      accept: true
    });
  }

  onDeclineCounter(): void {
    if (confirm('Tem certeza que deseja recusar a contraproposta? O desafio será cancelado.')) {
      this.respondToCounter.emit({
        challengeId: this.challenge.id!,
        accept: false
      });
    }
  }

  onDeclineDates(): void {
    if (confirm('Tem certeza que deseja recusar todas as datas? Você pode fazer uma contraproposta em vez disso.')) {
      // Por enquanto, apenas abrir o modal de contraproposta
      this.onOpenCounterModal();
    }
  }

  // ✅ MÉTODOS AUXILIARES
  isExpired(): boolean {
    const now = new Date();
    
    switch (this.challenge.status) {
      case ChallengeStatus.PENDING_RESPONSE:
        return now > this.challenge.responseDeadline;
      case ChallengeStatus.PENDING_DATES:
        return this.challenge.datesDeadline ? now > this.challenge.datesDeadline : false;
      case ChallengeStatus.PENDING_DATE_SELECTION:
      case ChallengeStatus.PENDING_COUNTER_RESPONSE:
        return this.challenge.finalDeadline ? now > this.challenge.finalDeadline : false;
      default:
        return false;
    }
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Domingo ou Sábado
  }

  // ✅ FORMATAÇÃO PARA O TEMPLATE
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  formatTimeRemaining(): string {
    let deadline: Date;
    
    switch (this.challenge.status) {
      case ChallengeStatus.PENDING_RESPONSE:
        deadline = this.challenge.responseDeadline;
        break;
      case ChallengeStatus.PENDING_DATES:
        deadline = this.challenge.datesDeadline!;
        break;
      case ChallengeStatus.PENDING_DATE_SELECTION:
      case ChallengeStatus.PENDING_COUNTER_RESPONSE:
        deadline = this.challenge.finalDeadline!;
        break;
      default:
        return '';
    }

    const now = new Date();
    const timeLeft = deadline.getTime() - now.getTime();
    
    if (timeLeft <= 0) {
      return 'Prazo expirado';
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} dia(s) restante(s)`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m restante(s)`;
    } else {
      return `${minutes}m restante(s)`;
    }
  }

  getStatusText(): string {
    switch (this.challenge.status) {
      case ChallengeStatus.PENDING_RESPONSE:
        return 'Aguardando resposta';
      case ChallengeStatus.PENDING_DATES:
        return 'Aguardando propostas de datas';
      case ChallengeStatus.PENDING_DATE_SELECTION:
        return 'Aguardando seleção de data';
      case ChallengeStatus.PENDING_COUNTER_RESPONSE:
        return 'Aguardando resposta à contraproposta';
      case ChallengeStatus.SCHEDULED:
        return 'Agendado';
      case ChallengeStatus.EXPIRED:
        return 'Expirado';
      case ChallengeStatus.DECLINED:
        return 'Recusado';
      case ChallengeStatus.CANCELLED:
        return 'Cancelado';
      case ChallengeStatus.COMPLETED:
        return 'Realizado';
      default:
        return 'Status desconhecido';
    }
  }

  getStatusClass(): string {
    switch (this.challenge.status) {
      case ChallengeStatus.PENDING_RESPONSE:
      case ChallengeStatus.PENDING_DATES:
      case ChallengeStatus.PENDING_DATE_SELECTION:
      case ChallengeStatus.PENDING_COUNTER_RESPONSE:
        return 'status-pending';
      case ChallengeStatus.SCHEDULED:
        return 'status-scheduled';
      case ChallengeStatus.EXPIRED:
      case ChallengeStatus.DECLINED:
      case ChallengeStatus.CANCELLED:
        return 'status-negative';
      case ChallengeStatus.COMPLETED:
        return 'status-completed';
      default:
        return 'status-default';
    }
  }

  addDateField(): void {
    if (this.datesArray.length < 5) { // Máximo 5 datas
      this.datesArray.push(this.createDateControl());
    }
  }

  removeDateField(index: number): void {
    if (this.datesArray.length > this.challenge.config.minProposedDates) {
      this.datesArray.removeAt(index);
    }
  }

  isDateWeekend(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return this.isWeekend(date);
  }

  getMinDateTime(): string {
    // Retorna data/hora mínima (agora + 1 hora) no formato datetime-local
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  }
}