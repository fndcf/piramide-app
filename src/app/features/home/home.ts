// src/app/features/home/home.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModalComponent } from '../../shared/components/modal/modal';
import { LoginFormComponent, LoginData } from '../../shared/components/login-form/login-form';
import { ButtonComponent } from '../../shared/components/button/button';
import { AuthService, User } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,        // ✅ Para ngIf
    ModalComponent,      // ✅ Para app-modal
    LoginFormComponent,  // ✅ Para app-login-form
    ButtonComponent      // ✅ Para app-button
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit {
  showModal = false;
  loginType: 'admin' | 'player' = 'admin';
  isLoading = false;
  errorMessage = '';
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.redirectUser(user);
      }
    });
  }

  openLogin(type: 'admin' | 'player'): void {
    this.loginType = type;
    this.showModal = true;
    this.errorMessage = '';
  }

  closeModal(): void {
    this.showModal = false;
    this.errorMessage = '';
    this.isLoading = false;
  }

  async onLogin(loginData: LoginData): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.loginType === 'admin' && loginData.email && loginData.password) {
        await this.authService.loginWithEmail(loginData.email, loginData.password);
      } else if (this.loginType === 'player' && loginData.phone) {
        await this.authService.loginWithPhone(loginData.phone);
      }
      this.closeModal();
    } catch (error: any) {
      this.errorMessage = error.message || 'Erro ao fazer login';
    } finally {
      this.isLoading = false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  // ✅ Tornar público para usar no template
  redirectUser(user: User): void {
    if (user.role === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/player']);
    }
  }
}