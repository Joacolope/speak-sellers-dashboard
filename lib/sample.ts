/**
 * DATOS DE EJEMPLO. Salen de la sección 10 de la spec (octubre 2026) y de los
 * totales conocidos del spreadsheet. Se usan solo cuando no hay Supabase
 * configurado, para ver el diseño. Nada de esto se muestra como real: el
 * dashboard marca el modo demo arriba de todo.
 */
import type {
  Agenda, AdsDiario, Cobranza, Lead, LogAgente, OrganicoDiario, OrganicoPieza,
  RawBundle, SetterDiario, AjusteMensual, Closer, Fuente, Asistio,
} from './types';
import { diasDelMes } from './format';

// Generador determinístico (misma data en cada render)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const closers: Closer[] = ['Marcos', 'Andrea', 'Gonzalo'];
const fuentes: Fuente[] = ['Instagram', 'Instagram', 'Instagram', 'Webinar', 'Webinar', 'WhatsApp', 'YouTube'];
const paises = ['Argentina', 'Argentina', 'Argentina', 'México', 'Chile', 'Colombia', 'España', 'Uruguay'];

interface Semilla {
  nombre: string;
  dia: number;
  closer: Closer;
  asistio: Asistio;
  oferta?: boolean;
  compro?: 'Si' | 'No' | 'Reserva';
  cash?: number;
  revenue?: number;
  metodo?: 'PIF' | 'Cuotas' | 'Reserva';
  fuente?: Fuente;
  cualif?: number;
  reprog?: string;
  notas?: string;
  confirmada?: boolean;
  estado?: string;
}

