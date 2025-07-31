import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';
import { PlayerDashboardComponent } from './features/player/player-dashboard/player-dashboard';
import { AuthGuard } from './core/guards/auth-guard';
import { AdminGuard } from './core/guards/admin-guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { 
    path: 'admin', 
    component: AdminDashboardComponent
    // canActivate: [AuthGuard, AdminGuard] 
  },
  { 
    path: 'player', 
    component: PlayerDashboardComponent
    // canActivate: [AuthGuard] 
  },
  { path: '**', redirectTo: '' }
];