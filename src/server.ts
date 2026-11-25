import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { getDbStatus, testConnection } from './backend/db';
import { reservasRouter } from './backend/routes/reservas.routes';
import { serviciosRouter } from './backend/routes/servicios.routes';
import { disponibilidadRouter } from './backend/routes/disponibilidad.routes';
import { authRouter } from './backend/routes/auth.routes';
import { reportesRouter } from './backend/routes/reportes.routes';
import { pagosRouter } from './backend/routes/pagos.routes';
import { clientesRouter } from './backend/routes/clientes.routes';
import { dashboardRouter } from './backend/routes/dashboard.routes';
import { perfilRouter } from './backend/routes/perfil.routes';
import { calificacionesRouter } from './backend/routes/calificaciones.routes';
import { mensajesRouter } from './backend/routes/mensajes.routes';

dotenv.config();

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['localhost', 'marynailsweb-production.up.railway.app', '*.up.railway.app'],
  trustProxyHeaders: true,
});

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/reservas', reservasRouter);
app.use('/api/servicios', serviciosRouter);
app.use('/api/disponibilidad', disponibilidadRouter);
app.use('/api/calificaciones', calificacionesRouter);
app.use('/api/perfil', perfilRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/auth', authRouter);
app.use('/api/mensajes', mensajesRouter);

app.get('/api/health', async (_req, res) => {
  try {
    const baseDeDatos = await getDbStatus();
    res.json({ status: 'OK', mensaje: 'MaryNails API funcionando ✅', baseDeDatos });
  } catch (error) {
    console.error('Health sin base de datos:', error);
    res.json({
      status: 'OK',
      mensaje: 'API arriba, base de datos no disponible',
      detalle: error instanceof Error ? error.message : 'error',
    });
  }
});

app.get('/img/:filename', (req, res) => {
  const filepath = join(process.cwd(), 'public', 'img', req.params.filename);
  res.sendFile(filepath, (err) => {
    if (err) res.status(404).json({ error: 'No encontrada', path: filepath });
  });
});
app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

app.use((req, res, next) => {
  angularApp.handle(req).then((response) =>
    response ? writeResponseToNodeResponse(response, res) : next()
  ).catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id'] || process.env['INICIAR_SERVIDOR'] === '1') {
  const port = Number(process.env['PORT'] || 4000);
  const servidor = app.listen(port, '0.0.0.0', () => {
    console.log(`MaryNails server node ${process.version} en 0.0.0.0:${port}`);
    testConnection().catch((error) => console.error('Base de datos:', error));
  });
  servidor.on('error', (error) => {
    console.error('No se pudo abrir el puerto', error);
    process.exit(1);
  });
}

export const reqHandler = createNodeRequestHandler(app);