// Casos nombrados en la spec (sección 10) + ventas de ejemplo para llegar a ≈ 10.690 USD
const SEMILLAS: Semilla[] = [
  { nombre: 'Elías Sánchez', dia: 9, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1200, revenue: 1200, metodo: 'PIF', fuente: 'Instagram', cualif: 8, confirmada: true, estado: 'showed' },
  { nombre: 'Betina', dia: 15, closer: 'Andrea', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 670, revenue: 670, metodo: 'Cuotas', fuente: 'Webinar', cualif: 7, confirmada: true, estado: 'showed', notas: 'Quedan 1.000 USD para mediados de noviembre' },
  { nombre: 'Martinetti', dia: 7, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'No', cash: 0, revenue: 0, fuente: 'Instagram', cualif: 6, confirmada: true, estado: 'showed', notas: 'Reembolsado' },
  { nombre: 'Murakami', dia: 8, closer: 'Andrea', asistio: 'Asistió', oferta: true, compro: 'No', cash: 0, revenue: 0, fuente: 'Webinar', cualif: 5, confirmada: true, estado: 'showed', notas: 'Reembolsado' },
  { nombre: 'Axel', dia: 16, closer: 'Gonzalo', asistio: 'No show', fuente: 'Instagram', confirmada: false, estado: 'noshow' },
  { nombre: 'Martín', dia: 20, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'Si', fuente: 'Instagram', cualif: 7, confirmada: true, estado: 'showed', notas: 'Pagó en ARS (~600 USD), falta cotización' },
  { nombre: 'Damián', dia: 21, closer: 'Andrea', asistio: 'Asistió', oferta: true, compro: 'Si', fuente: 'Webinar', cualif: 6, confirmada: true, estado: 'showed', notas: 'Pagó en ARS (~600 USD), falta cotización' },
  { nombre: 'Cristian', dia: 22, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'Reserva', cash: 300, revenue: 300, metodo: 'Reserva', fuente: 'Instagram', cualif: 7, confirmada: true, estado: 'showed', notas: 'Reserva; pagó ~67 USD en ARS además' },
  { nombre: 'Luis Paulino', dia: 14, closer: 'Gonzalo', asistio: 'Pendiente', fuente: 'Instagram', confirmada: true, estado: 'confirmed', notas: 'Asistencia sin marcar' },
  { nombre: 'Gino', dia: 26, closer: 'Marcos', asistio: 'Pendiente', fuente: 'Instagram', confirmada: true, estado: 'confirmed' },
  { nombre: 'Gianluca', dia: 26, closer: 'Andrea', asistio: 'Pendiente', fuente: 'Webinar', confirmada: true, estado: 'confirmed' },
  { nombre: 'Tiago', dia: 26, closer: 'Marcos', asistio: 'Pendiente', fuente: 'Instagram', confirmada: false, estado: 'confirmed' },
  { nombre: 'Daniela', dia: 29, closer: 'Andrea', asistio: 'Pendiente', fuente: 'Instagram', confirmada: true, estado: 'confirmed', reprog: '2026-10-26T18:00:00Z', notas: 'Reprogramada del 26/10 al 29/10' },
  { nombre: 'Elbio', dia: 26, closer: 'Gonzalo', asistio: 'Pendiente', fuente: 'WhatsApp', confirmada: true, estado: 'confirmed' },
  { nombre: 'Tomás', dia: 29, closer: 'Marcos', asistio: 'Pendiente', fuente: 'Instagram', confirmada: false, estado: 'confirmed', reprog: '2026-10-24T15:00:00Z', notas: 'Reprogramada al 29/10' },
  // Ventas de ejemplo para completar el revenue de octubre
  { nombre: 'Lead ejemplo A', dia: 2, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1500, revenue: 1500, metodo: 'PIF', fuente: 'Instagram', cualif: 9, confirmada: true, estado: 'showed' },
  { nombre: 'Lead ejemplo B', dia: 3, closer: 'Andrea', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1500, revenue: 1500, metodo: 'PIF', fuente: 'Webinar', cualif: 8, confirmada: true, estado: 'showed' },
  { nombre: 'Lead ejemplo C', dia: 6, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1200, revenue: 1200, metodo: 'PIF', fuente: 'Instagram', cualif: 8, confirmada: true, estado: 'showed' },
  { nombre: 'Lead ejemplo D', dia: 10, closer: 'Gonzalo', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1200, revenue: 1200, metodo: 'Cuotas', fuente: 'Webinar', cualif: 7, confirmada: true, estado: 'showed' },
  { nombre: 'Lead ejemplo E', dia: 13, closer: 'Andrea', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1200, revenue: 1200, metodo: 'PIF', fuente: 'Instagram', cualif: 8, confirmada: true, estado: 'showed' },
  { nombre: 'Lead ejemplo F', dia: 17, closer: 'Marcos', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 1000, revenue: 1000, metodo: 'Cuotas', fuente: 'YouTube', cualif: 6, confirmada: true, estado: 'showed' },
  { nombre: 'Lead ejemplo G', dia: 23, closer: 'Andrea', asistio: 'Asistió', oferta: true, compro: 'Si', cash: 920, revenue: 920, metodo: 'Cuotas', fuente: 'Webinar', cualif: 7, confirmada: true, estado: 'showed' },
];

