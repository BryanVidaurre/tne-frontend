// dashboard.component.ts
import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

declare const XLSX: {
  read(data: ArrayBuffer, opts: { type: string }): { SheetNames: string[]; Sheets: any };
  utils: { sheet_to_json: (sheet: any, opts: { header: number; blankrows: boolean }) => any };
};

type UploadTipo = 'pagos' | 'matricula' | 'junaeb' | 'invitados' | 'asistentes';
type ActionKey = UploadTipo | 'recalcular' | 'enviar' | 'descargar' | 'subir_todo';

type AlertType = 'info' | 'success' | 'warning' | 'danger';
type UiAlert = { type: AlertType; text: string };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    CommonModule,
    FormsModule,

    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
})
export class DashboardComponent {
  periodo = new Date().getFullYear();
  currentYear = new Date().getFullYear();

  readonly tipos: UploadTipo[] = ['matricula', 'pagos', 'junaeb', 'invitados', 'asistentes'];

  results: Array<{ tipo: string; ok: boolean; message: string }> = [];
  files: Partial<Record<UploadTipo, File>> = {};
  fileErrors: Partial<Record<UploadTipo, string>> = {};
  uploadAttempts: Partial<Record<UploadTipo, number>> = {};

  readonly requiredHeaders: Record<UploadTipo, string[]> = {
    pagos: ['RUT', 'NOMBRE', 'FECHA DE PAGO', 'TIPO ALUMNO'],
    matricula: ['PER_NRUT', 'PER_DRUT', 'PNA_NOM', 'PNA_APAT', 'PNA_AMAT', 'PER_EMAIL'],
    junaeb: [
      'PERIODO',
      'PROCESO',
      'RUN',
      'DV_RUN',
      'ESTADO_TNE',
      'MOTIVO_RECHAZO',
      'FECHA_INSCRIPCION',
      'FECHA_ATENCION',
      'FECHA_ENTREGA',
      'NUMERO_OT',
      'FOLIO_ENTREGA',
    ],
    invitados: ['EVENTO', 'RUT', 'NOMBRE', 'CON HUELLA DIGITAL'],
    asistentes: ['EVENTO', 'RUT', 'NOMBRE', 'CON HUELLA DIGITAL', 'MEDIO INGRESO', 'FECHA'],
  };

  busy: Partial<Record<ActionKey, boolean>> = {};
  statusText: Partial<Record<ActionKey, string>> = {};
  alert: UiAlert | null = null;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  // ---------------- UI helpers (garantiza repaint inmediato) ----------------
  private ui(fn: () => void) {
    this.zone.run(() => {
      fn();
      this.cdr.markForCheck();
    });
  }

  isBusy(...keys: ActionKey[]) {
    return keys.some((k) => !!this.busy[k]);
  }

  private start(key: ActionKey, text: string) {
    this.ui(() => {
      this.busy[key] = true;
      this.statusText[key] = text;
    });
    this.setAlert('info', text);
  }

  private end(key: ActionKey) {
    this.ui(() => {
      this.busy[key] = false;
      this.statusText[key] = '';
    });
  }

