import { ChangeDetectorRef, Component } from '@angular/core';
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
  private parsedRutBase: string | null = null;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {
    if (this.auth.isLoggedIn) {
      this.router.navigate(['/']);
    }
  }

  async onLogin() {
    this.loginError = '';
    if (!this.user || !this.pass) {
      this.loginError = 'Completa usuario y contrasena.';
      return;
    }

    this.loginBusy = true;
    try {
      await firstValueFrom(this.auth.login(this.user.trim(), this.pass));
      this.snackBar.open('Sesion iniciada.', 'Cerrar', { duration: 3000 });
      await this.router.navigate(['/']);
    } catch (e: any) {
      this.loginError = this.errMsg(e);
    } finally {
      this.loginBusy = false;
    }
  }

  async onPublicQuery() {
    if (!this.parsedRutBase) {
      this.publicError = 'Ingresa un RUT valido (sin puntos y con guion).';
      this.cdr.markForCheck();
      return;
    }

    this.publicError = '';
    this.publicData = null;

    this.publicBusy = true;
    try {
      this.publicData = await firstValueFrom(this.api.estadoPublico(this.parsedRutBase, this.periodo));
      if (!this.publicData) {
        this.publicError = 'Sin respuesta del servidor.';
      }
    } catch (e: any) {
      this.publicError = this.errMsg(e);
    } finally {
      this.publicBusy = false;
      this.cdr.markForCheck();
    }
  }

  onRutChange(value: string) {
    const cleaned = value
      .toUpperCase()
      .replace(/[^0-9K]/g, '')
      .slice(0, 9);

    this.rut = this.formatRut(cleaned);
    this.publicData = null;
    this.parsedRutBase = null;

    // Valida solo cuando el usuario termina de ingresar (7/8 digitos + DV).
    if (cleaned.length < 8) {
      this.publicError = '';
      return;
    }

    const parsedRut = this.parseChileanRut(this.rut);
    if (!parsedRut.ok) {
      this.publicError = parsedRut.error;
      return;
    }

    this.parsedRutBase = parsedRut.base;
    this.publicError = '';
  }

  private formatRut(cleaned: string): string {
    if (cleaned.length < 8) return cleaned;
    return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
  }

  private parseChileanRut(rut: string): { ok: true; base: string } | { ok: false; error: string } {
    const value = rut.trim().toUpperCase();
    const match = /^(\d{7,8})-([\dK])$/.exec(value);

    if (!match) {
      return {
        ok: false,
        error: 'Ingresa el RUT sin puntos y con guion. Ej: 20348255-8',
      };
    }

    const base = match[1];
    const dv = match[2];
    const expectedDv = this.computeRutDv(base);

    if (dv !== expectedDv) {
      return {
        ok: false,
        error: 'Digito verificador invalido para el RUT ingresado.',
      };
    }

    return { ok: true, base };
  }

  private computeRutDv(base: string): string {
    let sum = 0;
    let multiplier = 2;

    for (let i = base.length - 1; i >= 0; i--) {
      sum += Number(base[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const mod = 11 - (sum % 11);
    if (mod === 11) return '0';
    if (mod === 10) return 'K';
    return String(mod);
  }

  private errMsg(e: any): string {
    const m = e?.error?.message || e?.message || 'Error';
    if (Array.isArray(m)) return m.join(', ');
    return String(m);
  }
}
