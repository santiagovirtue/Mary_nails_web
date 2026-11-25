import { Router, Request, Response } from 'express';
import { pool } from '../db';

export const mensajesRouter = Router();

mensajesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM mensajes ORDER BY id_mensaje DESC');
    res.json(rows);
  } catch (error: any) {
    console.error('ERROR GET /api/mensajes:', error.message);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

mensajesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, correo, telefono, asunto, mensaje } = req.body;
    if (!nombre || !correo || !asunto || !mensaje) {
      res.status(400).json({ error: 'Completa nombre, correo, asunto y mensaje.' });
      return;
    }
    const [result]: any = await pool.query(
      'INSERT INTO mensajes (nombre, correo, telefono, asunto, mensaje) VALUES (?, ?, ?, ?, ?)',
      [String(nombre).trim(), String(correo).trim(), telefono || null, String(asunto).trim(), String(mensaje).trim()]
    );
    res.status(201).json({ id: result.insertId, mensaje: 'Mensaje recibido' });
  } catch (error: any) {
    console.error('ERROR POST /api/mensajes:', error.message);
    res.status(500).json({ error: 'No se pudo guardar el mensaje' });
  }
});

mensajesRouter.patch('/:id/leido', async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE mensajes SET leido = 1 WHERE id_mensaje = ?', [req.params['id']]);
    res.json({ mensaje: 'Mensaje marcado como leído' });
  } catch (error: any) {
    console.error('ERROR PATCH /api/mensajes:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar el mensaje' });
  }
});
