import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MenuCuenta } from '../menu-cuenta/menu-cuenta';
import { FavoritosService } from '../../services/favoritos.service';

@Component({
  selector: 'app-favoritos',
  imports: [NgFor, NgIf, RouterLink, MenuCuenta],
  templateUrl: './favoritos.html',
  styleUrl: './favoritos.css',
})
export class Favoritos implements OnInit {
  servicios: any[] = [];
  cargando = true;

  constructor(
    private http: HttpClient,
    private favoritos: FavoritosService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    if (!this.favoritos.sesion()) {
      this.cargando = false;
      return;
    }
    this.http.get<any[]>('/api/servicios/activos').subscribe({
      next: (data) => {
        this.zone.run(() => {
          const ids = this.favoritos.ids();
          this.servicios = (data || []).filter((servicio) => ids.includes(Number(servicio.id_servicio)));
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

  get haySesion(): boolean {
    return this.favoritos.sesion();
  }

  quitar(id: number): void {
    this.favoritos.alternar(id);
    this.servicios = this.servicios.filter((servicio) => Number(servicio.id_servicio) !== Number(id));
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }

  formatearPrecio(servicio: any): string {
    const precio = Number(servicio.precio);
    if (!precio) return 'Consultar';
    return '$' + precio.toLocaleString('es-CO');
  }
}
