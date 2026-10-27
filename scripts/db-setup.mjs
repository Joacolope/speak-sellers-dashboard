/**
 * Se corre antes de cada build en Vercel (ver "build" en package.json).
 *  1. Aplica supabase/schema.sql (idempotente) en una transacción.
 *  2. Da de alta los usuarios de ADMIN_EMAILS, EDITOR_EMAILS y LECTOR_EMAILS
 *     (separados por coma). Nunca borra ni baja de rol a nadie.
 * Si no hay URL de Postgres (desarrollo local o demo), no hace nada.
 * La integración Supabase de Vercel crea POSTGRES_URL_NON_POOLING sola.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!raw) {
  console.log('[db-setup] Sin POSTGRES_URL: salteado (modo demo o desarrollo local).');
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

const schema = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8');

try {
  await client.connect();
  await client.query('begin');
  await client.query('select pg_advisory_xact_lock(424242)'); // dos builds a la vez no se pisan
  await client.query(schema);
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
