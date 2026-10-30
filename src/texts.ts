import type { Texts } from './types'

export const TEXTS: Record<'en' | 'es', Texts> = {
  en: {
    title: 'We use cookies',
    message:
      'We use our own cookies to make this site work and, only if you agree, third-party cookies to measure visits, show relevant ads and play embedded content. You can accept them, reject them or choose which ones to allow.',
    policy: 'Cookie policy',
    accept: 'Accept all',
    reject: 'Reject all',
    settings: 'Choose',
    save: 'Save my choices',
    close: 'Close',
    settingsTitle: 'Cookie settings',
    settingsIntro: 'Choose which kinds of cookies you allow. You can change this at any time from the cookie button on the page.',
    alwaysOn: 'Always on',
    categories: {
      necessary: { title: 'Necessary', description: 'Needed for the site to work, for example to remember these choices. They cannot be switched off.' },
      analytics: { title: 'Analytics', description: 'Help us understand how the site is used, by counting visits and traffic sources.' },
      marketing: { title: 'Marketing', description: 'Used by advertising networks to show you relevant ads and measure campaigns.' },
      media: { title: 'Embedded media', description: 'Videos, maps and other content from sites like YouTube or Google Maps, which set their own cookies.' },
    },
    placeholder: 'This {service} content is blocked because it sets {category} cookies.',
    placeholderButton: 'Allow {category} cookies',
    floating: 'Cookie settings',
    scanTitle: 'Cookie scan',
  },
  es: {
    title: 'Usamos cookies',
    message:
      'Usamos cookies propias para que la web funcione y, solo si nos lo permites, cookies de terceros para medir las visitas, mostrar anuncios relevantes y reproducir contenido insertado. Puedes aceptarlas, rechazarlas o elegir cuáles permitir.',
    policy: 'Política de cookies',
    accept: 'Aceptar todas',
    reject: 'Rechazar todas',
    settings: 'Elegir',
    save: 'Guardar mi elección',
    close: 'Cerrar',
    settingsTitle: 'Configuración de cookies',
    settingsIntro: 'Elige qué tipos de cookies permites. Puedes cambiarlo cuando quieras desde el botón de cookies de la página.',
    alwaysOn: 'Siempre activas',
    categories: {
      necessary: { title: 'Necesarias', description: 'Imprescindibles para que la web funcione, por ejemplo para recordar esta elección. No se pueden desactivar.' },
      analytics: { title: 'Analíticas', description: 'Nos ayudan a entender cómo se usa la web, contando las visitas y de dónde vienen.' },
      marketing: { title: 'Publicidad', description: 'Las usan las redes de publicidad para mostrarte anuncios relevantes y medir campañas.' },
      media: { title: 'Contenido insertado', description: 'Vídeos, mapas y otros contenidos de sitios como YouTube o Google Maps, que ponen sus propias cookies.' },
    },
    placeholder: 'Este contenido de {service} está bloqueado porque usa cookies de {category}.',
    placeholderButton: 'Permitir cookies de {category}',
    floating: 'Configuración de cookies',
    scanTitle: 'Análisis de cookies',
  },
}
