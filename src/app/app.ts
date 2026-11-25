import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { filter } from 'rxjs';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';

const SITIO = 'https://marynailsweb-production.up.railway.app';
const PAGINAS: Record<string, { titulo: string; descripcion: string }> = {
  '/': {
    titulo: 'Mary Nails | Manicure y pedicure en Soacha',
    descripcion: 'Estudio de uñas en Soacha. Manicure, pedicure y diseños en semipermanente. Reserva tu cita en línea, de lunes a sábado.',
  },
  '/servicios': {
    titulo: 'Servicios | Mary Nails',
    descripcion: 'Manicure, pedicure y diseños en semipermanente. Consulta precios y aparta tu cita en Mary Nails.',
  },
  '/galeria': {
    titulo: 'Galería | Mary Nails',
    descripcion: 'Trabajos reales de Mary Nails: baby boomer, efecto perla, semipermanente y pedicura.',
  },
  '/reservas': {
    titulo: 'Reservar cita | Mary Nails',
    descripcion: 'Elige servicio, fecha y hora. Reserva tu cita en el estudio de uñas Mary Nails, en Soacha.',
  },
  '/contacto': {
    titulo: 'Contacto | Mary Nails',
    descripcion: 'Escríbenos o reserva por WhatsApp. Mary Nails atiende en Soacha de lunes a sábado, de 9:00 a. m. a 6:00 p. m.',
  },
  '/login': {
    titulo: 'Entrar | Mary Nails',
    descripcion: 'Ingresa para ver tus citas, favoritos y calificaciones en Mary Nails.',
  },
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor(private router: Router, private title: Title, private meta: Meta) {
    this.aplicarSeo(this.router.url);
    this.router.events.pipe(filter((evento) => evento instanceof NavigationEnd)).subscribe((evento) => {
      this.aplicarSeo((evento as NavigationEnd).urlAfterRedirects);
    });
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }

  private aplicarSeo(url: string): void {
    const ruta = url.split('?')[0].split('#')[0] || '/';
    const pagina = PAGINAS[ruta];
    if (!pagina) return;
    this.title.setTitle(pagina.titulo);
    this.meta.updateTag({ name: 'description', content: pagina.descripcion });
    this.meta.updateTag({ property: 'og:title', content: pagina.titulo });
    this.meta.updateTag({ property: 'og:description', content: pagina.descripcion });
    this.meta.updateTag({ property: 'og:url', content: `${SITIO}${ruta === '/' ? '/' : ruta}` });
  }

  get adminLogueado(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maryNailsAdminSesion') === 'true';
  }

  cerrarSesionAdmin(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('maryNailsAdminSesion');
      localStorage.removeItem('maryNailsAdminUsuario');
    }
    this.router.navigate(['/']);
  }
}
