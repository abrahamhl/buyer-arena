import type { Lang } from './messages.js';

/**
 * Translations of the story material ("flavor") keyed by the English source phrase.
 * Written gender-neutral on purpose: persona gender is unknown, so no gendered adjectives.
 * Templates without an entry fall back to English.
 */
export const FLAVOR: Record<string, Partial<Record<Lang, string>>> = {
  // price-sensitive
  'works alone as a freelance designer': {
    es: 'trabaja por cuenta propia en diseño',
    nl: 'werkt als zelfstandig ontwerper',
  },
  'runs a one-person bookkeeping practice': {
    es: 'lleva en solitario una gestoría contable',
    nl: 'runt een eenmanszaak in boekhouding',
  },
  'sells illustrations part-time': {
    es: 'vende ilustraciones a tiempo parcial',
    nl: 'verkoopt parttime illustraties',
  },
  'builds invoices by hand in a spreadsheet': {
    es: 'hace las facturas a mano en una hoja de cálculo',
    nl: 'maakt facturen met de hand in een spreadsheet',
  },
  'forgets to chase late payments': {
    es: 'se olvida de reclamar los pagos atrasados',
    nl: 'vergeet late betalingen na te jagen',
  },
  'loses track of what was billed': {
    es: 'pierde la cuenta de lo que ya ha facturado',
    nl: 'verliest het overzicht over wat al gefactureerd is',
  },
  'a client paid two months late': {
    es: 'un cliente pagó con dos meses de retraso',
    nl: 'een klant twee maanden te laat betaalde',
  },
  'a friend mentioned this tool': {
    es: 'alguien de confianza le habló de esta herramienta',
    nl: 'een vriend deze tool noemde',
  },
  'the old tool raised its price': {
    es: 'su herramienta anterior subió de precio',
    nl: 'de oude tool duurder werd',
  },
  'cancelled a tool after a surprise price increase': {
    es: 'canceló una herramienta tras una subida de precio inesperada',
    nl: 'zegde een tool op na een onverwachte prijsverhoging',
  },
  'uses free spreadsheets': { es: 'usa hojas de cálculo gratuitas', nl: 'gebruikt gratis spreadsheets' },
  // goal-focused
  'manages a four-person design agency': {
    es: 'dirige una agencia de diseño de cuatro personas',
    nl: 'leidt een ontwerpbureau met vier mensen',
  },
  'runs operations at a small consultancy': {
    es: 'lleva las operaciones de una pequeña consultora',
    nl: 'regelt de bedrijfsvoering bij een klein adviesbureau',
  },
  'leads a boutique dev studio': {
    es: 'dirige un pequeño estudio de desarrollo',
    nl: 'leidt een kleine ontwikkelstudio',
  },
  'spends five hours a week producing invoices': {
    es: 'dedica cinco horas a la semana a hacer facturas',
    nl: 'besteedt vijf uur per week aan facturen maken',
  },
  'chases payments manually': { es: 'reclama los pagos a mano', nl: 'jaagt betalingen handmatig na' },
  'has no view of outstanding revenue': {
    es: 'no tiene visibilidad de lo pendiente de cobro',
    nl: 'heeft geen zicht op openstaande omzet',
  },
  'the quarter closes on Friday': { es: 'el trimestre cierra el viernes', nl: 'het kwartaal vrijdag sluit' },
  'the accountant asked for cleaner records': {
    es: 'la gestoría pidió registros más limpios',
    nl: 'de accountant om nettere administratie vroeg',
  },
  'a big client needs proper invoices': {
    es: 'un cliente grande necesita facturas en regla',
    nl: 'een grote klant nette facturen nodig heeft',
  },
  'abandoned two SaaS tools because onboarding was too complicated': {
    es: 'abandonó dos herramientas SaaS porque la puesta en marcha era demasiado complicada',
    nl: 'stopte met twee SaaS-tools omdat de onboarding te ingewikkeld was',
  },
  'has bought SaaS with a company card before': {
    es: 'ya ha comprado SaaS con la tarjeta de empresa',
    nl: 'heeft eerder SaaS gekocht met een bedrijfscreditcard',
  },
  // novice
  'runs a small family bakery': {
    es: 'tiene una pequeña panadería familiar',
    nl: 'heeft een kleine familiebakkerij',
  },
  'owns a local repair shop': {
    es: 'tiene un taller de reparaciones en el barrio',
    nl: 'heeft een reparatiewinkel in de buurt',
  },
  'is a retired teacher who tutors': {
    es: 'da clases particulares tras jubilarse de la docencia',
    nl: 'geeft bijles na een loopbaan in het onderwijs',
  },
  'writes invoices in a word processor': {
    es: 'escribe las facturas en un procesador de textos',
    nl: 'schrijft facturen in een tekstverwerker',
  },
  'is unsure what fields an invoice needs': {
    es: 'no sabe bien qué datos debe llevar una factura',
    nl: 'weet niet goed welke velden een factuur nodig heeft',
  },
  'is afraid of doing taxes wrong': {
    es: 'tiene miedo de equivocarse con los impuestos',
    nl: 'is bang om fouten te maken met de belasting',
  },
  'a nephew recommended trying software': {
    es: 'un familiar le recomendó probar un programa',
    nl: 'een familielid aanraadde software te proberen',
  },
  'a customer asked for a proper invoice': {
    es: 'un cliente pidió una factura en condiciones',
    nl: 'een klant om een echte factuur vroeg',
  },
  'saw an advert': { es: 'vio un anuncio', nl: 'er een advertentie voorbijkwam' },
  'finds most software confusing': {
    es: 'encuentra confusa la mayoría del software',
    nl: 'vindt de meeste software verwarrend',
  },
  'has never signed up for a SaaS product': {
    es: 'nunca se ha dado de alta en un producto SaaS',
    nl: 'heeft zich nog nooit aangemeld voor een SaaS-product',
  },
  // mobile-rushed
  'is a self-employed electrician': {
    es: 'trabaja por cuenta propia como electricista',
    nl: 'werkt als zelfstandig elektricien',
  },
  'is a mobile hairdresser': { es: 'trabaja en peluquería a domicilio', nl: 'werkt als kapper aan huis' },
  'runs a one-van moving business': {
    es: 'tiene una pequeña empresa de mudanzas con una furgoneta',
    nl: 'heeft een verhuisbedrijfje met één busje',
  },
  'writes invoices at night after work': {
    es: 'hace las facturas de noche, después del trabajo',
    nl: 'maakt facturen ’s avonds na het werk',
  },
  'forgets small jobs': {
    es: 'se olvida de facturar los trabajos pequeños',
    nl: 'vergeet kleine klussen te factureren',
  },
  'has only a phone during the day': {
    es: 'durante el día solo tiene el móvil',
    nl: 'heeft overdag alleen een telefoon',
  },
  'a job just finished and the customer is waiting': {
    es: 'acaba de terminar un trabajo y el cliente está esperando',
    nl: 'net een klus klaar is en de klant wacht',
  },
  'a customer asked for an invoice by email': {
    es: 'un cliente pidió la factura por correo',
    nl: 'een klant om een factuur per e-mail vroeg',
  },
  'saw a social media ad': {
    es: 'vio un anuncio en redes sociales',
    nl: 'er een advertentie op sociale media voorbijkwam',
  },
  'does almost everything on the phone': {
    es: 'lo hace casi todo con el móvil',
    nl: 'doet bijna alles op de telefoon',
  },
  'gave up on apps that need a laptop': {
    es: 'dejó las apps que necesitan portátil',
    nl: 'haakte af bij apps die een laptop nodig hebben',
  },
  // skeptic
  'is the finance lead at a 12-person nonprofit': {
    es: 'lleva las finanzas de una ONG de 12 personas',
    nl: 'is verantwoordelijk voor financiën bij een non-profit met 12 mensen',
  },
  'handles money at a small architecture firm': {
    es: 'gestiona el dinero de un pequeño estudio de arquitectura',
    nl: 'beheert de financiën van een klein architectenbureau',
  },
  'is a controller at a family business': {
    es: 'hace el control financiero de una empresa familiar',
    nl: 'is controller bij een familiebedrijf',
  },
  'is losing the current tool, which is being discontinued': {
    es: 'va a perder su herramienta actual, que desaparece',
    nl: 'raakt de huidige tool kwijt, want die stopt',
  },
  'has had messy records flagged by auditors': {
    es: 'ha recibido observaciones de auditoría por registros desordenados',
    nl: 'kreeg van de auditors opmerkingen over rommelige administratie',
  },
  'spends days on reconciliation': {
    es: 'tarda días en cuadrar las cuentas',
    nl: 'is dagen bezig met afstemmen',
  },
  'three alternatives are being compared this week': {
    es: 'esta semana está comparando tres alternativas',
    nl: 'er deze week drie alternatieven worden vergeleken',
  },
  'the board asked for a recommendation': {
    es: 'la junta pidió una recomendación',
    nl: 'het bestuur om een advies vroeg',
  },
  'a vendor contract ends next month': {
    es: 'un contrato con un proveedor vence el mes que viene',
    nl: 'een leverancierscontract volgende maand afloopt',
  },
  'was once billed after cancelling a trial': {
    es: 'una vez recibió un cobro después de cancelar una prueba',
    nl: 'kreeg ooit een rekening na het opzeggen van een proefperiode',
  },
  'reads refund terms before buying anything': {
    es: 'lee las condiciones de reembolso antes de comprar nada',
    nl: 'leest de terugbetalingsvoorwaarden voordat er iets gekocht wordt',
  },
};

export const flavor = (text: string, lang: Lang): string =>
  lang === 'en' ? text : (FLAVOR[text]?.[lang] ?? text);
