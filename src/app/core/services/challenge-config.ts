// src/app/core/services/challenge-config.service.ts
import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from '@angular/fire/firestore';

import { ChallengeConfig, SystemConfig } from '../interfaces/challenge.interfaces';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class ChallengeConfigService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  
  private configCollection = 'system_config';
  private configDocId = 'challenge_config';

  // Configuração padrão
  private defaultConfig: ChallengeConfig = {
    responseTimeHours: 24,
    datesTimeHours: 24,
    finalTimeHours: 24,
    requireWeekendDate: true,
    minProposedDates: 3
  };

  // ✅ BUSCAR CONFIGURAÇÃO ATUAL
  async getConfig(): Promise<ChallengeConfig> {
    try {
      const docRef = doc(this.firestore, this.configCollection, this.configDocId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const systemConfig = docSnap.data() as SystemConfig;
        return systemConfig.challengeConfig;
      }
      
      // Se não existe, criar com configuração padrão
      await this.createDefaultConfig();
      return this.defaultConfig;
      
    } catch (error) {
      console.error('❌ Erro ao buscar configuração:', error);
      return this.defaultConfig;
    }
  }

  // ✅ ATUALIZAR CONFIGURAÇÃO
  async updateConfig(config: ChallengeConfig): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Apenas administradores podem alterar a configuração');
      }

      const systemConfig: SystemConfig = {
        challengeConfig: config,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      };

      const docRef = doc(this.firestore, this.configCollection, this.configDocId);
      
      // Verificar se documento existe
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        await updateDoc(docRef, systemConfig as any);
      } else {
        await setDoc(docRef, systemConfig);
      }

      console.log('✅ Configuração atualizada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao atualizar configuração:', error);
      throw error;
    }
  }

  // ✅ CRIAR CONFIGURAÇÃO PADRÃO
  private async createDefaultConfig(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      
      const systemConfig: SystemConfig = {
        challengeConfig: this.defaultConfig,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid || 'system'
      };

      const docRef = doc(this.firestore, this.configCollection, this.configDocId);
      await setDoc(docRef, systemConfig);
      
      console.log('✅ Configuração padrão criada');
      
    } catch (error) {
      console.error('❌ Erro ao criar configuração padrão:', error);
    }
  }

  // ✅ VALIDAR CONFIGURAÇÃO
  validateConfig(config: ChallengeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.responseTimeHours < 1 || config.responseTimeHours > 168) {
      errors.push('Tempo de resposta deve estar entre 1 e 168 horas');
    }

    if (config.datesTimeHours < 1 || config.datesTimeHours > 168) {
      errors.push('Tempo para propostas deve estar entre 1 e 168 horas');
    }

    if (config.finalTimeHours < 1 || config.finalTimeHours > 168) {
      errors.push('Tempo para decisões finais deve estar entre 1 e 168 horas');
    }

    if (config.minProposedDates < 1 || config.minProposedDates > 10) {
      errors.push('Mínimo de datas deve estar entre 1 e 10');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ✅ RESETAR PARA CONFIGURAÇÃO PADRÃO
  async resetToDefault(): Promise<void> {
    try {
      await this.updateConfig(this.defaultConfig);
      console.log('✅ Configuração resetada para padrão');
    } catch (error) {
      console.error('❌ Erro ao resetar configuração:', error);
      throw error;
    }
  }

  // ✅ EXPORTAR CONFIGURAÇÃO
  async exportConfig(): Promise<string> {
    try {
      const config = await this.getConfig();
      return JSON.stringify(config, null, 2);
    } catch (error) {
      console.error('❌ Erro ao exportar configuração:', error);
      throw error;
    }
  }

  // ✅ IMPORTAR CONFIGURAÇÃO
  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson) as ChallengeConfig;
      
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuração inválida: ${validation.errors.join(', ')}`);
      }

      await this.updateConfig(config);
      console.log('✅ Configuração importada com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao importar configuração:', error);
      throw error;
    }
  }
}