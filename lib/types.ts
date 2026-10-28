export type Source = 'ghl' | 'meta' | 'ig' | 'manual' | 'agente' | 'migracion';
export type Closer = 'Marcos' | 'Andrea' | 'Gonzalo';
export type Fuente = 'Instagram' | 'WhatsApp' | 'Webinar' | 'YouTube' | 'Referido' | 'Otro';
export type Asistio = 'Asistió' | 'No show' | 'Canceló' | 'Pendiente';
export type Compro = 'Si' | 'No' | 'Reserva';
export type MetodoPago = 'PIF' | 'Cuotas' | 'Reserva';
/** Por dónde entró la plata */
export type PlataformaPago = 'Stripe' | 'Wise' | 'Cripto' | 'Efectivo' | 'Mercado Pago' | 'DólarApp' | 'Otro';
export const PLATAFORMAS: PlataformaPago[] = ['Stripe', 'Wise', 'Cripto', 'Efectivo', 'Mercado Pago', 'DólarApp', 'Otro'];

export const CLOSERS: Closer[] = ['Marcos', 'Andrea', 'Gonzalo'];
/** Nombre completo para mostrar */
export const NOMBRE_CLOSER: Record<Closer, string> = {
  Marcos: 'Marcos Lanci',
  Andrea: 'Andrea Flores',
  Gonzalo: 'Gonzalo Guimil',
};

/** Funnel de origen del lead. Orgánico incluye Follow Me Ads (anuncios que llevan al perfil).
    Valores viejos ('Follow Me Ads', 'Lead magnet') o sin clasificar cuentan como Orgánico. */
export type Funnel = 'Orgánico' | 'Webinar' | 'YouTube';
export const FUNNELS: Funnel[] = ['Orgánico', 'Webinar', 'YouTube'];
/** Funnel efectivo: el cargado; si no hay, se deduce de la fuente (YouTube / Webinar); si no, Orgánico. */
export const funnelDeLead = (f: string | null | undefined, fuente?: string | null): Funnel =>
  f === 'Webinar' || f === 'YouTube' ? f : !f && (fuente === 'YouTube' || fuente === 'Webinar') ? fuente : 'Orgánico';
export const FUENTES: Fuente[] = ['Instagram', 'WhatsApp', 'Webinar', 'YouTube', 'Referido', 'Otro'];

export interface Lead {
  id: string;
  ghl_contact_id?: string | null;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  pais?: string | null;
  instagram?: string | null;
  fuente?: Fuente | null;
  /** Funnel por el que entró. null = sin clasificar */
  funnel?: Funnel | null;
  /** Inbound: el lead escribió primero. Outbound: salió de un mensaje en frío. */
  canal?: 'Inbound' | 'Outbound' | null;
  /** UTMs del link por el que agendó (vienen de la atribución de GoHighLevel) */
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  tags?: string[] | null;
  cualificacion_economica?: number | null;
  primer_punto_contacto?: string | null;
  ultimo_punto_contacto?: string | null;
  etapa_pipeline?: string | null;
  source: Source;
  notas?: string | null;
}

export interface Agenda {
  id: string;
  ghl_event_id?: string | null;
  lead_id: string;
  closer: Closer;
  fecha_llamada: string; // ISO
  fecha_agendada?: string | null;
  estado_ghl?: string | null;
  confirmada_whatsapp?: boolean | null;
  asistio: Asistio;
  oferta_hecha?: boolean | null;
  compro?: Compro | null;
  producto?: string | null;
  cash_collected?: number | null;
  revenue?: number | null;
  metodo_pago?: MetodoPago | null;
  reprogramada_desde?: string | null;
  source: Source;
  notas?: string | null;
  lead?: Lead;
}

export interface Cobranza {
  id: string;
  agenda_id: string;
  fecha_cobro: string; // YYYY-MM-DD
  monto_cobrado: number;
  pendiente?: number | null;
  cuotas_restantes?: number | null;
  proximo_vencimiento?: string | null;
  closer: Closer;
  es_reembolso: boolean;
  plataforma?: PlataformaPago | null;
  source: Source;
  notas?: string | null;
}

export interface SetterDiario {
  fecha: string;
  conv_organicas?: number | null;
  conv_pagadas?: number | null;
  bienvenidas?: number | null;
  conv_frio?: number | null;
  mensajes_seguimiento?: number | null;
  respuestas?: number | null;
  seguimientos?: number | null;
  links_enviados?: number | null;
  agendas?: number | null;
  source: Source;
}

export interface AdsDiario {
  fecha: string;
  campana: 'follow_me' | 'webinar';
  inversion: number;
  impresiones?: number | null;
  alcance?: number | null;
  frecuencia?: number | null;
  cpm?: number | null;
  ctr?: number | null;
  visitas_perfil?: number | null;
  seguidores?: number | null;
  conversaciones?: number | null;
  bitacora?: string | null;
  source: Source;
}

