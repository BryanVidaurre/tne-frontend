import { Routes } from '@angular/router';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { EstadosComponent } from '../features/estados/estados.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'estados', component: EstadosComponent },
];
