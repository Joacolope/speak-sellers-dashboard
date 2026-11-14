/**
 * Configuración del cliente: todo lo que cambia de un negocio a otro vive en `cliente.json`
 * (marca, closers, objetivos, zona horaria, IDs de GHL y Meta). Este módulo lo tipa, lo valida
 * al arrancar y expone atajos. Nada de acá es secreto: los tokens van en variables de entorno.
 *
 * Para montar el dashboard a otro cliente: copiar el repo, reemplazar `cliente.json`
 * (ver docs/cliente.schema.json) y seguir docs/PUESTA_EN_MARCHA.md, o correr la skill /nuevo-cliente.
 */
import cfg from '../cliente.json';

export interface CloserConfig {
  id: string;
  nombre: string;
  activo?: boolean;
  /** Todavía no empezó a tomar llamadas: queda cargado en cliente.json pero no aparece en el dashboard */
  proximamente?: boolean;
  comisionInicial?: number;
  ghlUserId?: string;
  ghlCalendarId?: string;
}

export interface ConfigCliente {
  nombre: string;
  empresa?: string;
  producto?: string;
  url?: string;
  contacto?: string;
  zonaHoraria: string;
  locale?: string;
  googleSiteVerification?: string;
  closers: CloserConfig[];
  objetivos: { asistencia: number; cierre: number; respuestaMin?: number; piezasPorDia?: number; tofuPorSemana?: number };
  ghl: { locationId?: string; calendarios?: string[]; pipelineId?: string };
  meta: {
    cuentaPublicitaria?: string;
    paginaId?: string;
    instagram?: string;
    campanas?: { follow_me?: string[]; webinar?: string[] };
  };
  formulario?: Partial<Record<'closer_en_actividad' | 'rango_comisiones' | 'nicho' | 'dato_previo', string>>;
}

/** Errores de configuración, en lenguaje de quien la edita. Vacío = todo bien. */
export function validarCliente(c: Partial<ConfigCliente>): string[] {
  const errores: string[] = [];
  if (!c.nombre || c.nombre.trim().length < 2) errores.push('Falta "nombre" (la marca).');
  if (!c.zonaHoraria) errores.push('Falta "zonaHoraria" (ej.: America/Argentina/Buenos_Aires).');
  else {
    try { new Intl.DateTimeFormat('en-US', { timeZone: c.zonaHoraria }); } catch { errores.push(`"zonaHoraria" no es válida: ${c.zonaHoraria}`); }
  }
  if (!Array.isArray(c.closers) || !c.closers.length) errores.push('Hace falta al menos un closer en "closers".');
  else {
    const ids = new Set<string>();
    for (const cl of c.closers) {
      if (!cl.id || !cl.nombre) errores.push('Cada closer necesita "id" y "nombre".');
      else if (ids.has(cl.id)) errores.push(`Hay dos closers con el id "${cl.id}".`);
      ids.add(cl.id);
    }
  }
  const o = c.objetivos;
  if (!o || typeof o.asistencia !== 'number' || typeof o.cierre !== 'number') errores.push('Faltan "objetivos.asistencia" y "objetivos.cierre" (entre 0 y 1).');
  else if (o.asistencia <= 0 || o.asistencia > 1 || o.cierre <= 0 || o.cierre > 1) errores.push('Los objetivos van entre 0 y 1 (0.6 = 60 %).');
  return errores;
}

const crudo = cfg as ConfigCliente;
// Los closers marcados "proximamente" quedan preparados en cliente.json, pero el dashboard todavía no los muestra
const config: ConfigCliente = { ...crudo, closers: (crudo.closers ?? []).filter((c) => !c.proximamente) };
const problemas = validarCliente(config);
if (problemas.length) throw new Error(`cliente.json inválido:\n- ${problemas.join('\n- ')}`);

export const CLIENTE: ConfigCliente = config;

/** "Speak Sellers Dashboard" */
export const TITULO = `${CLIENTE.nombre} Dashboard`;
/** "Speak Sellers · Métricas" (eyebrow de la barra y el login) */
export const EYEBROW = `${CLIENTE.nombre} · Métricas`;
export const EMPRESA = CLIENTE.empresa || CLIENTE.nombre;
export const PRODUCTO = CLIENTE.producto || CLIENTE.nombre;
export const CONTACTO = CLIENTE.contacto || '';
export const ZONA_HORARIA = CLIENTE.zonaHoraria;
export const LOCALE = CLIENTE.locale || 'es-AR';

/** Semáforos: a partir de qué valor una tasa está en verde. */
export const OBJETIVOS = {
  asistencia: CLIENTE.objetivos.asistencia,
  cierre: CLIENTE.objetivos.cierre,
  respuestaMin: CLIENTE.objetivos.respuestaMin ?? 15,
  /** Ritmo de contenido: publicaciones por día y piezas TOFU por semana */
  piezasPorDia: CLIENTE.objetivos.piezasPorDia ?? 2,
  tofuPorSemana: CLIENTE.objetivos.tofuPorSemana ?? 5,
};

/** Los IDs no son secretos, pero una variable de entorno siempre gana (sirve para previews o migraciones). */
export const ids = {
  ghlLocation: () => process.env.GHL_LOCATION_ID || CLIENTE.ghl.locationId || '',
  metaCuenta: () => {
    const v = (process.env.META_AD_ACCOUNT || CLIENTE.meta.cuentaPublicitaria || '').trim();
    return v && !v.startsWith('act_') ? `act_${v}` : v;
  },
  metaPagina: () => process.env.META_PAGE_ID || CLIENTE.meta.paginaId || '',
  appUrl: () => process.env.APP_URL || CLIENTE.url || '',
  googleVerificacion: () => process.env.GOOGLE_SITE_VERIFICATION || CLIENTE.googleSiteVerification || undefined,
};

/** Nombres de campaña de Meta (en minúsculas) que cuentan para cada tipo. */
export const CAMPANAS_META = {
  follow_me: (CLIENTE.meta.campanas?.follow_me ?? ['follow me']).map((s) => s.toLowerCase()),
  webinar: (CLIENTE.meta.campanas?.webinar ?? ['webinar']).map((s) => s.toLowerCase()),
};