function construirAgendasOctubre(): { leads: Lead[]; agendas: Agenda[] } {
  const rand = rng(42);
  const leads: Lead[] = [];
  const agendas: Agenda[] = [];

  const push = (s: Semilla, i: number) => {
    const leadId = `lead-oct-${i}`;
    const fuente = s.fuente ?? fuentes[Math.floor(rand() * fuentes.length)];
    leads.push({
      id: leadId,
      nombre: s.nombre,
      pais: paises[Math.floor(rand() * paises.length)],
      telefono: `+54 9 11 ${String(1000 + Math.floor(rand() * 9000))}-${String(1000 + Math.floor(rand() * 9000))}`,
      fuente,
      cualificacion_economica: s.cualif ?? null,
      etapa_pipeline: s.compro === 'Si' ? 'Cliente' : s.compro === 'Reserva' ? 'Reserva $' : s.asistio === 'Asistió' ? 'Seguimiento' : 'Agendado',
      source: 'migracion',
      primer_punto_contacto: s.compro ? (fuente === 'Webinar' ? 'Webinar 4/10' : 'Reel') : null,
      ultimo_punto_contacto: s.compro ? 'Historias' : null,
      instagram: s.compro ? `@${s.nombre.toLowerCase().replace(/[^a-z]/g, '')}` : null,
    });
    const hora = 13 + Math.floor(rand() * 7);
    agendas.push({
      id: `ag-oct-${i}`,
      ghl_event_id: `ghl-ev-${i}`,
      lead_id: leadId,
      closer: s.closer,
      fecha_llamada: `2026-10-${String(s.dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:00:00Z`,
      fecha_agendada: `2026-10-${String(Math.max(1, s.dia - 1 - Math.floor(rand() * 3))).padStart(2, '0')}T12:00:00Z`,
      estado_ghl: s.estado ?? (s.asistio === 'Asistió' ? 'showed' : s.asistio === 'No show' ? 'noshow' : s.asistio === 'Canceló' ? 'cancelled' : 'confirmed'),
      confirmada_whatsapp: s.confirmada ?? rand() > 0.3,
      asistio: s.asistio,
      oferta_hecha: s.oferta ?? false,
      compro: s.compro ?? (s.asistio === 'Asistió' && s.oferta ? 'No' : null),
      producto: s.compro && s.compro !== 'No' ? 'Speak Sellers' : null,
      cash_collected: s.cash ?? null,
      revenue: s.revenue ?? null,
      metodo_pago: s.metodo ?? null,
      reprogramada_desde: s.reprog ?? null,
      source: s.compro ? 'manual' : s.estado === 'noshow' ? 'agente' : 'ghl',
      notas: s.notas ?? null,
    });
  };

  SEMILLAS.forEach(push);

  // Completar hasta 58 agendas de octubre con casos genéricos
  let i = SEMILLAS.length;
  while (agendas.length < 58) {
    const dia = 1 + Math.floor(rand() * 27);
    const r = rand();
    const asistio: Asistio = r < 0.6 ? 'Asistió' : r < 0.85 ? 'No show' : r < 0.93 ? 'Canceló' : 'Pendiente';
    const oferta = asistio === 'Asistió' && rand() < 0.75;
    push({
      nombre: `Lead ejemplo ${i + 1}`,
      dia,
      closer: closers[Math.floor(rand() * closers.length)],
      asistio,
      oferta,
      compro: oferta ? 'No' : undefined,
      cualif: asistio === 'Asistió' ? 3 + Math.floor(rand() * 6) : undefined,
    }, i);
    i++;
  }
  return { leads, agendas };
}

function construirAgendasSeptiembre(): { leads: Lead[]; agendas: Agenda[] } {
  const rand = rng(7);
  const leads: Lead[] = [];
  const agendas: Agenda[] = [];
  for (let i = 0; i < 41; i++) {
    const leadId = `lead-sep-${i}`;
    const r = rand();
    const asistio: Asistio = r < 0.55 ? 'Asistió' : r < 0.85 ? 'No show' : 'Canceló';
    const oferta = asistio === 'Asistió' && rand() < 0.7;
    const vendio = oferta && rand() < 0.35;
    const monto = vendio ? [1200, 1000, 670, 1500][Math.floor(rand() * 4)] : null;
    const fuente = fuentes[Math.floor(rand() * fuentes.length)];
    leads.push({ id: leadId, nombre: `Lead sep ${i + 1}`, fuente, pais: paises[Math.floor(rand() * paises.length)], source: 'migracion' });
    agendas.push({
      id: `ag-sep-${i}`,
      lead_id: leadId,
      closer: closers[Math.floor(rand() * 2)],
      fecha_llamada: `2026-09-${String(1 + Math.floor(rand() * 30)).padStart(2, '0')}T15:00:00Z`,
      asistio,
      oferta_hecha: oferta,
      compro: vendio ? 'Si' : oferta ? 'No' : null,
      cash_collected: monto,
      revenue: monto,
      metodo_pago: vendio ? 'PIF' : null,
      source: 'migracion',
    });
  }
  return { leads, agendas };
}

