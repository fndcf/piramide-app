// src/app/features/admin/challenge-config/challenge-config.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { ButtonComponent } from '../../../shared/components/button/button';
import { InputComponent } from '../../../shared/components/input/input';
import { ChallengeConfig } from '../../../core/interfaces/challenge.interfaces';
import { ChallengeConfigService } from '../../../core/services/challenge-config';

@Component({
  selector: 'app-challenge-config',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    InputComponent
  ],
  templateUrl: './challenge-config.html',
  styleUrls: ['./challenge-config.scss']
})
export class ChallengeConfigComponent implements OnInit {
  configForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private challengeConfigService: ChallengeConfigService
  ) {}

  ngOnInit(): void {
    this.createForm();
    this.loadCurrentConfig();
  }

  private createForm(): void {
    this.configForm = this.fb.group({
      responseTimeHours: [24, [Validators.required, Validators.min(1), Validators.max(168)]], // Max 1 semana
      datesTimeHours: [24, [Validators.required, Validators.min(1), Validators.max(168)]],
      finalTimeHours: [24, [Validators.required, Validators.min(1), Validators.max(168)]],
      requireWeekendDate: [true],
      minProposedDates: [3, [Validators.required, Validators.min(1), Validators.max(10)]]
    });
  }

  private async loadCurrentConfig(): Promise<void> {
    try {
      this.isLoading = true;
      const config = await this.challengeConfigService.getConfig();
      
      if (config) {
        this.configForm.patchValue(config);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      this.errorMessage = 'Erro ao carregar configuração atual';
    } finally {
      this.isLoading = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.configForm.invalid) return;

    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const config: ChallengeConfig = this.configForm.value;
      await this.challengeConfigService.updateConfig(config);

      this.successMessage = 'Configuração salva com sucesso!';
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => {
        this.successMessage = '';
      }, 3000);

    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      this.errorMessage = error.message || 'Erro ao salvar configuração';
    } finally {
      this.isLoading = false;
    }
  }

  onReset(): void {
    this.configForm.reset();
    this.loadCurrentConfig();
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ✅ GETTERS PARA VALIDAÇÃO
  get responseTimeHours() { return this.configForm.get('responseTimeHours'); }
  get datesTimeHours() { return this.configForm.get('datesTimeHours'); }
  get finalTimeHours() { return this.configForm.get('finalTimeHours'); }
  get minProposedDates() { return this.configForm.get('minProposedDates'); }

  // ✅ MÉTODOS AUXILIARES
  getErrorMessage(fieldName: string): string {
    const field = this.configForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} é obrigatório`;
      }
      if (field.errors['min']) {
        const minValue = field.errors['min'].min;
        return `${this.getFieldLabel(fieldName)} deve ser pelo menos ${minValue}`;
      }
      if (field.errors['max']) {
        const maxValue = field.errors['max'].max;
        return `${this.getFieldLabel(fieldName)} deve ser no máximo ${maxValue}`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      responseTimeHours: 'Tempo para resposta',
      datesTimeHours: 'Tempo para propostas',
      finalTimeHours: 'Tempo para decisões finais',
      minProposedDates: 'Mínimo de datas'
    };
    return labels[fieldName] || fieldName;
  }

  formatTimeDisplay(hours: number): string {
    if (hours < 24) {
      return `${hours} hora(s)`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) {
        return `${days} dia(s)`;
      } else {
        return `${days} dia(s) e ${remainingHours} hora(s)`;
      }
    }
  }
}