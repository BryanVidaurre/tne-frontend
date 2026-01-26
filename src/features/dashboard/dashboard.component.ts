import { Component } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

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
  templateUrl: './dashboard.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  periodo = new Date().getFullYear();

  results: Array<{ tipo: string; ok: boolean; message: string }> = [];
  files: Partial<Record<UploadTipo, File>> = {};
  fileErrors: Partial<Record<UploadTipo, string>> = {};
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
      'OBSERVACION',
    ],
    invitados: ['EVENTO', 'RUT', 'NOMBRE', 'CON HUELLA DIGITAL'],
    asistentes: ['EVENTO', 'RUT', 'NOMBRE', 'CON HUELLA DIGITAL', 'MEDIO INGRESO', 'FECHA'],
  };

  // Estados de UI
  busy: Partial<Record<ActionKey, boolean>> = {};
  statusText: Partial<Record<ActionKey, string>> = {};
  alert: UiAlert | null = null;

  constructor(private api: ApiService) {}

  async onFile(tipo: UploadTipo, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) {
      const validationError = await this.validateExcelFile(tipo, f);
      if (validationError) {
        delete this.files[tipo];
        this.fileErrors[tipo] = validationError;
        input.value = '';
        this.pushResult(tipo, false, validationError);
        this.setAlert('warning', validationError);
        return;
      }

      this.files[tipo] = f;
      this.fileErrors[tipo] = '';
      this.setAlert('success', `Archivo cargado: ${this.pretty(tipo)} (${f.name})`);
    }
  }

  isBusy(...keys: ActionKey[]) {
    return keys.some((k) => !!this.busy[k]);
  }

  private start(key: ActionKey, text: string) {
    this.busy[key] = true;
    this.statusText[key] = text;
    this.setAlert('info', text);
  }

  private end(key: ActionKey) {
    this.busy[key] = false;
    this.statusText[key] = '';
  }

  private setAlert(type: AlertType, text: string) {
    this.alert = { type, text };
    // opcional: auto-cerrar
    window.clearTimeout((this as any).__alertTimer);
    (this as any).__alertTimer = window.setTimeout(() => (this.alert = null), 3500);
  }

  private pushResult(tipo: string, ok: boolean, message: string) {
    this.results.unshift({ tipo, ok, message });
  }

  private errMsg(e: any): string {
    const m = e?.error?.message || e?.message || 'Error';
    if (Array.isArray(m)) return m.join(', ');
    return String(m);
  }

  private pretty(t: string) {
    const map: Record<string, string> = {
      matricula: 'Matrícula',
      pagos: 'Pagos',
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

  async upload(tipo: UploadTipo) {
    const file = this.files[tipo];
    const validationError = this.fileErrors[tipo];
    if (!file) {
      this.pushResult(tipo, false, 'Selecciona un archivo primero.');
      this.setAlert('warning', `Falta archivo: ${this.pretty(tipo)}`);
      return;
    }
    if (validationError) {
      this.pushResult(tipo, false, validationError);
      this.setAlert('warning', validationError);
      return;
    }

    this.start(tipo, `Subiendo ${this.pretty(tipo)}...`);
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
    const orden: UploadTipo[] = ['matricula', 'pagos', 'junaeb', 'invitados', 'asistentes'];

    if (!this.files['pagos']) {
      this.pushResult('subir_todo', false, 'Falta el archivo de PAGOS.');
      this.setAlert('warning', 'Falta el archivo de PAGOS.');
      return;
    }
    if (this.fileErrors['pagos']) {
      const msg = this.fileErrors['pagos'] as string;
      this.pushResult('subir_todo', false, msg);
      this.setAlert('warning', msg);
      return;
    }

    this.start('subir_todo', 'Subiendo archivos (secuencial)...');
    try {
      for (const tipo of orden) {
        const file = this.files[tipo];
        if (!file) continue;
        if (this.fileErrors[tipo]) {
          const msg = this.fileErrors[tipo] as string;
          this.pushResult(tipo, false, msg);
          this.setAlert('warning', msg);
          continue;
        }

        this.start(tipo, `Subiendo ${this.pretty(tipo)}...`);
        try {
          const res = await firstValueFrom(this.api.uploadExcel(tipo, this.periodo, file));
          this.pushResult(tipo, true, JSON.stringify(res));
          this.setAlert('success', `${this.pretty(tipo)} subido correctamente.`);
        } finally {
          this.end(tipo);
        }
      }

      await this.recalcular(); // ya maneja su propio feedback
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

  private async validateExcelFile(tipo: UploadTipo, file: File): Promise<string | null> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return `El archivo de ${this.pretty(tipo)} debe ser un .xlsx.`;
    }

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
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as Array<
        Array<string | number | null>
      >;

      const headerRow = rows.find((row) => row && row.length > 0) ?? [];
      const headers = headerRow
        .map((value) => this.normalizeHeader(value))
        .filter((value) => value.length > 0);

      if (headers.length === 0) {
        return `El archivo de ${this.pretty(tipo)} no tiene encabezados válidos.`;
      }

      const requiredLabels = this.requiredHeaders[tipo];
      const expected = requiredLabels.map((col) => this.normalizeHeader(col));
      const missing = requiredLabels.filter(
        (label, index) => !headers.includes(expected[index]),
      );

      if (missing.length > 0) {
        return `El archivo de ${this.pretty(tipo)} no tiene las columnas requeridas: ${missing.join(
          ', ',
        )}.`;
      }

      return null;
    } catch (error) {
      console.error('Error leyendo Excel', error);
      return `No se pudo leer el archivo de ${this.pretty(tipo)}. Verifica que sea un Excel válido.`;
    }
  }

  private normalizeHeader(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[()\.]/g, '')
      .trim();
  }
}
