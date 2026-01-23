import { Component } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

type UploadTipo = 'pagos' | 'matricula' | 'junaeb' | 'invitados' | 'asistentes';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  periodo = new Date().getFullYear();
  loading = false;

  results: Array<{ tipo: string; ok: boolean; message: string }> = [];

  files: Partial<Record<UploadTipo, File>> = {};

  constructor(private api: ApiService) {}

  onFile(tipo: UploadTipo, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.files[tipo] = f;
  }

  async upload(tipo: UploadTipo) {
    const file = this.files[tipo];
    if (!file) {
      this.pushResult(tipo, false, 'Selecciona un archivo primero.');
      return;
    }

    this.loading = true;
    try {
      const res: any = await this.api.uploadExcel(tipo, this.periodo, file).toPromise();
      this.pushResult(tipo, true, JSON.stringify(res));
    } catch (e: any) {
      this.pushResult(tipo, false, this.errMsg(e));
    } finally {
      this.loading = false;
    }
  }

  async recalcular() {
    this.loading = true;
    try {
      const res: any = await this.api.recalcular(this.periodo).toPromise();
      this.pushResult('recalcular', true, JSON.stringify(res));
    } catch (e: any) {
      this.pushResult('recalcular', false, this.errMsg(e));
    } finally {
      this.loading = false;
    }
  }

  async enviarCorreos() {
    this.loading = true;
    try {
      const res: any = await this.api.enviarCorreos(this.periodo).toPromise();
      this.pushResult('enviar', true, JSON.stringify(res));
    } catch (e: any) {
      this.pushResult('enviar', false, this.errMsg(e));
    } finally {
      this.loading = false;
    }
  }

  private pushResult(tipo: string, ok: boolean, message: string) {
    this.results.unshift({ tipo, ok, message });
  }

  private errMsg(e: any): string {
    const m = e?.error?.message || e?.message || 'Error';
    if (Array.isArray(m)) return m.join(', ');
    return String(m);
  }

  async subirTodoYCalcular() {
  const orden: Array<'matricula'|'pagos'|'junaeb'|'invitados'|'asistentes'> =
    ['matricula','pagos','junaeb','invitados','asistentes'];

  // Validación mínima (pagos es obligatorio)
  if (!this.files['pagos']) {
    this.pushResult('subir_todo', false, 'Falta el archivo de PAGOS.');
    return;
  }

  this.loading = true;
  try {
    for (const tipo of orden) {
      const file = this.files[tipo];
      if (!file) continue; // permite omitir algunos

      const res = await firstValueFrom(this.api.uploadExcel(tipo, this.periodo, file));
      this.pushResult(tipo, true, JSON.stringify(res));
    }

    const recal = await firstValueFrom(this.api.recalcular(this.periodo));
    this.pushResult('recalcular', true, JSON.stringify(recal));
  } catch (e: any) {
    this.pushResult('subir_todo', false, this.errMsg(e));
  } finally {
    this.loading = false;
  }
}
}