function construirCobranzas(agendas: Agenda[]): Cobranza[] {
  const out: Cobranza[] = [];
  for (const a of agendas) {
    if (a.compro === 'Si' || a.compro === 'Reserva') {
      if (a.cash_collected) {
        out.push({
          id: `cob-${a.id}`,
          agenda_id: a.id,
          fecha_cobro: a.fecha_llamada.slice(0, 10),
          monto_cobrado: a.cash_collected,
          pendiente: a.lead_id === 'lead-oct-1' ? 1000 : a.metodo_pago === 'Cuotas' ? Math.round(a.cash_collected * 0.5) : 0,
          cuotas_restantes: a.lead_id === 'lead-oct-1' ? 1 : a.metodo_pago === 'Cuotas' ? 1 : 0,
          proximo_vencimiento: a.lead_id === 'lead-oct-1' ? '2026-11-15' : a.metodo_pago === 'Cuotas' ? '2026-11-10' : null,
          closer: a.closer,
          es_reembolso: false,
          source: a.source,
        });
      }
    }
  }
  // Reembolsos (sección 10): Martinetti y Murakami
  out.push({ id: 'cob-ref-1', agenda_id: 'ag-oct-2', fecha_cobro: '2026-10-07', monto_cobrado: 1500, pendiente: 0, cuotas_restantes: 0, closer: 'Marcos', es_reembolso: false, source: 'migracion', notas: 'Pago original' });
  out.push({ id: 'cob-ref-2', agenda_id: 'ag-oct-2', fecha_cobro: '2026-10-18', monto_cobrado: -1500, pendiente: 0, cuotas_restantes: 0, closer: 'Marcos', es_reembolso: true, source: 'manual', notas: 'Reembolso Martinetti' });
  out.push({ id: 'cob-ref-3', agenda_id: 'ag-oct-3', fecha_cobro: '2026-10-08', monto_cobrado: 1200, pendiente: 0, cuotas_restantes: 0, closer: 'Andrea', es_reembolso: false, source: 'migracion', notas: 'Pago original' });
  out.push({ id: 'cob-ref-4', agenda_id: 'ag-oct-3', fecha_cobro: '2026-10-19', monto_cobrado: -1200, pendiente: 0, cuotas_restantes: 0, closer: 'Andrea', es_reembolso: true, source: 'manual', notas: 'Reembolso Murakami' });
  // Old cash: cobranza de una venta de septiembre que pagó en octubre
  out.push({ id: 'cob-old-1', agenda_id: 'ag-sep-3', fecha_cobro: '2026-10-05', monto_cobrado: 600, pendiente: 0, cuotas_restantes: 0, closer: 'Marcos', es_reembolso: false, source: 'migracion', notas: 'Segunda cuota (venta de septiembre)' });
  return out;
}

function construirSetter(): SetterDiario[] {
  const rand = rng(3);
  const out: SetterDiario[] = [];
  for (const mes of ['2026-09', '2026-10']) {
    for (const fecha of diasDelMes(mes)) {
      if (fecha > '2026-10-27') break;
      const org = 28 + Math.floor(rand() * 16);
      const pag = fecha >= '2026-10-04' && fecha <= '2026-10-12' ? 20 + Math.floor(rand() * 30) : 4 + Math.floor(rand() * 8);
      out.push({
        fecha,
        conv_organicas: org,
        conv_pagadas: pag,
        bienvenidas: Math.round((org + pag) * 0.9),
        conv_frio: 5 + Math.floor(rand() * 10),
        mensajes_seguimiento: 20 + Math.floor(rand() * 20),
        respuestas: 10 + Math.floor(rand() * 15),
        seguimientos: 15 + Math.floor(rand() * 15),
        links_enviados: 3 + Math.floor(rand() * 6),
        agendas: null,
        source: 'ig',
      });
    }
  }
  return out;
}

