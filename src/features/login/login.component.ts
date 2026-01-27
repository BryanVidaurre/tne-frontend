import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth.service';
import { ApiService, EstadoPublico } from '../../core/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSnackBarModule,
  ],
})
export class LoginComponent {
  user = '';
  pass = '';
  loginBusy = false;
  loginError = '';

  rut = '';
  periodo = new Date().getFullYear();
  publicBusy = false;
  publicError = '';
  publicData: EstadoPublico | null = null;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    if (this.auth.isLoggedIn) {
      this.router.navigate(['/']);
    }
  }

  async onLogin() {
    this.loginError = '';
    if (!this.user || !this.pass) {
      this.loginError = 'Completa usuario y contraseña.';
      return;
    }

    this.loginBusy = true;
    try {
      await firstValueFrom(this.auth.login(this.user.trim(), this.pass));
      this.snackBar.open('Sesión iniciada.', 'Cerrar', { duration: 3000 });
      await this.router.navigate(['/']);
    } catch (e: any) {
      this.loginError = this.errMsg(e);
    } finally {
      this.loginBusy = false;
    }
  }

  async onPublicQuery() {
    this.publicError = '';
    this.publicData = null;

    const rutClean = this.rut.replace(/\D/g, '');
    if (!rutClean) {
      this.publicError = 'Ingresa un RUT válido.';
      return;
    }

    this.publicBusy = true;
    try {
      this.publicData = await firstValueFrom(this.api.estadoPublico(rutClean, this.periodo));
      if (!this.publicData) {
        this.publicError = 'Sin respuesta del servidor.';
      }
    } catch (e: any) {
      this.publicError = this.errMsg(e);
    } finally {
      this.publicBusy = false;
    }
  }

  private errMsg(e: any): string {
    const m = e?.error?.message || e?.message || 'Error';
    if (Array.isArray(m)) return m.join(', ');
    return String(m);
  }
}
