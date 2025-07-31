// src/app/features/admin/add-couple/add-couple.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InputComponent } from '../../../shared/components/input/input';
import { ButtonComponent } from '../../../shared/components/button/button';

@Component({
  selector: 'app-add-couple',
  imports: [
    CommonModule,
    ReactiveFormsModule, // ✅ Para formGroup
    InputComponent,      // ✅ Para app-input
    ButtonComponent      // ✅ Para app-button
  ],
  templateUrl: './add-couple.html',
  styleUrls: ['./add-couple.scss']
})
export class AddCoupleComponent implements OnInit {
  @Input() isLoading: boolean = false;
  @Output() coupleAdded = new EventEmitter<any>();

  coupleForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.createForm();
  }

  private createForm(): void {
    this.coupleForm = this.fb.group({
      player1Name: ['', [Validators.required, Validators.minLength(2)]],
      player2Name: ['', [Validators.required, Validators.minLength(2)]],
      responsiblePhone: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]]
    });
  }

  onSubmit(): void {
    if (this.coupleForm.valid && !this.isLoading) {
      this.coupleAdded.emit(this.coupleForm.value);
      this.coupleForm.reset();
    }
  }

  getErrorMessage(fieldName: string): string {
    const field = this.coupleForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} é obrigatório`;
      }
      if (field.errors['minlength']) {
        const requiredLength = field.errors['minlength'].requiredLength;
        return `${this.getFieldLabel(fieldName)} deve ter pelo menos ${requiredLength} caracteres`;
      }
      if (field.errors['pattern']) {
        return 'Telefone deve ter 10 ou 11 dígitos';
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      player1Name: 'Nome do Jogador 1',
      player2Name: 'Nome do Jogador 2',
      responsiblePhone: 'Telefone do Responsável'
    };
    return labels[fieldName] || fieldName;
  }
}