-- Por ahora no se paga comisión de plataformas de cobro: la tarifa de Stripe que se había
-- precargado (4,4 % + 0,30 USD) pasa a 0. Cuando empiecen a pagarla se cambia desde Costos.
-- Idempotente: después de la primera corrida ya no hay filas que cumplan el where.
update comisiones_plataformas
set porcentaje = 0, fijo = 0,
    notas = 'Por ahora sin comisión. Cuando empiecen a cobrar: 2,9 % + 1,5 % internacional + 0,30 USD'
where plataforma = 'Stripe' and source = 'manual' and porcentaje = 4.4 and fijo = 0.30 and fecha_baja is null;