function construirAds(): AdsDiario[] {
  const rand = rng(11);
  const out: AdsDiario[] = [];
  // Follow Me Ads: 1.034,15 USD entre 21/9 y 25/10 (35 días) ≈ 29,55/día, 18.324 visitas
  const dias: string[] = [];
  for (let d = 21; d <= 30; d++) dias.push(`2026-09-${d}`);
  for (let d = 1; d <= 25; d++) dias.push(`2026-10-${String(d).padStart(2, '0')}`);
  const base = 1034.15 / dias.length;
  const visitasBase = 18324 / dias.length;
  dias.forEach((fecha, i) => {
    const f = 0.85 + rand() * 0.3;
    const inversion = Math.round(base * f * 100) / 100;
    const impresiones = Math.round(inversion * (900 + rand() * 300));
    const alcance = Math.round(impresiones / (1.3 + rand() * 0.4));
    const visitas = Math.round(visitasBase * f);
    const seguidores = Math.round(visitas * (0.09 + rand() * 0.05));
    out.push({
      fecha, campana: 'follow_me', inversion, impresiones, alcance,
      frecuencia: Math.round((impresiones / alcance) * 100) / 100,
      cpm: Math.round((inversion / impresiones) * 1000 * 100) / 100,
      ctr: Math.round((visitas / impresiones) * 10000) / 10000,
      visitas_perfil: visitas, seguidores, conversaciones: null,
      bitacora: i === 0 ? 'Arranca Follow Me Ads' : fecha === '2026-10-04' ? 'Webinar en vivo, se solapa con campaña' : null,
      source: 'meta',
    });
  });
  // Webinar 4/10: 2.449,32 USD, 975 registros. Se reparte 25/9 → 4/10.
  const diasW: string[] = [];
  for (let d = 25; d <= 30; d++) diasW.push(`2026-09-${d}`);
  for (let d = 1; d <= 4; d++) diasW.push(`2026-10-0${d}`);
  const baseW = 2449.32 / diasW.length;
  diasW.forEach((fecha) => {
    const f = 0.8 + rand() * 0.4;
    const inversion = Math.round(baseW * f * 100) / 100;
    const impresiones = Math.round(inversion * (700 + rand() * 200));
    out.push({
      fecha, campana: 'webinar', inversion, impresiones,
      alcance: Math.round(impresiones / 1.6),
      frecuencia: 1.6,
      cpm: Math.round((inversion / impresiones) * 1000 * 100) / 100,
      ctr: 0.012,
      visitas_perfil: null, seguidores: null,
      conversaciones: Math.round(975 / diasW.length * f),
      source: 'meta',
    });
  });
  // Webinar 6/9: 286,92 USD
  out.push({ fecha: '2026-09-04', campana: 'webinar', inversion: 150, impresiones: 110000, alcance: 70000, frecuencia: 1.57, cpm: 1.36, ctr: 0.011, visitas_perfil: null, seguidores: null, conversaciones: 160, source: 'meta' });
  out.push({ fecha: '2026-09-05', campana: 'webinar', inversion: 136.92, impresiones: 98000, alcance: 64000, frecuencia: 1.53, cpm: 1.4, ctr: 0.011, visitas_perfil: null, seguidores: null, conversaciones: 140, source: 'meta' });
  return out;
}

