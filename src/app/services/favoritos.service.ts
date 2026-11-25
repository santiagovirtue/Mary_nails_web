import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FavoritosService {
  private clave(): string {
    const correo = this.correo();
    return 'maryNailsFavoritos:' + correo;
  }

  sesion(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('maryNailsClienteSesion') === 'true';
  }

  correo(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('maryNailsClienteUsuario') || '';
  }

  ids(): number[] {
    if (!this.sesion()) return [];
    try {
      const datos = JSON.parse(localStorage.getItem(this.clave()) || '[]');
      return Array.isArray(datos) ? datos.map((id) => Number(id)).filter((id) => !Number.isNaN(id)) : [];
    } catch {
      return [];
    }
  }

  esFavorito(id: number): boolean {
    return this.ids().includes(Number(id));
  }

  alternar(id: number): boolean {
    const numero = Number(id);
    const yaEstaba = this.esFavorito(numero);
    const siguiente = yaEstaba ? this.ids().filter((item) => item !== numero) : [...this.ids(), numero];
    localStorage.setItem(this.clave(), JSON.stringify(siguiente));
    return !yaEstaba;
  }
}
