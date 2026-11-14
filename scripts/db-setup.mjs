/**
 * Se corre antes de cada build en Vercel (ver "build" en package.json).
 *  0. Valida cliente.json (la configuración del cliente).
 *  1. Aplica supabase/schema.sql (idempotente) en una transacción, completando los
 *     {{PLACEHOLDERS}} con cliente.json (zona horaria, objetivos).
 *  2. Aplica supabase/migraciones/*.sql en orden (idempotentes).
 *  3. Carga las comisiones iniciales de cada closer (solo si la tabla está vacía).
 *  4. Da de alta los usuarios de ADMIN_EMAILS, EDITOR_EMAILS y LECTOR_EMAILS
 *     (separados por coma). Nunca borra ni baja de rol a nadie.
 * Si no hay URL de Postgres (desarrollo local o demo), solo valida cliente.json.
 * La integración Supabase de Vercel crea POSTGRES_URL_NON_POOLING sola.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// ── 0. cliente.json ──
const cliente = JSON.parse(readFileSync(fileURLToPath(new URL('../cliente.json', import.meta.url)), 'utf8'));
const problemas = [];
if (!cliente.nombre || String(cliente.nombre).trim().length < 2) problemas.push('Falta "nombre" (la marca).');
if (!cliente.zonaHoraria) problemas.push('Falta "zonaHoraria".');
else { try { new Intl.DateTimeFormat('en-US', { timeZone: cliente.zonaHoraria }); } catch { problemas.push(`"zonaHoraria" no es válida: ${cliente.zonaHoraria}`); } }
if (!Array.isArray(cliente.closers) || !cliente.closers.length) problemas.push('Hace falta al menos un closer en "closers".');
else if (cliente.closers.some((c) => !c.id || !c.nombre)) problemas.push('Cada closer necesita "id" y "nombre".');
else if (new Set(cliente.closers.map((c) => c.id)).size !== cliente.closers.length) problemas.push('Hay closers con el mismo id.');
const obj = cliente.objetivos ?? {};
if (!(obj.asistencia > 0 && obj.asistencia <= 1 && obj.cierre > 0 && obj.cierre <= 1)) problemas.push('"objetivos.asistencia" y "objetivos.cierre" van entre 0 y 1 (0.6 = 60 %).');
if (problemas.length) {
  console.error('[db-setup] cliente.json inválido:\n- ' + problemas.join('\n- ') + '\nVer docs/cliente.schema.json.');
  process.exit(1);
}
console.log(`[db-setup] Cliente: ${cliente.nombre} · ${cliente.closers.length} closer(s) · ${cliente.zonaHoraria}`);

const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!raw) {
  console.log('[db-setup] Sin POSTGRES_URL: base salteada (modo demo o desarrollo local).');
  process.exit(0);
}

const lista = (v) => (v || '').split(',').map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
const usuarios = [
  ...lista(process.env.ADMIN_EMAILS).map((email) => ({ email, rol: 'admin' })),
  ...lista(process.env.EDITOR_EMAILS).map((email) => ({ email, rol: 'editor' })),
  ...lista(process.env.LECTOR_EMAILS).map((email) => ({ email, rol: 'lector' })),
];

// pg toma sslmode de la URL y exige verificar el certificado; Supabase usa su propia CA.
// La conexión sigue cifrada (TLS); se quita la verificación de la cadena solo para este script.
const url = new URL(raw);
const sinSsl = url.searchParams.get('sslmode') === 'disable'; // solo para pruebas locales
url.searchParams.delete('sslmode');
url.searchParams.delete('supa');
const client = new pg.Client({ connectionString: url.toString(), ssl: sinSsl ? false : { rejectUnauthorized: false } });

// Zona horaria y objetivos entran al schema desde cliente.json (sin comillas: se validaron arriba)
const zona = String(cliente.zonaHoraria).replace(/[^A-Za-z0-9_+\-/]/g, '');
const schema = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8')
  .replaceAll('{{ZONA_HORARIA}}', zona)
  .replaceAll('{{OBJ_ASISTENCIA}}', Number(obj.asistencia).toFixed(4))
  .replaceAll('{{OBJ_CIERRE}}', Number(obj.cierre).toFixed(4));
// Cargas de datos históricos (spreadsheet). Idempotentes: se aplican en cada build, en orden.
const dirMig = fileURLToPath(new URL('../supabase/migraciones/', import.meta.url));
const migraciones = existsSync(dirMig) ? readdirSync(dirMig).filter((f) => f.endsWith('.sql')).sort().map((f) => [f, readFileSync(dirMig + f, 'utf8')]) : [];

try {
  await client.connect();
  await client.query('begin');
  await client.query('select pg_advisory_xact_lock(424242)'); // dos builds a la vez no se pisan
  await client.query(schema);
  for (const [nombre, sql] of migraciones) {
    await client.query(sql);
    console.log(`[db-setup] Migración aplicada: ${nombre}`);
  }
  // Comisiones iniciales por closer, una sola vez (después se editan en Costos)
  const { rows: hayCom } = await client.query('select 1 from comisiones limit 1');
  if (!hayCom.length) {
    for (const c of cliente.closers.filter((x) => !x.proximamente)) {
      await client.query(
        `insert into comisiones (closer, porcentaje, fecha_alta, notas, source) values ($1, $2, current_date, 'Carga inicial (cliente.json)', 'manual')`,
        [c.id, Number(c.comisionInicial ?? 0)],
      );
    }
    console.log(`[db-setup] Comisiones iniciales cargadas para ${cliente.closers.length} closer(s).`);
  }
  for (const u of usuarios) {
    // Alta o sube de rol; nunca baja (admin > editor > lector)
    await client.query(
      `insert into usuarios (email, rol) values ($1, $2)
       on conflict (email) do update set
         activo = true,
         rol = case
           when (case excluded.rol when 'admin' then 3 when 'editor' then 2 else 1 end) >
                (case usuarios.rol when 'admin' then 3 when 'editor' then 2 else 1 end)
           then excluded.rol else usuarios.rol end`,
      [u.email, u.rol],
    );
  }
  await client.query('commit');
  const { rows } = await client.query('select count(*)::int as n from usuarios where activo');
  console.log(`[db-setup] Schema aplicado. Usuarios activos: ${rows[0].n}.`);
  if (!rows[0].n) console.warn('[db-setup] ATENCIÓN: no hay usuarios. Cargá ADMIN_EMAILS en Vercel y redeployá.');
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error('[db-setup] Error aplicando el schema:', e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
