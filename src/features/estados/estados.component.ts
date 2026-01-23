import { Component } from '@angular/core';
import { ApiService, ProcesoRow } from '../../core/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-estados',
  templateUrl: './estados.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./estados.component.scss'],
})
export class EstadosComponent {
  periodo = new Date().getFullYear();
  estado = 'TODOS';
  loading = false;

  rows: ProcesoRow[] = [];

  estados = [
    'TODOS',
    'RETIRADA',
    'LISTA_RETIRO_U',
    'RECHAZADA',
    'EN_PROCESO_FOTO',
    'EN_PROCESO_REVALIDACION',
    'SIN_REGISTRO_JUNAEB',
  ];

  constructor(private api: ApiService) {}

  async cargar() {
    this.loading = true;
    try {
      this.rows = await firstValueFrom(this.api.listarEstados(this.periodo, this.estado));
    } finally {
      this.loading = false;
    }
  }

  rutDisplay(rut_num: number) {
    return String(rut_num);
  }
}
