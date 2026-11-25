import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-mensajes-admin',
  imports: [NgFor, NgIf, DatePipe],
  templateUrl: './mensajes.html',
  styleUrl: './mensajes.css',
})
export class MensajesAdmin implements OnInit {
  mensajes: any[] = [];
  cargando = true;
  aviso = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.http.get<any[]>('/api/mensajes').subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.mensajes = data || [];
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.cargando = false;
          this.aviso = 'No se pudieron cargar los mensajes.';
          this.cdr.detectChanges();
        });
      },
    });
  }

  marcarLeido(mensaje: any): void {
    this.http.patch('/api/mensajes/' + mensaje.id_mensaje + '/leido', {}).subscribe({
      next: () => {
        this.zone.run(() => {
          mensaje.leido = 1;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.aviso = 'No se pudo marcar el mensaje.';
          this.cdr.detectChanges();
        });
      },
    });
  }
}
