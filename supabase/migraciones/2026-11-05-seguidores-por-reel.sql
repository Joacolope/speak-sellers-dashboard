-- Seguidores y visitas al perfil que trae cada reel (estadísticas de Instagram, si las da para esa pieza).
alter table organico_piezas add column if not exists seguidores int check (seguidores >= 0);
alter table organico_piezas add column if not exists visitas_perfil int check (visitas_perfil >= 0);
-- Respuesta del formulario de agenda: "¿Qué video nuestro te hizo seguirnos?"
alter table leads add column if not exists video_origen text;
