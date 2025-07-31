// 3. src/app/core/guards/admin.guard.ts (CORRIGIDO)
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.authService.isAdmin().pipe(
      take(1),
      tap(isAdmin => {
        console.log('🛡️ AdminGuard - É admin?', isAdmin); // Debug
        if (!isAdmin) {
          console.log('🚫 Acesso negado - redirecionando para home'); // Debug
          this.router.navigate(['/']);
        }
      }),
      map(isAdmin => isAdmin)
    );
  }
}