function construirOrganico(): { diario: OrganicoDiario[]; piezas: OrganicoPieza[] } {
  const rand = rng(5);
  const tipos: OrganicoDiario['tipo_historia'][] = ['CTA a LM', 'Nutrición', 'Q&A', 'Personal', 'CTA de Venta'];
  const palabras = ['CLASE', 'MIRO', 'GUIA', 'VENTA', 'CIERRE', 'SETTER', 'LLAMADA'];
  const diario: OrganicoDiario[] = [];
  const piezas: OrganicoPieza[] = [];
  for (const fecha of diasDelMes('2026-10')) {
    if (fecha > '2026-10-27') break;
    const esReel = rand() < 0.45;
    const views1 = 2400 + Math.floor(rand() * 900);
    const cant = 3 + Math.floor(rand() * 6);
    const respuestas = fecha === '2026-10-08' ? 331 : 8 + Math.floor(rand() * 30);
    diario.push({
      fecha,
      tipo_historia: tipos[Math.floor(rand() * tipos.length)],
      views_primera: views1,
      views_ultima: Math.round(views1 * (0.45 + rand() * 0.3)),
      cantidad_historias: cant,
      respuestas,
      respuestas_encuesta: rand() < 0.4 ? Math.floor(rand() * 120) : null,
      formato_reel: esReel ? (rand() < 0.8 ? 'Reel' : 'Carrusel') : null,
      tipo_cta: esReel ? palabras[Math.floor(rand() * palabras.length)] : null,
      comentarios_48h: esReel ? 10 + Math.floor(rand() * 60) : null,
      notas: fecha === '2026-10-08' ? 'Dato de Meta anómalo, a confirmar' : null,
      source: 'ig',
    });
    piezas.push({
      ig_media_id: `hist-${fecha}`, fecha, tipo: 'historia', titulo: `Historias ${fecha.slice(8)}/10`,
      views: views1, respuestas, promocionado: false, a_confirmar: fecha === '2026-10-08',
    });
    if (esReel) {
      const palabra = palabras[Math.floor(rand() * palabras.length)];
      piezas.push({
        ig_media_id: `reel-${fecha}`, fecha, tipo: 'reel', titulo: `Reel «${palabra}»`,
        views: 1500 + Math.floor(rand() * 6000), comentarios: 10 + Math.floor(rand() * 60),
        guardados: Math.floor(rand() * 80), compartidos: Math.floor(rand() * 40),
        promocionado: rand() < 0.1, url: 'https://www.instagram.com/marcoslanci/',
      });
    }
  }
  // Top históricos (sección 10)
  piezas.push({ ig_media_id: 'reel-clase', fecha: '2026-09-19', tipo: 'reel', titulo: 'Reel «CLASE»', views: 8200, comentarios: 173, guardados: 140, compartidos: 60, promocionado: false, url: 'https://www.instagram.com/marcoslanci/' });
  piezas.push({ ig_media_id: 'reel-miro', fecha: '2026-09-30', tipo: 'reel', titulo: 'Reel «MIRO»', views: 10139, comentarios: 44, guardados: 210, compartidos: 95, promocionado: false, url: 'https://www.instagram.com/marcoslanci/' });
  return { diario, piezas };
}

export function sampleBundle(): RawBundle {
  const oct = construirAgendasOctubre();
  const sep = construirAgendasSeptiembre();
  const leads = [...oct.leads, ...sep.leads];
  const agendas = [...oct.agendas, ...sep.agendas].map((a) => ({ ...a, lead: leads.find((l) => l.id === a.lead_id) }));
  const org = construirOrganico();
  const ajustes: AjusteMensual[] = [
    { mes: '2026-09-01', costo_software: null, objetivo_asistencia: 0.6, objetivo_cierre_oferta: 0.3 },
    { mes: '2026-10-01', costo_software: null, objetivo_asistencia: 0.6, objetivo_cierre_oferta: 0.3, notas: 'Costo de software pendiente de cargar' },
  ];
  const log: LogAgente[] = [
    {
      id: 'log-1', fecha: '2026-10-27T11:00:00Z', source: 'agente',
      resumen: 'Agente: 3 confirmaciones por WhatsApp, 1 no-show (Axel), 2 reprogramaciones (Daniela y Tomás al 29/10).',
      pendientes: [
        'Asistencias sin marcar del 26/10: Gino, Gianluca, Tiago, Daniela, Elbio',
        'Asistencia sin marcar: Luis Paulino (14/10)',
        'Ventas sin monto en USD: Martín (~600 ARS), Damián (~600 ARS), Cristian (~67 ARS)',
        'Costo de software de octubre sin cargar',
      ],
    },
    { id: 'log-0', fecha: '2026-10-27T09:00:00Z', source: 'ghl', resumen: 'cron ok: 12 agendas, 2 días ads, 5 historias, 1 reel' },
  ];
  return {
    demo: true,
    leads,
    agendas,
    cobranzas: construirCobranzas(agendas),
    setter: construirSetter(),
    ads: construirAds(),
    organico: org.diario,
    piezas: org.piezas,
    ajustes,
    log,
    actualizaciones: [
      { fuente: 'GHL', fecha: '2026-10-27T09:00:00Z', ok: true },
      { fuente: 'Meta Ads', fecha: '2026-10-27T09:00:00Z', ok: true },
      { fuente: 'Instagram', fecha: '2026-10-27T09:00:00Z', ok: true },
      { fuente: 'Agente', fecha: '2026-10-27T11:00:00Z', ok: true },
    ],
  };
}
