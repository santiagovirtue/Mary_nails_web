import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

dotenv.config({ override: true });

const require = createRequire(import.meta.url);

interface SqlJsStatement {
  bind(values?: unknown[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}

interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
}

function valorSql(valor: unknown): unknown {
  if (valor === undefined) return null;
  if (typeof valor === 'bigint') return Number(valor);
  return valor;
}

function guardar(db: SqlJsDatabase, ruta: string): void {
  writeFileSync(ruta, Buffer.from(db.export()));
}

function envolver(db: SqlJsDatabase, ruta: string): SqliteDatabase {
  let transaccion = 0;
  const persistirSiPuede = () => {
    if (transaccion === 0) guardar(db, ruta);
  };
  return {
    exec(sql: string) {
      const inicio = /^\s*begin\b/i.test(sql);
      const cierre = /^\s*(commit|rollback)\b/i.test(sql);
      if (inicio) transaccion += 1;
      try {
        db.exec(sql);
      } finally {
        if (cierre) transaccion = Math.max(0, transaccion - 1);
      }
      if (!/^\s*pragma\b/i.test(sql)) persistirSiPuede();
    },
    prepare(sql: string): SqliteStatement {
      return {
        all(...params: unknown[]) {
          const sentencia = db.prepare(sql);
          const consulta = params.map(valorSql);
          if (consulta.length > 0) sentencia.bind(consulta);
          const filas: Record<string, unknown>[] = [];
          while (sentencia.step()) filas.push(sentencia.getAsObject());
          sentencia.free();
          return filas;
        },
        run(...params: unknown[]) {
          const cambios = params.map(valorSql);
          if (cambios.length > 0) db.run(sql, cambios);
          else db.run(sql);
          const resultado = db.exec('SELECT last_insert_rowid() AS id, changes() AS changes');
          persistirSiPuede();
          const valores = resultado[0]?.values[0] ?? [0, 0];
          return { lastInsertRowid: Number(valores[0] ?? 0), changes: Number(valores[1] ?? 0) };
        },
      };
    },
  };
}

async function abrirSqlite(ruta: string): Promise<SqliteDatabase> {
  const paquete = ['sql', 'js'].join('.');
  const cargar = require(paquete) as (opciones?: {
    locateFile?: (archivo: string) => string;
  }) => Promise<{ Database: new (datos?: Uint8Array) => SqlJsDatabase }>;
  const SQL = await cargar({
    locateFile: (archivo) => join(require.resolve(paquete), '..', archivo),
  });
  const datos = existsSync(ruta) ? new Uint8Array(readFileSync(ruta)) : undefined;
  return envolver(new SQL.Database(datos), ruta);
}

interface SqliteStatement {
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

export type MotorBaseDatos = 'mysql' | 'sqlite';

let motor: MotorBaseDatos = 'sqlite';

export async function getDbStatus(): Promise<MotorBaseDatos> {
  await asegurar();
  return motor;
}

function traducir(sql: string): string {
  return sql
    .replace(/DATE_FORMAT\(\s*([^,]+?)\s*,\s*'%Y-%m-%d'\s*\)/gi, "strftime('%Y-%m-%d', $1)")
    .replace(/\bCURDATE\(\)/gi, "date('now')")
    .replace(/\bDATE\(/gi, 'date(');
}

function filaPlana(row: unknown): Record<string, unknown> {
  return { ...(row as object) };
}

class ManejadorSqlite {
  constructor(private db: SqliteDatabase) {}

  async query(sql: string, params: unknown[] = []): Promise<[unknown, unknown[]]> {
    const texto = traducir(sql);
    const sentencia = this.db.prepare(texto);
    if (/^\s*(select|with|pragma)\b/i.test(texto)) {
      return [sentencia.all(...params).map(filaPlana), []];
    }
    const info = sentencia.run(...params);
    return [{ insertId: Number(info.lastInsertRowid), affectedRows: info.changes }, []];
  }

  async beginTransaction(): Promise<void> {
    this.db.exec('BEGIN');
  }

  async commit(): Promise<void> {
    this.db.exec('COMMIT');
  }

  async rollback(): Promise<void> {
    try {
      this.db.exec('ROLLBACK');
    } catch {
      /* no había transacción abierta */
    }
  }
}

let cola: Promise<void> = Promise.resolve();

function encolar<T>(tarea: () => Promise<T>): Promise<T> {
  const ejecucion = cola.then(tarea, tarea);
  cola = ejecucion.then(
    () => undefined,
    () => undefined,
  );
  return ejecucion;
}

class PoolSqlite {
  constructor(private db: SqliteDatabase) {}

  query(sql: string, params?: unknown[]): Promise<[unknown, unknown[]]> {
    return encolar(() => new ManejadorSqlite(this.db).query(sql, params ?? []));
  }

  async getConnection(): Promise<{
    query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown[]]>;
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    release: () => void;
  }> {
    let soltar: () => void = () => undefined;
    const retenido = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    const anterior = cola;
    cola = retenido;
    await anterior;
    const manejador = new ManejadorSqlite(this.db);
    return {
      query: (sql: string, params?: unknown[]) => manejador.query(sql, params ?? []),
      beginTransaction: () => manejador.beginTransaction(),
      commit: () => manejador.commit(),
      rollback: () => manejador.rollback(),
      release: () => soltar(),
    };
  }
}

async function crearSqlite(): Promise<PoolSqlite> {
  const carpeta = join(process.cwd(), 'data');
  mkdirSync(carpeta, { recursive: true });
  const db = await abrirSqlite(join(carpeta, 'mary-nails.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT UNIQUE NOT NULL,
      telefono TEXT,
      password TEXT NOT NULL,
      rol TEXT NOT NULL,
      fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
      direccion TEXT,
      preferencias TEXT,
      foto_perfil TEXT
    );
    CREATE TABLE IF NOT EXISTS servicios (
      id_servicio INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL,
      duracion_minutos INTEGER NOT NULL,
      estado TEXT DEFAULT 'activo',
      imagen TEXT
    );
    CREATE TABLE IF NOT EXISTS disponibilidad (
      id_disponibilidad INTEGER PRIMARY KEY AUTOINCREMENT,
      dia TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      estado TEXT DEFAULT 'disponible',
      observacion TEXT
    );
    CREATE TABLE IF NOT EXISTS citas (
      id_cita INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      id_servicio INTEGER NOT NULL,
      id_disponibilidad INTEGER,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      observacion TEXT,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
      FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
      FOREIGN KEY (id_disponibilidad) REFERENCES disponibilidad(id_disponibilidad)
    );
    CREATE TABLE IF NOT EXISTS pagos (
      id_pago INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cita INTEGER NOT NULL,
      metodo_pago TEXT NOT NULL,
      valor REAL NOT NULL,
      estado_pago TEXT DEFAULT 'pendiente',
      fecha_pago TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
    );
    CREATE TABLE IF NOT EXISTS calificaciones (
      id_calificacion INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cita INTEGER NOT NULL,
      puntuacion INTEGER,
      comentario TEXT,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
    );
    CREATE TABLE IF NOT EXISTS mensajes (
      id_mensaje INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      telefono TEXT,
      asunto TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      leido INTEGER DEFAULT 0
    );
  `);
  const existentes = db.prepare('SELECT COUNT(*) AS total FROM usuarios').all() as Array<{ total: number }>;
  if (Number(existentes[0]?.total ?? 0) === 0) {
    db.exec(`
      INSERT INTO usuarios (nombre, correo, telefono, password, rol) VALUES
        ('Administrador Mary Nails', 'admin@marynails.com', '3001234567', 'admin123', 'administrador'),
        ('Laura Martínez', 'laura@email.com', '3012223344', 'cliente123', 'cliente'),
        ('Camila Torres', 'camila@email.com', '3023334455', 'cliente123', 'cliente');
      INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos, estado, imagen) VALUES
        ('Manicure profesional', 'Limpieza, limado, cuidado de cutícula y esmaltado.', 25000, 45, 'activo', '/img/manicura-perla.jpeg'),
        ('Pedicure', 'Cuidado completo de pies, limpieza e hidratación.', 30000, 60, 'activo', '/img/pedicura.jpeg'),
        ('Uñas acrílicas', 'Extensión y diseño de uñas acrílicas.', 60000, 90, 'activo', '/img/unas-oro.jpeg'),
        ('Diseño personalizado', 'Decoración artística según el gusto del cliente.', 15000, 60, 'activo', '/img/semipermanente-ovalada.jpeg');
      INSERT INTO disponibilidad (dia, hora_inicio, hora_fin, estado, observacion) VALUES
        ('Lunes', '09:00:00', '12:00:00', 'disponible', 'Horario de atención normal'),
        ('Martes', '14:00:00', '18:00:00', 'disponible', 'Horario de la tarde'),
        ('Miércoles', '09:00:00', '13:00:00', 'disponible', 'Horario de atención en la mañana'),
        ('Jueves', '14:00:00', '18:00:00', 'disponible', 'Horario de la tarde'),
        ('Viernes', '10:00:00', '13:00:00', 'disponible', 'Horario de fin de semana próximo'),
        ('Sábado', '08:00:00', '13:00:00', 'disponible', 'Atención de fin de semana');
      INSERT INTO citas (id_usuario, id_servicio, id_disponibilidad, fecha, hora, estado, observacion) VALUES
        (2, 1, 1, '2026-05-18', '09:00:00', 'confirmada', 'Cliente solicita diseño sencillo'),
        (3, 3, 2, '2026-05-19', '14:00:00', 'pendiente', 'Pendiente por confirmar pago');
      INSERT INTO pagos (id_cita, metodo_pago, valor, estado_pago) VALUES
        (1, 'nequi', 25000, 'pagado'),
        (2, 'efectivo', 60000, 'pendiente');
      INSERT INTO calificaciones (id_cita, puntuacion, comentario) VALUES
        (1, 5, 'Excelente servicio y atención.');
    `);
  }
  return new PoolSqlite(db);
}

async function intentarMysql(): Promise<mysql.Pool | null> {
  if (!process.env['DB_HOST'] || !process.env['DB_USER'] || !process.env['DB_NAME']) return null;
  const candidato = mysql.createPool({
    host: process.env['DB_HOST'],
    port: Number(process.env['DB_PORT'] || 3306),
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_NAME'],
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 4000,
  });
  try {
    const conexion = await Promise.race([
      candidato.getConnection(),
      new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new Error('timeout')), 5000)),
    ]);
    conexion.release();
    return candidato;
  } catch (error) {
    console.error('MySQL no respondió. Mary Nails usa la base local.', error instanceof Error ? error.message : error);
    await candidato.end().catch(() => undefined);
    return null;
  }
}

type PoolActivo = PoolSqlite | mysql.Pool;

let activo: PoolActivo | null = null;
let listo: Promise<void> | null = null;

function asegurar(): Promise<void> {
  if (!listo) {
    listo = (async () => {
      const mysqlPool = await intentarMysql();
      if (mysqlPool) {
        activo = mysqlPool;
        motor = 'mysql';
        console.log('Conexión a MySQL lista. Base:', process.env['DB_NAME']);
        return;
      }
      activo = await crearSqlite();
      motor = 'sqlite';
      console.log('Base local lista en data/mary-nails.sqlite');
    })();
  }
  return listo;
}

export const pool = {
  query(sql: string, params?: unknown[]): Promise<[unknown, unknown[]]> {
    return asegurar().then(() => (activo as PoolSqlite).query(sql, params));
  },
  getConnection() {
    return asegurar().then(() => (activo as PoolSqlite).getConnection());
  },
};

export async function testConnection(): Promise<void> {
  await asegurar();
  if (motor === 'mysql') console.log('Mary Nails usa MySQL.');
  else console.log('Mary Nails usa la base local porque MySQL no está disponible.');
}