export interface OrganicoDiario {
  fecha: string;
  tipo_historia?: 'CTA a LM' | 'CTA de Venta' | 'Nutrición' | 'Q&A' | 'Personal' | null;
  views_primera?: number | null;
  views_ultima?: number | null;
  cantidad_historias?: number | null;
  respuestas?: number | null;
  respuestas_encuesta?: number | null;
  formato_reel?: 'Reel' | 'Carrusel' | 'Imagen' | null;
  tipo_cta?: string | null;
  comentarios_48h?: number | null;
  notas?: string | null;
  source: Source;
}

export interface OrganicoPieza {
  ig_media_id: string;
  fecha: string;
  tipo: 'reel' | 'historia';
  titulo: string;
  views?: number | null;
  alcance?: number | null;
  comentarios?: number | null;
  respuestas?: number | null;
  guardados?: number | null;
  compartidos?: number | null;
  promocionado: boolean;
  url?: string | null;
  a_confirmar?: boolean;
}

export interface AjusteMensual {
  mes: string; // YYYY-MM-01
  costo_software?: number | null;
  objetivo_asistencia?: number | null; // 0.6
  objetivo_cierre_oferta?: number | null; // 0.3
  notas?: string | null;
}

export type FrecuenciaCosto = 'Mensual' | 'Anual' | 'Único';
export const CATEGORIAS_COSTO = ['CRM y ventas', 'Mensajería', 'Contenido', 'Editores', 'IA', 'Infraestructura', 'Pagos', 'Equipo', 'Otro'] as const;
export type CategoriaCosto = (typeof CATEGORIAS_COSTO)[number];

/** Un costo fijo del negocio (software, herramienta, servicio).
    Se cuenta desde fecha_alta hasta fecha_baja (incluida). Anual = monto / 12 por mes.
    Único = se cuenta entero en el mes de fecha_alta. */
export interface Costo {
  id: string;
  nombre: string;
  categoria: CategoriaCosto;
  frecuencia: FrecuenciaCosto;
  monto: number; // USD tal cual se cobra
  fecha_alta: string; // YYYY-MM-DD
  fecha_baja?: string | null;
  notas?: string | null;
  source: Source;
}

/** % de comisión de un closer sobre lo cobrado. Vigente desde fecha_alta hasta fecha_baja.
    Un cambio de % cierra la fila vieja y abre una nueva (los meses pasados no cambian). */
export interface Comision {
  id: string;
  closer: Closer;
  porcentaje: number; // 0–100
  fecha_alta: string; // YYYY-MM-DD
  fecha_baja?: string | null;
  notas?: string | null;
  source: Source;
}

/** Comisión que cobra una plataforma de pago: % sobre cada cobro + fijo por cobro (USD). Con historial. */
export interface ComisionPlataforma {
  id: string;
  plataforma: PlataformaPago;
  porcentaje: number; // 0–100
  fijo: number; // USD por cobro
  fecha_alta: string;
  fecha_baja?: string | null;
  source: Source;
}

/** Un webinar: registrados y asistentes (se cargan a mano o por Claude). */
export interface Webinar {
  id: string;
  fecha: string; // YYYY-MM-DD
  nombre?: string | null;
  registrados?: number | null;
  asistentes?: number | null;
  source: Source;
}

export interface LogAgente {
  id: string;
  fecha: string;
  resumen: string;
  cambios?: unknown;
  pendientes?: string[] | null;
  source: Source;
}

export interface UltimaActualizacion {
  fuente: 'GHL' | 'Meta Ads' | 'Instagram' | 'Agente';
  fecha: string | null;
  ok: boolean;
  detalle?: string;
}

/** Todo lo que el dashboard necesita, crudo, sin filtrar por mes. */
export interface RawBundle {
  demo: boolean;
  leads: Lead[];
  agendas: Agenda[];
  cobranzas: Cobranza[];
  setter: SetterDiario[];
  ads: AdsDiario[];
  organico: OrganicoDiario[];
  piezas: OrganicoPieza[];
  ajustes: AjusteMensual[];
  costos: Costo[];
  comisiones: Comision[];
  comisionesPlataformas: ComisionPlataforma[];
  webinars: Webinar[];
  log: LogAgente[];
  actualizaciones: UltimaActualizacion[];
}

export interface Filtros {
  mes: string; // YYYY-MM
  /** Día puntual (YYYY-MM-DD). Si está, todo se filtra a ese día. */
  dia?: string | null;
  closer: Closer | 'todos';
  fuente: Fuente | 'todas';
}
