import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-contacto',
  imports: [NgIf, FormsModule],
  templateUrl: './contacto.html',
  styleUrl: './contacto.css',
})
export class Contacto {
  nombre = '';
  correo = '';
  telefono = '';
  asunto = '';
  mensaje = '';
  mensajeExito = '';
  mensajeError = '';
  enviando = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private zone: NgZone) {}

  enviarMensaje(): void {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.nombre.trim() || !this.correo.trim() || !this.asunto || !this.mensaje.trim()) {
      this.mensajeError = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    this.enviando = true;
    this.http.post('/api/mensajes', {
      nombre: this.nombre,
      correo: this.correo,
      telefono: this.telefono,
      asunto: this.asunto,
      mensaje: this.mensaje,
    }).subscribe({
      next: () => {
        this.zone.run(() => {
          this.enviando = false;
          this.mensajeExito = 'Tu mensaje fue enviado. Mary Nails lo verá en el panel de administración.';
          this.nombre = '';
          this.correo = '';
          this.telefono = '';
          this.asunto = '';
          this.mensaje = '';
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.enviando = false;
          this.mensajeError = 'No se pudo enviar el mensaje. Inténtalo de nuevo.';
          this.cdr.detectChanges();
        });
      },
    });
  }
}
