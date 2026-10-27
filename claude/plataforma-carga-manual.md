# Carga manual vía Claude · Speak Sellers Dashboard

Joaco dicta, Claude escribe en Supabase. Patrón de uso en cualquier chat del proyecto.

## Cómo escribir

Opción A (preferida): MCP de Supabase, tablas `agendas`, `cobranzas`, `leads`, `ajustes_mensuales`.
Opción B: `POST https://speak-sellers-dashboard.vercel.app/api/cargar` con JSON y el `pin` (`PIN_CARGA`):

```json
{ "pin": "1234", "tipo": "venta", "nombre": "Elías Sánchez", "compro": "Si", "metodo_pago": "PIF", "cash_collected": 1200, "revenue": 1200 }
{ "pin": "1234", "tipo": "cobranza", "nombre": "Betina", "fecha_cobro": "2026-10-27", "monto_cobrado": 670, "pendiente": 1000, "cuotas_restantes": 1, "proximo_vencimiento": "2026-11-15" }
{ "pin": "1234", "tipo": "cobranza", "nombre": "Martinetti", "fecha_cobro": "2026-10-18", "monto_cobrado": -1500 }
{ "pin": "1234", "tipo": "asistencia", "nombre": "Axel", "asistio": "No show" }
```

## Traducción de frases

| Joaco dice | Claude hace |
|---|---|
| "Elías pagó 1200 PIF" | agenda de Elías: `asistio=Asistió`, `oferta_hecha=true`, `compro=Si`, `metodo_pago=PIF`, `cash_collected=1200`, `revenue=1200`, `source=manual` + cobranza de 1200 |
| "Betina pagó 670 hoy, le quedan 1000 para mediados de noviembre" | cobranza 670 con `pendiente=1000`, `proximo_vencimiento=2026-11-15`; `cash_collected` acumulado |
| "Les devolvimos a Martinetti y Murakami" | cobranzas negativas (`es_reembolso=true`) y `compro=No` |
| "Axel fue no show" | `asistio=No show` |
| "El software de octubre salió 180" | `ajustes_mensuales` mes 2026-10-01, `costo_software=180` |

## Reglas

1. Buscar el lead por nombre (ilike). Si hay más de un match, preguntar antes de escribir.
2. Escribir solo en celdas vacías, o confirmar antes de pisar un valor existente.
3. Siempre `source = manual`. El cron nunca pisa lo manual.
4. Montos en USD tal cual se cobran. Si es ARS, pedir el equivalente en USD; no convertir solo.
5. Responder con el cambio hecho y el efecto en el total del mes, en una línea.
6. Si el dato no tiene dónde ir, decirlo. No inventar columnas.
