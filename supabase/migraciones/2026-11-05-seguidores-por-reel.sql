-- Seguidores y visitas al perfil que trae cada reel (estadísticas de Instagram, si las da para esa pieza).
alter table organico_piezas add column if not exists seguidores int check (seguidores >= 0);
alter table organico_piezas add column if not exists visitas_perfil int check (visitas_perfil >= 0);
-- Respuesta del formulario de agenda: "¿Qué video nuestro te hizo seguirnos?"
alter table leads add column if not exists video_origen text;
-- Seguidores nuevos de la cuenta por día (Instagram, orgánico + pauta): para el costo por seguidor de Follow Me Ads,
-- porque las campañas de mensajes/interacción no informan seguidores.
alter table organico_diario add column if not exists seguidores_nuevos int check (seguidores_nuevos >= 0);
