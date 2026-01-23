import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
export type ProcesoRow = {
  periodo: number;
  rut_num: number;
  fecha_pago?: string | null;
  tipo_alumno?: string | null;

  estado_final?: string | null;
  pendiente?: string | null;

  proceso_junaeb?: string | null;
  estado_junaeb?: string | null;
  motivo_rechazo?: string | null;
  numero_ot?: string | null;

  fecha_inscripcion?: string | null;
  fecha_atencion?: string | null;
  fecha_entrega_u?: string | null;

  lista_retiro?: number | null;
  retiro_confirmado?: number | null;
  con_huella?: number | null;

  fecha_retiro?: string | null;
  medio_ingreso?: string | null;

  updated_at?: string | null;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  uploadExcel(
    tipo: 'pagos' | 'matricula' | 'junaeb' | 'invitados' | 'asistentes',
    periodo: number,
    file: File,
  ) {
    const form = new FormData();
    form.append('file', file);

    const params = new HttpParams().set('periodo', String(periodo));
    return this.http.post(`${this.base}/import/${tipo}`, form, { params });
  }

  recalcular(periodo: number) {
    const params = new HttpParams().set('periodo', String(periodo));
    return this.http.get(`${this.base}/proceso/recalcular`, { params });
  }

  listarEstados(periodo: number, estado?: string): Observable<ProcesoRow[]> {
    let params = new HttpParams().set('periodo', String(periodo));
    if (estado && estado !== 'TODOS') params = params.set('estado', estado);
    return this.http.get<ProcesoRow[]>(`${this.base}/proceso`, { params });
  }

  enviarCorreos(periodo: number) {
    const params = new HttpParams().set('periodo', String(periodo));
    return this.http.post(`${this.base}/notificaciones/enviar`, null, { params });
  }
}
