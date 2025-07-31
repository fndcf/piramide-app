// src/app/shared/components/login-form/login-form.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InputComponent } from '../input/input';
import { ButtonComponent } from '../button/button';

export interface LoginData {
  email?: string;
  password?: string;
  phone?: string;
}

@Component({
  selector: 'app-login-form',
  imports: [
    CommonModule, 
    ReactiveFormsModule, // ✅ Para formGroup
    InputComponent,      // ✅ Para app-input
    ButtonComponent      // ✅ Para app-button
  ],
  templateUrl: './login-form.html',
  styleUrls: ['./login-form.scss']
})
export class LoginFormComponent implements OnInit, OnChanges {
  @Input() loginType: 'admin' | 'player' = 'admin';
  @Input() isLoading: boolean = false;
  @Output() loginSubmit = new EventEmitter<LoginData>();

  loginForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.createForm();
  }

  // ✅ ADICIONAR OnChanges para recriar o form quando loginType mudar
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loginType'] && !changes['loginType'].firstChange) {
      this.createForm();
    }
  }

  private createForm(): void {
    if (this.loginType === 'admin') {
      this.loginForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]]
      });
    } else {
      this.loginForm = this.fb.group({
        phone: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]]
      });
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid && !this.isLoading) {
      this.loginSubmit.emit(this.loginForm.value);
    }
  }

  getErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} é obrigatório`;
      }
      if (field.errors['email']) {
        return 'Email inválido';
      }
      if (field.errors['minlength']) {
        return 'Senha deve ter pelo menos 6 caracteres';
      }
      if (field.errors['pattern']) {
        return 'Telefone deve ter 10 ou 11 dígitos';
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      email: 'Email',
      password: 'Senha',
      phone: 'Telefone'
    };
    return labels[fieldName] || fieldName;
  }
}