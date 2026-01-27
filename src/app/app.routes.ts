import { Routes } from '@angular/router';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { EstadosComponent } from '../features/estados/estados.component';
import { LoginComponent } from '../features/login/login.component';
import { authGuard } from '../core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'estados', component: EstadosComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
