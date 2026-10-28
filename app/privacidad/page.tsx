export const metadata = { title: 'Política de privacidad · Speak Sellers Dashboard' };

export default function Privacidad() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-16 text-[15px] leading-relaxed text-text-muted">
      <div className="eyebrow">Speak Sellers · Métricas</div>
      <h1 className="h1 text-text">Política de privacidad</h1>
      <p>Speak Sellers Dashboard es una herramienta interna de Speak Sellers (LANZA SELLING LLC) para ver métricas comerciales. No es un servicio abierto al público.</p>
      <h2 className="h3 text-text">Qué datos usamos</h2>
      <p>Al ingresar con Google recibimos solo tu nombre, tu email y tu foto de perfil. Los usamos únicamente para verificar que tu email está autorizado y para registrar quién hizo cada carga de datos.</p>
      <h2 className="h3 text-text">Qué no hacemos</h2>
      <p>No vendemos, compartimos ni usamos tus datos para publicidad. No accedemos a tu Gmail, Drive ni a ningún otro servicio de Google.</p>
      <h2 className="h3 text-text">Dónde se guardan</h2>
      <p>Los datos se guardan en una base de datos privada (Supabase) con acceso restringido a usuarios autorizados.</p>
      <h2 className="h3 text-text">Borrar tus datos</h2>
      <p>Para pedir que borremos tu acceso o tus datos, escribí a joaquin@salesspawn.com.</p>
      <p className="text-[13px] text-text-disabled">Última actualización: octubre de 2026.</p>
    </main>
  );
}
