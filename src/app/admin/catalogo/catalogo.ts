import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-catalogo-admin',
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class CatalogoAdmin implements OnInit {
  servicios: any[] = [];
  cargando = true;
  cambiandoId: number | null = null;
  mensaje = '';
  private iconos = ['💅', '✨', '🌸', '🎨', '💖', '🦋', '🌺', '💎'];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  ngOnInit(): void {
    this.http.get<any[]>('/api/servicios').subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.servicios = data || [];
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.servicios = [];
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  obtenerIcono(index: number): string {
    return this.iconos[index % this.iconos.length];
  }

  estaActivo(servicio: any): boolean {
    return String(servicio.estado || '').toLowerCase() === 'activo';
  }

  formatearDuracion(servicio: any): string {
    const min = servicio.duracion_minutos || servicio.duracion;
    if (!min) return 'Variable';
    return min + ' min';
  }

  formatearPrecio(servicio: any): string {
    const precio = Number(servicio.precio);
    if (!precio) return 'Consultar';
    return '$' + precio.toLocaleString('es-CO');
  }

  idDe(servicio: any): number {
    return Number(servicio.id_servicio || servicio.id);
  }

  cambiarEstado(servicio: any): void {
    const id = this.idDe(servicio);
    this.cambiandoId = id;
    this.mensaje = '';
    this.http.patch<{ estado: string }>('/api/servicios/' + id + '/estado', {}).subscribe({
      next: (respuesta) => {
        this.zone.run(() => {
          servicio.estado = respuesta.estado;
          this.cambiandoId = null;
          this.mensaje = this.estaActivo(servicio)
            ? servicio.nombre + ' quedó visible en el catálogo del cliente.'
            : servicio.nombre + ' quedó oculto para los clientes.';
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.cambiandoId = null;
          this.mensaje = 'No se pudo cambiar el estado de ' + servicio.nombre + '.';
          this.cdr.detectChanges();
        });
      },
    });
  }
}
