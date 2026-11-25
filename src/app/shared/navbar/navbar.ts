import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, NgIf],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  menuAbierto = false;

  constructor(private router: Router) {}

  alternarMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarMenu(): void {
    this.menuAbierto = false;
  }

  private obtenerSesion(clave: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(clave);
  }

  get clienteLogueado(): boolean {
    return this.obtenerSesion('maryNailsClienteSesion') === 'true';
  }

  get adminLogueado(): boolean {
    return this.obtenerSesion('maryNailsAdminSesion') === 'true';
  }

  get sinSesion(): boolean {
    return !this.clienteLogueado && !this.adminLogueado;
  }

  get haySesionActiva(): boolean {
    return this.clienteLogueado || this.adminLogueado;
  }

  cerrarSesion(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('maryNailsClienteSesion');
      localStorage.removeItem('maryNailsClienteUsuario');
      localStorage.removeItem('maryNailsAdminSesion');
      localStorage.removeItem('maryNailsAdminUsuario');
    }
    this.router.navigate(['/']);
  }
}
