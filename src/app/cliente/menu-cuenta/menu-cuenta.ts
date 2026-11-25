import { Component, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-menu-cuenta',
  imports: [RouterLink],
  templateUrl: './menu-cuenta.html',
  styleUrl: './menu-cuenta.css',
})
export class MenuCuenta {
  @Input() activo = '';

  constructor(private router: Router) {}

  cerrarSesion(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('maryNailsClienteSesion');
      localStorage.removeItem('maryNailsClienteUsuario');
    }
    this.router.navigate(['/']);
  }
}
