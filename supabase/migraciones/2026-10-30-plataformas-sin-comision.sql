-- Por ahora no se paga comisión de plataformas de cobro: la tarifa de Stripe que se había
-- precargado (4,4 % + 0,30 USD) pasa a 0. Cuando empiecen a pagarla se cambia desde Costos.
-- Idempotente: después de la primera corrida ya no hay filas que cumplan el where.
-- Desde noviembre de 2026 la comisión de Stripe sí se descuenta (4,4 % + 0,30 USD, cargada desde Costos).
update comisiones_plataformas
set porcentaje = 0, fijo = 0,
    notas = 'Por ahora sin comisión. Cuando empiecen a cobrar: 2,9 % + 1,5 % internacional + 0,30 USD'
where plataforma = 'Stripe' and source = 'manual' and porcentaje = 4.4 and fijo = 0.30 and fecha_baja is null
  -- Solo la tarifa precargada al principio: la que se cargó después a propósito (noviembre en adelante) no se toca
  and fecha_alta < date '2026-10-31';
