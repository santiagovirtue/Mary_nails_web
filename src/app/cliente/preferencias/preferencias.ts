import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MenuCuenta } from '../menu-cuenta/menu-cuenta';
import { FavoritosService } from '../../services/favoritos.service';

@Component({
  selector: 'app-preferencias',
  imports: [NgIf, FormsModule, RouterLink, MenuCuenta],
  templateUrl: './preferencias.html',
  styleUrl: './preferencias.css',
})
export class Preferencias implements OnInit {
  horario = 'tarde';
  notas = '';
  cargando = true;
  guardando = false;
  mensaje = '';
  error = false;

  constructor(
    private http: HttpClient,
    private favoritos: FavoritosService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    if (!this.favoritos.sesion()) {
      this.cargando = false;
      return;
    }
    this.http.get<any>('/api/perfil?correo=' + encodeURIComponent(this.favoritos.correo())).subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.leer(data.preferencias || '');
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.cargando = false;
          this.error = true;
          this.mensaje = 'No se pudieron cargar tus preferencias.';
          this.cdr.detectChanges();
        });
      },
    });
  }

  get haySesion(): boolean {
    return this.favoritos.sesion();
  }

  guardar(): void {
    this.guardando = true;
    this.mensaje = '';
    const preferencias = 'Horario preferido: ' + this.etiquetaHorario() + (this.notas.trim() ? '\n' + this.notas.trim() : '');
    this.http.get<any>('/api/perfil?correo=' + encodeURIComponent(this.favoritos.correo())).subscribe({
      next: (perfil) => {
        this.http.put('/api/perfil', {
          correo: perfil.correo,
          nombre: perfil.nombre,
          telefono: perfil.telefono,
          direccion: perfil.direccion,
          preferencias,
          foto_perfil: perfil.foto_perfil,
        }).subscribe({
          next: () => this.zone.run(() => {
            this.guardando = false;
            this.error = false;
            this.mensaje = 'Preferencias guardadas.';
            this.cdr.detectChanges();
          }),
          error: () => this.falloGuardado(),
        });
      },
      error: () => this.falloGuardado(),
    });
  }

  private etiquetaHorario(): string {
    if (this.horario === 'manana') return 'Mañana';
    if (this.horario === 'fin de semana') return 'Fin de semana';
    return 'Tarde';
  }

  private leer(texto: string): void {
    const primera = texto.split('\n')[0] || '';
    if (primera.includes('Mañana')) this.horario = 'manana';
    else if (primera.toLowerCase().includes('fin de semana')) this.horario = 'fin de semana';
    else this.horario = 'tarde';
    this.notas = texto.replace(/^Horario preferido:.*\n?/, '');
  }

  private falloGuardado(): void {
    this.zone.run(() => {
      this.guardando = false;
      this.error = true;
      this.mensaje = 'No se pudieron guardar las preferencias.';
      this.cdr.detectChanges();
    });
  }
}
