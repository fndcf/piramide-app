// src/app/shared/pipes/phone.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phone',
  standalone: true
})
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    // ✅ Verificação de valores nulos/undefined
    if (!value || typeof value !== 'string') {
      return '';
    }
    
    // Remove todos os caracteres não numéricos
    const cleaned = value.replace(/\D/g, '');
    
    // Verifica se tem o tamanho correto
    if (cleaned.length === 10) {
      // Formato: (XX) XXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
      // Formato: (XX) 9XXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    
    // Se não tem formato esperado, retorna o valor original
    return value;
  }
}