  private setAlert(type: AlertType, text: string) {
    this.ui(() => {
      this.alert = { type, text };
    });

    const panelClass =
      type === 'success'
        ? 'snack-success'
        : type === 'danger'
          ? 'snack-danger'
          : type === 'warning'
            ? 'snack-warning'
            : 'snack-info';

    this.snackBar.open(text, 'Cerrar', {
      duration: 3500,
      panelClass,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  private pushResult(tipo: string, ok: boolean, message: string) {
    this.ui(() => {
      this.results.unshift({ tipo, ok, message });
    });
  }

  private errMsg(e: any): string {
    const m = e?.error?.message || e?.message || 'Error';
    if (Array.isArray(m)) return m.join(', ');
    return String(m);
  }

  pretty(t: string) {
    const map: Record<string, string> = {
      matricula: 'Matrícula',
      pagos: 'Pagos Sello/Fotografia',
      junaeb: 'JUNAEB',
      invitados: 'Invitados',
      asistentes: 'Asistentes',
      recalcular: 'Recalcular',
      enviar: 'Enviar correos',
      descargar: 'Descargar reporte',
      subir_todo: 'Subir todo',
    };
    return map[t] ?? t;
  }

  getFile(tipo: UploadTipo): File | undefined {
    return this.files[tipo];
  }
  getFileName(tipo: UploadTipo): string {
    return this.files[tipo]?.name ?? '';
  }
  getFileError(tipo: UploadTipo): string {
    return this.fileErrors[tipo] ?? '';
  }
  getRequiredHeaders(tipo: UploadTipo): string[] {
    return this.requiredHeaders[tipo];
  }
  isTipoBusy(tipo: UploadTipo): boolean {
    return !!this.busy[tipo];
  }
  isUploadingBlocked(tipo: UploadTipo): boolean {
    return this.isBusy('subir_todo') || !!this.busy[tipo];
  }
  // ---------------------------------------------------------------------------

  async onFile(tipo: UploadTipo, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;

    const validationError = await this.validateExcelFile(tipo, f);
    if (validationError) {
      this.ui(() => {
        delete this.files[tipo];
        this.fileErrors[tipo] = validationError;
      });
      input.value = '';
      this.pushResult(tipo, false, validationError);
      this.setAlert('warning', validationError);
      return;
    }

    this.ui(() => {
      this.files[tipo] = f;
      this.fileErrors[tipo] = '';
      this.uploadAttempts[tipo] = 0;
    });
    this.setAlert('success', `Archivo cargado: ${this.pretty(tipo)} (${f.name})`);
  }

  clearFile(tipo: UploadTipo, input?: HTMLInputElement) {
    this.ui(() => {
      delete this.files[tipo];
      this.fileErrors[tipo] = '';
      this.uploadAttempts[tipo] = 0;
    });
    if (input) input.value = '';
  }

  async upload(tipo: UploadTipo) {
    const file = this.files[tipo];
    if (!file) {
      this.pushResult(tipo, false, 'Selecciona un archivo primero.');
      this.setAlert('warning', `Falta archivo: ${this.pretty(tipo)}`);
      return;
    }

    const canUpload = await this.validateBeforeUpload(tipo, file);
    if (!canUpload) return;

    this.start(tipo, `Subiendo ${this.pretty(tipo)}...`);
    await Promise.resolve(); // permite repintar inmediatamente (spinner/pill)

    try {
      const res = await firstValueFrom(this.api.uploadExcel(tipo, this.periodo, file));
      this.pushResult(tipo, true, JSON.stringify(res));
      this.setAlert('success', `${this.pretty(tipo)} subido correctamente.`);
    } catch (e: any) {
      const msg = this.errMsg(e);
      this.pushResult(tipo, false, msg);
      this.setAlert('danger', `Error al subir ${this.pretty(tipo)}: ${msg}`);
    } finally {
      this.end(tipo);
    }
  }

  async recalcular() {
    this.start('recalcular', 'Recalculando estado...');
    await Promise.resolve();

    try {
      const res = await firstValueFrom(this.api.recalcular(this.periodo));
      this.pushResult('recalcular', true, JSON.stringify(res));
      this.setAlert('success', 'Recalculo completado.');
    } catch (e: any) {
      const msg = this.errMsg(e);
      this.pushResult('recalcular', false, msg);
      this.setAlert('danger', `Error al recalcular: ${msg}`);
    } finally {
      this.end('recalcular');
    }
  }

  async enviarCorreos() {
    this.start('enviar', 'Enviando correos...');
    await Promise.resolve();

    try {
      const res = await firstValueFrom(this.api.enviarCorreos(this.periodo));
      this.pushResult('enviar', true, JSON.stringify(res));
      this.setAlert('success', 'Envío de correos iniciado/finalizado correctamente.');
    } catch (e: any) {
      const msg = this.errMsg(e);
      this.pushResult('enviar', false, msg);
      this.setAlert('danger', `Error al enviar correos: ${msg}`);
    } finally {
      this.end('enviar');
    }
  }

  async subirTodoYCalcular() {
    const orden: UploadTipo[] = [
      'matricula',
      'pagos',
      'junaeb',
      'invitados',
      'asistentes',
    ];

    if (!this.files['pagos']) {
      this.pushResult('subir_todo', false, 'Falta el archivo de PAGOS.');
      this.setAlert('warning', 'Falta el archivo de PAGOS.');
      return;
    }

    const pagosFile = this.files['pagos'];
    if (pagosFile) {
      const canUpload = await this.validateBeforeUpload('pagos', pagosFile);
      if (!canUpload) return;
    }

    this.start('subir_todo', 'Subiendo archivos (secuencial)...');
    await Promise.resolve();

    try {
      for (const tipo of orden) {
        const file = this.files[tipo];
        if (!file) continue;

        const canUpload = await this.validateBeforeUpload(tipo, file);
        if (!canUpload) continue;

        this.start(tipo, `Subiendo ${this.pretty(tipo)}...`);
        await Promise.resolve();

        try {
          const res = await firstValueFrom(this.api.uploadExcel(tipo, this.periodo, file));
          this.pushResult(tipo, true, JSON.stringify(res));
          this.setAlert('success', `${this.pretty(tipo)} subido correctamente.`);
        } catch (e: any) {
          const msg = this.errMsg(e);
          this.pushResult(tipo, false, msg);
          this.setAlert('danger', `Error al subir ${this.pretty(tipo)}: ${msg}`);
        } finally {
          this.end(tipo);
        }
      }

      await this.recalcular();
      this.setAlert('success', 'Proceso completo: subir + recalcular.');
    } catch (e: any) {
      const msg = this.errMsg(e);
      this.pushResult('subir_todo', false, msg);
      this.setAlert('danger', `Error en subida total: ${msg}`);
    } finally {
      this.end('subir_todo');
    }
  }

  async descargarReporte() {
    this.start('descargar', 'Generando y descargando reporte...');
    await Promise.resolve();

    try {
      const blob = await firstValueFrom(this.api.descargarReporte(this.periodo));

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TNE_${this.periodo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      this.pushResult('descargar', true, 'Reporte descargado.');
      this.setAlert('success', 'Reporte descargado.');
    } catch (e: any) {
      const msg = this.errMsg(e);
      this.pushResult('descargar', false, msg);
      this.setAlert('danger', `Error al descargar reporte: ${msg}`);
    } finally {
      this.end('descargar');
    }
  }

  private async validateBeforeUpload(tipo: UploadTipo, file: File): Promise<boolean> {
    const attempt = (this.uploadAttempts[tipo] ?? 0) + 1;
    this.ui(() => {
      this.uploadAttempts[tipo] = attempt;
    });

    const { missing, error } = await this.checkExcelHeaders(tipo, file);
    if (error) {
      this.ui(() => {
        this.fileErrors[tipo] = error;
      });
      this.pushResult(tipo, false, error);
      this.setAlert('warning', error);
      return false;
    }

    if (missing.length > 0) {
      const message =
        attempt >= 2
          ? `El archivo de ${this.pretty(tipo)} no tiene las columnas requeridas: ${missing.join(', ')}.`
          : `El archivo de ${this.pretty(
              tipo,
            )} no cumple la estructura requerida. Intenta subir nuevamente para ver las columnas faltantes.`;
      this.ui(() => {
        this.fileErrors[tipo] = message;
      });
      this.pushResult(tipo, false, message);
      this.setAlert('warning', message);
      return false;
    }

    this.ui(() => {
      this.fileErrors[tipo] = '';
    });
    return true;
  }

  private async checkExcelHeaders(
    tipo: UploadTipo,
    file: File,
  ): Promise<{ missing: string[]; error: string | null }> {
    try {
      if (typeof XLSX === 'undefined') {
        return { missing: [], error: `No está disponible el lector de Excel en el navegador.` };
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        return { missing: [], error: `El archivo de ${this.pretty(tipo)} no tiene hojas.` };
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as Array<
        Array<string | number | null>
      >;

      const required = this.requiredHeaders[tipo].map((h) => this.normalizeHeader(h));

      const headerRow =
        rows.find((row) => {
          const hs = (row || []).map((c) => this.normalizeHeader(c));
          return required.some((r) => hs.includes(r));
        }) ?? [];

      const headers = headerRow
        .map((value) => this.normalizeHeader(value))
        .filter((value) => value.length > 0);

      if (headers.length === 0) {
        return { missing: [], error: `El archivo de ${this.pretty(tipo)} no tiene encabezados válidos.` };
      }

      const requiredLabels = this.requiredHeaders[tipo];
      const requiredNorm = requiredLabels.map((c) => this.normalizeHeader(c));
      const headerSet = new Set(headers);

      const missing = requiredLabels.filter((label, i) => !headerSet.has(requiredNorm[i]));
      return { missing, error: null };
    } catch (error) {
      console.error('Error leyendo Excel', error);
      return {
        missing: [],
        error: `No se pudo leer el archivo de ${this.pretty(tipo)}. Verifica que sea un Excel válido.`,
      };
    }
  }

  private async validateExcelFile(tipo: UploadTipo, file: File): Promise<string | null> {
    try {
      if (typeof XLSX === 'undefined') {
        return `No está disponible el lector de Excel en el navegador.`;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        return `El archivo de ${this.pretty(tipo)} no tiene hojas.`;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as any[][];

      if (!rows || rows.length === 0) {
        return `El archivo de ${this.pretty(tipo)} está vacío.`;
      }

      const requiredLabels = this.requiredHeaders[tipo];
      const requiredNorm = requiredLabels.map((h) => this.normalizeHeader(h));

      const headerRow =
        rows.find((row) => {
          const hs = (row || []).map((c) => this.normalizeHeader(c));
          return requiredNorm.some((r) => hs.includes(r));
        }) ?? [];

      if (!headerRow.length) {
        return `No se encontró la fila de encabezados para ${this.pretty(tipo)}.`;
      }

      const headers = headerRow
        .map((value) => this.normalizeHeader(value))
        .filter((h) => h.length > 0);

      if (headers.length === 0) {
        return `El archivo de ${this.pretty(tipo)} no tiene encabezados válidos.`;
      }

      const headerSet = new Set(headers);
      const missing = requiredLabels.filter((label, i) => !headerSet.has(requiredNorm[i]));

      if (missing.length > 0) {
        return `El archivo de ${this.pretty(tipo)} no tiene las columnas requeridas: ${missing.join(', ')}.`;
      }

      return null;
    } catch (error) {
      console.error('Error leyendo Excel', error);
      return `No se pudo leer el archivo de ${this.pretty(tipo)}. Verifica que sea un Excel válido.`;
    }
  }

  private normalizeHeader(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[()\.]/g, '')
      .trim();
  }
}
