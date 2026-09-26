// Buyer Arena website copy. One object per language, same keys in all three (ES · EN · NL, in that order).
// Strings may contain a little trusted inline HTML (<em>, <code>, <b>); everything else is escaped by the templates.

export const LANGS = ['es', 'en', 'nl'];

export const REPO = 'https://github.com/abrahamhl/buyer-arena';
export const WORKFLOW = 'https://github.com/abrahamhl/buyer-arena/actions/workflows/launch-check.yml';

// Commands. `clone` and `cd` are only rendered when SITE_LAUNCH_STATE=public.
export const COMMANDS = {
  clone: 'git clone https://github.com/abrahamhl/buyer-arena.git',
  cd: 'cd buyer-arena',
  install: 'npm install',
  demo: 'npm run demo',
  studio: 'npm run ba -- studio',
  launch: 'npm run ba -- launch-check --repo . --url https://your-site.example --success-text "welcome"',
  agentEval: 'npm run ba -- agent-eval --repo .',
  mcp: 'npm run ba -- mcp',
};

// Panel keys in CLI order (--mix users=..,developers=..,commercial=..,security=..,segments=..)
export const PANELS = ['users', 'developers', 'commercial', 'security', 'segments'];

// Integration wall: names are proper nouns (no logos); statuses are fixed product labels.
// [name, status, optional note key]
export const STATUSES = ['built', 'supported', 'adapter', 'experimental', 'planned'];
export const STATUS_LABEL = {
  built: 'BUILT IN',
  supported: 'SUPPORTED',
  adapter: 'ADAPTER',
  experimental: 'EXPERIMENTAL',
  planned: 'PLANNED',
};
export const INTEGRATIONS = [
  {
    key: 'models',
    items: [
      ['Anthropic', 'built'],
      ['OpenAI-compatible (OpenAI, vLLM, llama.cpp, LocalAI)', 'built'],
      ['OpenRouter', 'supported'],
      ['LM Studio', 'built'],
      ['Ollama', 'built'],
      ['OpenCode', 'adapter'],
    ],
  },
  {
    key: 'browser',
    items: [
      ['Playwright', 'built'],
      ['Browser Use', 'adapter', 'sidecar'],
      ['Stagehand', 'experimental'],
    ],
  },
  {
    key: 'evals',
    items: [
      ['Promptfoo', 'supported'],
      ['DeepEval', 'adapter'],
      ['Inspect AI', 'adapter'],
      ['lm-evaluation-harness', 'adapter'],
    ],
  },
  {
    key: 'security',
    items: [
      ['garak', 'supported'],
      ['PyRIT', 'experimental'],
      ['Gitleaks', 'supported'],
      ['Trivy', 'supported'],
      ['Nuclei', 'experimental', 'importOnly'],
    ],
  },
  {
    key: 'obs',
    items: [
      ['OpenTelemetry', 'adapter', 'genai'],
      ['Langfuse', 'adapter', 'viaOtel'],
      ['Phoenix', 'adapter', 'viaOtel'],
    ],
  },
];

// Numbers from the bundled demo run published at report/demo/report.html
// (session 20260925-154713-634c, 20 seeded buyers × 2 versions, deterministic, network LOCAL).
export const DEMO_FACTS = {
  baseline: 40,
  candidate: 75,
  delta: 35,
  ciLow: 15,
  ciHigh: 55,
  journeys: 40,
  shots: 217,
};

export const content = {
  es: {
    lang: 'es',
    locale: 'es-ES',
    label: 'Español',
    meta: {
      index: {
        title: 'Buyer Arena — evaluación basada en evidencia para software de personas y agentes IA',
        desc: 'Mide qué pasa antes de que tus usuarios den con los problemas: recorridos reales en navegador, compradores sintéticos y herramientas de seguridad. Local primero.',
      },
      run: {
        title: 'Configurador de ejecución · Buyer Arena',
        desc: 'Elige cuánta atención recibe cada panel, el tamaño y la profundidad, y copia el comando exacto de Buyer Arena para tu repositorio y tu web.',
      },
      notFound: {
        title: 'Página no encontrada · Buyer Arena',
        desc: 'Esta dirección no existe en el sitio de Buyer Arena.',
      },
    },
    nav: {
      skip: 'Saltar al contenido',
      home: 'Inicio',
      how: 'Cómo funciona',
      report: 'Informe real',
      integrations: 'Integraciones',
      offline: 'Local primero',
      limits: 'Limitaciones',
      pricing: 'Precios',
      quickstart: 'Ejecutar en local',
      run: 'Configurador',
      theme: 'Cambiar entre tema claro y oscuro',
      langLabel: 'Idioma',
      sections: 'Secciones',
    },
    state: {
      prelaunch: 'Versión candidata privada — el código se abrirá tras una auditoría independiente',
      public: 'Código abierto · Apache-2.0',
      soon: 'disponible en el lanzamiento público',
    },
    hero: {
      title:
        'La capa de evaluación <em>basada en evidencia</em> para el software que crean personas y agentes IA.',
      sub: 'Mide lo que ocurre de verdad —recorridos reales en navegador, compradores sintéticos, herramientas de seguridad y de evaluación— antes de que tus usuarios encuentren los problemas. Local primero, sin atarte a ningún modelo ni proveedor.',
      priceHint: 'Núcleo gratuito · €0 · planes cloud previstos desde €29/mes — aún no a la venta',
      cta1: 'Ejecutar en local',
      cta2: 'Ver un informe real',
      source: 'Código en GitHub',
      sourceSoon: 'Código · llega con el lanzamiento',
      caption: 'Animación ilustrativa — datos de demostración',
      pause: 'Pausar animación',
      play: 'Reanudar animación',
      replay: 'Repetir animación',
      sceneLabel:
        'Animación ilustrativa con datos de demostración. Veinte compradores sintéticos recorren el embudo de un producto. En la versión base, 8 de 20 llegan al objetivo (40 %); varios abandonan en un registro que exige el teléfono y se guardan pruebas de cada fallo. La versión candidata mejorada llega a 15 de 20 (75 %): +35 puntos. Después, cinco rutas de modelo —Claude, GPT, Gemini, un modelo local y una heurística determinista— alimentan Buyer Arena, que devuelve desacuerdo, evidencia y confianza.',
      scene: {
        baseline: 'BASE',
        candidate: 'CANDIDATA',
        stages: ['precios', 'registro', 'pago', 'objetivo'],
        friction: 'pide el teléfono',
        chips: ['form_error · paso 3', 'captura · p-009', 'objeción · teléfono'],
        routes: ['Claude', 'GPT', 'Gemini', 'modelo local', 'heurística'],
        outputs: ['desacuerdo', 'evidencia', 'confianza'],
        legend: ['objetivo', 'abandona', 'fricción'],
      },
    },
    how: {
      title: 'De un cambio a una decisión, en siete pasos',
      lead: 'Buyer Arena se sitúa entre quien hizo el cambio —una persona o un agente IA— y la decisión de publicarlo.',
      steps: [
        [
          'Una persona o una IA construye software',
          'Una pull request, una rama o una vista previa desplegada. A Buyer Arena le da igual quién la escribió.',
        ],
        [
          'Buyer Arena evalúa el cambio',
          'En tu máquina, en CI o desde un agente por MCP. Cada ejecución registra su política de red.',
        ],
        [
          'Agentes de navegador y compradores sintéticos usan el producto',
          'Recorridos reales con Playwright, con capturas y eventos. Cada comprador es un perfil con semilla, objetivo, presupuesto y paciencia.',
        ],
        [
          'Las herramientas de seguridad y de evaluación aportan evidencia',
          'Promptfoo, garak, Gitleaks, Trivy y otras se conectan como adaptadores. Sus resultados son evidencia, no veredictos.',
        ],
        [
          'Buyer Arena normaliza la evidencia',
          'Todo pasa a Evidence Protocol v1: registros JSONL portables con origen, ubicación y confianza.',
        ],
        [
          'Se comparan la versión base y la candidata',
          'Los mismos perfiles en ambas versiones, diferencias emparejadas con intervalos, fricción resuelta y fricción nueva.',
        ],
        [
          'Datos agregados reales calibran las simulaciones futuras',
          'Cuando aportas resultados reales agregados, la calibración mide el error y marca cada ejecución como UNCALIBRATED, PARTIALLY CALIBRATED o CALIBRATED.',
        ],
      ],
      tags: ['', '', 'Playwright', '', 'Evidence Protocol v1', 'Δ +35 pp', ''],
    },
    report: {
      title: 'Un informe real, no una maqueta',
      lead: 'Veinte compradores sintéticos deterministas recorrieron en un navegador real dos versiones de la tienda de demostración incluida, «Tallybird». Este es el informe HTML que generó esa ejecución, sin retocar.',
      note: 'El producto de la demo es ficticio; los recorridos son reales y los compradores, sintéticos.',
      facts: {
        baseline: 'objetivo alcanzado, versión base',
        candidate: 'objetivo alcanzado, versión candidata',
        delta: 'diferencia · intervalo del 95 %',
        journeys: 'recorridos en navegador',
        shots: 'capturas',
        cost: 'coste de modelos · 0 tokens · red LOCAL',
      },
      points: [
        'Cada hallazgo cita un evento del recorrido, una captura, una URL o un <b>archivo:línea</b>.',
        'Exporta a CSV, PNG, JPG, Markdown, JSON y PDF; informe en español, inglés y neerlandés.',
        'Compradores deterministas: misma semilla, mismo resultado. Sin modelo y sin clave de API.',
      ],
      cta: 'Abrir el informe real',
      meta: 'Un solo archivo HTML · funciona sin conexión',
    },
    limits: {
      title: 'Limitaciones: léelas primero',
      lead: 'Lo que Buyer Arena mide hoy y lo que no.',
      items: [
        [
          'Un indicador de conversión, no ingresos',
          'Los compradores sintéticos miden si un recorrido llega a su objetivo. Es un indicador aproximado de conversión, no una previsión de ventas ni de ingresos.',
        ],
        [
          'Sin calibrar por defecto',
          'Hasta que aportes datos agregados reales, cada ejecución es UNCALIBRATED: toma las diferencias como una orientación.',
        ],
        [
          'Aún no se ha verificado una ejecución con un LLM en vivo',
          'Los compradores y las rutas con modelo están implementados y probados con modelos simulados; en esta versión no se ha verificado una ejecución real contra un proveedor de pago.',
        ],
        [
          'Ejecutar repositorios alojados es trabajo futuro',
          'Auditar un repositorio por URL es solo estático: los archivos se leen como datos. Etiqueta: STATIC AUDIT · NO CODE EXECUTED.',
        ],
        [
          'Lo experimental va marcado',
          'Todo lo que lleva la etiqueta EXPERIMENTAL puede cambiar o desaparecer antes de la 1.0.',
        ],
      ],
    },
    panels: {
      title: 'Cinco paneles, cinco intenciones',
      lead: 'Un lanzamiento falla por motivos distintos según quién mire. Cada panel busca lo suyo y lo puntúa con evidencia.',
      items: {
        users: {
          name: 'Personas usuarias',
          intent: '¿Dónde se pierden las conversiones y por qué?',
          points: [
            'Recorridos reales en navegador hechos por compradores sintéticos.',
            'Embudo paso a paso, fricción detectada y abandono.',
            'Comparación entre versión base y candidata con diferencias emparejadas.',
          ],
        },
        developers: {
          name: 'Desarrollo',
          intent: '¿Cuánto tarda una persona recién llegada en conseguir su primer éxito?',
          points: [
            'Parte de una copia limpia y sigue el README al pie de la letra.',
            'Instala y ejecuta hasta el primer resultado que funciona (solo con --execute y repositorios de confianza).',
            'Mide el tiempo hasta el primer éxito y anota qué se rompe.',
          ],
        },
        commercial: {
          name: 'Preparación comercial',
          intent: '¿Está respaldada por evidencia la historia comercial?',
          points: [
            'Problema, diferenciación y encaje del modelo de negocio: código abierto, open core, SaaS, suscripción, servicios o API.',
            'Potencial de distribución e interés estratégico, con la evidencia detrás de cada señal.',
          ],
          note: 'Incluye una lente de inversión: señales para la due diligence, nunca una predicción de decisiones de inversión.',
        },
        security: {
          name: 'Equipo rojo',
          intent: '¿Por dónde entraría alguien con malas intenciones?',
          points: [
            'Secretos, dependencias, inyección en scripts de CI y scripts de instalación.',
            'Superficie de la web con Argus, privacidad y cookies.',
            'Superficie de ataque para agentes IA: inyección de prompts en skills, AGENTS.md y documentación, Unicode oculto, envenenamiento de herramientas MCP y permisos de agente demasiado amplios.',
          ],
        },
        segments: {
          name: 'Segmentos',
          intent: '¿Funciona para quien no se parece a tu equipo?',
          points: [
            'Públicos objetivos, no estereotipos.',
            'Accesibilidad, conexiones lentas, zoom al 200 % y móvil.',
            'Personas que no quieren crear una cuenta, y otros idiomas.',
          ],
        },
      },
    },
    caps: {
      title: 'Qué incluye esta versión',
      lead: 'En breve y con precisión. Lo experimental está marcado.',
      experimental: 'EXPERIMENTAL',
      items: [
        [
          'Evidence Protocol v1',
          'Evidencia portable en JSONL que cualquier herramienta puede escribir y leer.',
        ],
        [
          'SDK de integración',
          'Un contrato pequeño para añadir herramientas como adaptadores; <code>integrations list</code> muestra las disponibles.',
        ],
        [
          'agent-eval',
          'Evalúa lo que produjo un agente IA de programación —compilación, tests, tests borrados u omitidos, secretos, puertas de calidad— y nunca se fía de lo que el agente dice de sí mismo.',
        ],
        [
          'Router de modelos',
          'Fijación explícita del modelo y enrutado según coste: quality, balanced, economy u offline.',
        ],
        ['Informe de economía de tokens', 'Tokens y coste por ejecución, y coste por hallazgo.'],
        [
          'Caché exacta de respuestas',
          'Una petición idéntica se responde desde una caché local en lugar de ir al proveedor.',
        ],
        [
          'Flujo de PR en GitHub',
          'Un flujo reutilizable que publica un único comentario compacto con la diferencia.',
        ],
        [
          'Estados de calibración',
          'UNCALIBRATED · PARTIALLY CALIBRATED · CALIBRATED, con métricas de error.',
        ],
        [
          'Auditoría estática de repositorios',
          'Audita un repositorio público por URL sin ejecutarlo: STATIC AUDIT · NO CODE EXECUTED.',
        ],
        [
          'Conjunto de modelos',
          'Varias rutas de modelo sobre el mismo comprador para sacar a la luz el desacuerdo.',
          1,
        ],
      ],
    },
    integ: {
      title: 'Funciona con las herramientas que ya usas',
      lead: 'Solo texto, sin logotipos. Cada entrada indica hasta dónde llega la integración.',
      disclaimer: 'Se citan por interoperabilidad; no implica ninguna colaboración ni respaldo.',
      groups: {
        models: 'Modelos / pasarelas',
        browser: 'Navegador',
        evals: 'Evaluación de IA',
        security: 'Equipo rojo / seguridad',
        obs: 'Observabilidad',
      },
      notes: {
        sidecar: 'sidecar de referencia',
        importOnly: 'solo importación por defecto',
        genai: 'convenciones GenAI',
        viaOtel: 'vía OpenTelemetry',
      },
      legendTitle: 'Qué significa cada estado',
      legend: {
        built: 'Viene con Buyer Arena y está cubierto por tests.',
        supported: 'Funciona mediante un puente mantenido; la herramienta se instala aparte.',
        adapter: 'Hay un contrato o un adaptador de referencia; la herramienta la ejecutas tú.',
        experimental: 'Funciona en casos limitados y puede cambiar.',
        planned: 'En la hoja de ruta; todavía no está disponible.',
      },
    },
    offline: {
      title: 'Local primero, por diseño',
      lead: 'Nada sale de tu máquina salvo que elijas un modelo en la nube. Y cuando algo sale, la ejecución lo deja escrito.',
      points: [
        'Sin API de pago obligatoria',
        'Modo determinista',
        'LM Studio / Ollama',
        'Toda la evidencia se guarda en local',
        'Sin telemetría por defecto',
        'No hace falta subir el código',
        'La nube es opcional',
      ],
      machine: 'TU MÁQUINA',
      machineItems: ['repositorio', 'navegador', 'modelos locales', 'artefactos y evidencia'],
      lan: 'red privada (LAN, Docker)',
      cloud: 'NUBE OPCIONAL',
      cloudItem: 'solo el proveedor de modelos que elijas',
      cloudAny: 'cualquier host, con las reglas de seguridad',
      blocked: 'bloqueado',
      allowed: 'permitido',
      modesTitle: 'Política de red',
      modes: {
        offline:
          'Solo loopback. Funcionan los modelos locales, los destinos en localhost y los repositorios locales; nada más.',
        local: 'Loopback más tu red privada (LAN, Docker). Es el punto de partida si no eliges nada.',
        hybrid: 'Lo local más los proveedores de modelos que hayas elegido. Nada más sale de la máquina.',
        online:
          'Cualquier host, siempre dentro de las reglas de seguridad, como navegar solo en el mismo origen.',
      },
      ledger:
        'Cada ejecución registra qué salió de la máquina: hosts contactados, proveedores que recibieron datos y lo que se rechazó. Sin elección explícita, parte de LOCAL y solo se amplía para un destino que indiques en el comando, y lo avisa.',
    },
    mix: {
      title: 'Elige la mezcla',
      lead: 'Tú decides cuánta atención recibe cada panel. Antes de un lanzamiento, más personas usuarias; antes de abrir el código, más equipo rojo.',
      exampleLabel: 'Ejemplo: antes de un lanzamiento',
      depthTitle: 'Profundidad',
      depth: {
        quick: [
          'Rápida',
          'Menos participantes y recorridos más cortos. Para una comprobación antes de cada despliegue.',
        ],
        standard: ['Estándar', 'La opción por defecto. Suficiente para decidir si lanzar.'],
        deep: [
          'Profunda',
          'Más recorridos y más pasos por recorrido. Para antes de un lanzamiento importante.',
        ],
      },
      cta: 'Abrir el configurador',
    },
    quick: {
      title: 'Ejecutar en local',
      lead: 'Necesitas Node.js 22.12 o superior. La demo descarga una vez Chromium para Playwright.',
      soonTitle: 'Disponible en el lanzamiento público',
      soonText:
        'El código aún no es público. Estos son los comandos que usarás cuando se abra; hoy no hay nada que instalar.',
      steps: {
        clone: 'Clona el repositorio',
        cd: 'Entra en la carpeta',
        install: 'Instala las dependencias',
        demo: 'Ejecuta la demo y abre el informe que genera',
        studio: 'Abre la sala de control visual en local',
        launch: 'Audita tu propio producto: cambia la URL y el texto que indica éxito',
        agentEval: 'Evalúa lo que ha producido un agente IA en este repositorio',
      },
      copy: 'Copiar',
      copied: 'Copiado',
      ciTitle: 'En CI y desde el móvil',
      ciText:
        'El flujo «Launch check» corre en GitHub Actions y se lanza desde la app de GitHub. Un flujo reutilizable de PR publica un único comentario compacto con la diferencia.',
      ciLink: 'Abrir el flujo «Launch check»',
      agentsTitle: 'Desde agentes IA',
      agentsText: 'Un servidor MCP para que un agente lance auditorías y lea los resultados.',
      agentsNote: 'Escucha solo en localhost por defecto. Abrirlo a la red es una decisión explícita tuya.',
    },
    safety: {
      title: 'Seguridad y privacidad',
      lead: 'Una herramienta que prueba webs no debería convertirse en un riesgo.',
      items: [
        ['Corre en local', 'En tu máquina o en tu propio runner de CI. No hay servicio intermedio.'],
        ['Solo el origen que indicas', 'Visita únicamente el dominio que le das.'],
        ['Bloquea terceros', 'Las peticiones a otros dominios se bloquean durante los recorridos.'],
        ['Nunca datos de pago reales', 'Jamás introduce una tarjeta ni datos de pago reales.'],
        ['Tests sin coste', 'La batería de tests hace cero llamadas a APIs de pago.'],
        ['Un solo archivo', 'El informe es un HTML que funciona sin conexión.'],
      ],
    },
    pricing: {
      title: 'Precios y licencias',
      lead: 'El núcleo es completo y gratuito. Los planes de pago cobrarán por lo que operamos nosotros —ejecuciones alojadas, retención, colaboración, cumplimiento y tiempo de personas—, nunca por lo que ejecutas tú.',
      previewTitle: 'Precios fijados — aún no hay nada a la venta',
      previewText:
        'Aún no hay empresa, ni pasarela de pago, ni servicio alojado. Estos precios son un plan publicado, no incluyen IVA y pueden cambiar antes de vender nada.',
      forever: 'para siempre',
      perMonth: '/ mes',
      from: 'desde',
      licenceLabel: 'Licencia',
      status: { launch: 'EN EL LANZAMIENTO PÚBLICO', planned: 'PLANIFICADO' },
      licences: {
        apache: 'Apache-2.0 + política de marca',
        cloud: 'Términos cloud + acuerdo de tratamiento de datos',
        commercial: 'Licencia comercial de complementos + MSA',
      },
      runs: '{runs} recorridos / mes incluidos',
      over: 'después, {price} por cada 100 recorridos',
      plans: {
        community: {
          name: 'Community',
          who: 'Para todo el mundo',
          points: [
            'Los cinco paneles, Studio, MCP, agent-eval y todas las integraciones',
            'Modelos locales o con tu propia clave; ejecuciones ilimitadas en tu máquina o CI',
            'Soporte de la comunidad en GitHub',
          ],
        },
        starter: {
          name: 'Cloud Starter',
          who: 'Personas y equipos pequeños',
          points: [
            'Navegadores alojados, 3 proyectos, 30 días de retención',
            'Informes compartibles, usuarios ilimitados',
          ],
        },
        team: {
          name: 'Cloud Team',
          who: 'Equipos de producto e ingeniería',
          points: [
            'Puerta de PR para repositorios privados, historial de benchmarks de agentes',
            'Espacio de calibración, 1 año de retención, soporte por email',
          ],
        },
        enterprise: {
          name: 'Enterprise',
          who: 'Organizaciones grandes o reguladas',
          points: [
            'SSO/SAML, SCIM, registros de auditoría, residencia de datos en la UE',
            'Plano de control autoalojado o en VPC, SLA, contrato anual',
          ],
        },
      },
      unit: 'Un recorrido es un comprador sintético intentando un recorrido en una versión. Comparar antes/después con 20 compradores usa 40. Los tokens de los modelos nunca van escondidos en el precio.',
      servicesTitle: 'Servicios a precio cerrado',
      servicesLead:
        'Hechos con la herramienta de código abierto, para que puedas reproducir cada hallazgo después. Disponibles cuando exista la empresa.',
      services: {
        audit: [
          'Auditoría de lanzamiento',
          'Un producto, antes y después, los cinco paneles, informe escrito y una llamada de revisión.',
        ],
        agents: [
          'Benchmark de agentes',
          'De dos a cuatro agentes de programación con IA sobre tu repositorio, con la evidencia en bruto.',
        ],
        calibration: [
          'Puesta en marcha de calibración',
          'Conecta tus analíticas agregadas y recibe tu primer informe de calibración.',
        ],
        support: [
          'Soporte autoalojado',
          'Contrato de soporte para equipos que usan el núcleo abierto en producción.',
        ],
      },
      discounts:
        'Descuentos: Cloud Team gratis para proyectos de código abierto y ONG, Starter gratis para educación y 50 % el primer año para startups en fase inicial.',
      source: 'Detalles, fórmulas y referencias de mercado: docs/PRICING.md en el repositorio.',
    },
    roi: {
      title: 'Calcula tu retorno',
      lead: 'Cinco maneras en que Buyer Arena puede pagarse sola. La calculadora usa la fórmula de nuestro documento de precios; cambia los números por los tuyos.',
      paths: [
        ['Gasto en investigación evitado', 'Rondas de usabilidad que ya no necesitas en cada versión.'],
        [
          'Conversión recuperada',
          'Fricción encontrada antes del lanzamiento, contada en el límite inferior y por un factor de confianza.',
        ],
        ['Tiempo de ingeniería ahorrado', 'Caza de regresiones y QA manual que no tuviste que hacer.'],
        [
          'Gasto en modelos evitado',
          'Caché exacta, enrutado y modelos locales; cada ejecución informa de su economía de tokens.',
        ],
        [
          'Mejor elección de agente',
          'Elige el agente de programación con IA cuyos cambios pasan de verdad tus puertas.',
        ],
      ],
      calcTitle: 'Calculadora de ROI — ilustrativa',
      fields: {
        rounds: 'Rondas de usabilidad evitadas al año',
        roundCost: 'Coste total por ronda (€)',
        visitors: 'Visitantes al mes',
        uplift: 'Mejora real de conversión (puntos porcentuales)',
        value: 'Valor por conversión (€)',
        confidence: 'Factor de confianza (0–1)',
        hours: 'Horas de ingeniería ahorradas al año',
        rate: 'Coste por hora (€)',
        plan: 'Coste de Buyer Arena al mes (€)',
      },
      out: {
        a: 'Gasto en investigación evitado',
        b: 'Conversión recuperada',
        c: 'Tiempo de ingeniería ahorrado',
        cost: 'Coste de Buyer Arena',
        net: 'Neto al año',
        ratio: 'Retorno sobre el coste',
      },
      perYear: 'al año',
      note: 'Ilustrativo, no es un resultado de cliente. Buyer Arena mide una aproximación a la conversión, no ingresos; mientras una ejecución esté SIN CALIBRAR, mantén el factor de confianza en 0,5 o menos. El gasto en modelos y la elección de agente no entran en la calculadora.',
    },
    selfAudit: {
      label: 'AUTOAUDITORÍA — NO ES UNA VALIDACIÓN EXTERNA',
      title: 'Buyer Arena sobre sí mismo',
      text: 'Pasamos launch-check sobre el propio repositorio de Buyer Arena. La ejecución del 25-09-2026 obtuvo 84/100 (los paneles web miden la tienda demo ficticia, con defectos plantados, no a Buyer Arena). La herramienta se puntuó a sí misma: no es evidencia independiente ni la prueba en la que nos apoyamos; esa es el informe real de arriba.',
      link: 'Abrir el informe de autoauditoría',
    },
    footer: {
      tagline: 'La capa de evaluación basada en evidencia para el software que crean personas y agentes IA.',
      license: 'Licencia Apache-2.0',
      privacy: 'Privacidad: sin cookies, sin rastreadores',
      report: 'Informe real de demostración',
      selfAudit: 'Autoauditoría (no es validación externa)',
      langs: 'Idiomas',
    },
    run: {
      eyebrow: 'configurador · todo ocurre en tu navegador',
      title: 'Configura una ejecución',
      lead: 'Ajusta la mezcla y copia el comando. Nada sale de esta página.',
      mixTitle: 'Atención por panel',
      mixHelp: 'Pesos relativos. Se normalizan al 100 %.',
      size: 'Tamaño (participantes)',
      depth: 'Profundidad',
      depthOpts: { quick: 'Rápida', standard: 'Estándar', deep: 'Profunda' },
      repo: 'Ruta del repositorio',
      url: 'URL de tu web',
      execute: 'Ejecutar install/build (ejecuta el código del repositorio)',
      executeHelp: 'Solo con repositorios de confianza: el panel de desarrollo ejecutará sus scripts.',
      resultTitle: 'Resultado',
      panel: 'Panel',
      share: 'Reparto',
      participants: 'Participantes',
      total: 'Total',
      estimate: 'Tiempo aproximado',
      estimateNote: 'Estimación orientativa en un portátil; depende de tu web y de tu máquina.',
      minutes: 'min',
      command: 'Comando',
      copy: 'Copiar',
      copied: 'Copiado',
      ghTitle: 'Ejecutar en GitHub',
      ghLead: 'Abre el flujo, pulsa «Run workflow» y pega estos valores:',
      ghLink: 'Abrir «Launch check» en GitHub',
      reset: 'Restablecer',
      minNote: 'Mínimo 2 por panel y 5 en personas usuarias.',
      skipped: 'se omite',
      zeroError: 'Da algo de atención al menos a un panel.',
      under1: 'menos de 1 min',
      depthNote: 'La profundidad multiplica participantes: rápida ×0,5, profunda ×2.',
      soonNote: 'Comandos para cuando el código se abra: disponible en el lanzamiento público.',
    },
    notFound: {
      title: 'Esta página no existe',
      text: 'Puede que el enlace esté mal escrito o que la página se haya movido.',
      home: 'Volver al inicio',
    },
  },

  en: {
    lang: 'en',
    locale: 'en-GB',
    label: 'English',
    meta: {
      index: {
        title: 'Buyer Arena — evidence-first evaluation for software built by humans and AI agents',
        desc: 'Measure what happens before users find the problems: real browser journeys, synthetic buyers, security and eval tools. Offline-first and model-agnostic.',
      },
      run: {
        title: 'Run builder · Buyer Arena',
        desc: 'Set how much attention each panel gets, the size and the depth, then copy the exact Buyer Arena command for your repository and website.',
      },
      notFound: {
        title: 'Page not found · Buyer Arena',
        desc: 'This address does not exist on the Buyer Arena website.',
      },
    },
    nav: {
      skip: 'Skip to content',
      home: 'Home',
      how: 'How it works',
      report: 'Real report',
      integrations: 'Integrations',
      offline: 'Offline first',
      limits: 'Limitations',
      pricing: 'Pricing',
      quickstart: 'Run locally',
      run: 'Run builder',
      theme: 'Switch between light and dark theme',
      langLabel: 'Language',
      sections: 'Sections',
    },
    state: {
      prelaunch: 'Private release candidate — source opens after an independent audit',
      public: 'Open source · Apache-2.0',
      soon: 'available at public launch',
    },
    hero: {
      title: 'The <em>evidence-first</em> evaluation layer for software built by humans and AI agents.',
      sub: 'Measure what actually happens — real browser journeys, synthetic buyers, security and eval tools — before your users find the problems. Offline-first, model- and provider-agnostic.',
      priceHint: 'Free core · €0 · cloud plans planned from €29/month — not on sale yet',
      cta1: 'Run locally',
      cta2: 'View real report',
      source: 'Source on GitHub',
      sourceSoon: 'Source · coming at launch',
      caption: 'Illustrative animation — demo data',
      pause: 'Pause animation',
      play: 'Play animation',
      replay: 'Replay animation',
      sceneLabel:
        'Illustrative animation with demo data. Twenty synthetic buyers move through a product funnel. In the baseline, 8 of 20 reach the goal (40%); several drop out at a sign-up step that demands a phone number, and evidence is recorded for each failure. The improved candidate reaches 15 of 20 (75%): +35 points. Then five model routes — Claude, GPT, Gemini, a local model and a deterministic heuristic — feed Buyer Arena, which reports disagreement, evidence and confidence.',
      scene: {
        baseline: 'BASELINE',
        candidate: 'CANDIDATE',
        stages: ['pricing', 'sign-up', 'checkout', 'goal'],
        friction: 'phone required',
        chips: ['form_error · step 3', 'screenshot · p-009', 'objection · phone'],
        routes: ['Claude', 'GPT', 'Gemini', 'local model', 'heuristic'],
        outputs: ['disagreement', 'evidence', 'confidence'],
        legend: ['goal', 'abandoned', 'friction'],
      },
    },
    how: {
      title: 'From a change to a verdict, in seven steps',
      lead: 'Buyer Arena sits between whoever built the change — a person or an AI agent — and the decision to ship it.',
      steps: [
        [
          'An AI agent or a human builds software',
          'A pull request, a branch or a deployed preview. Buyer Arena does not care who wrote it.',
        ],
        [
          'Buyer Arena evaluates the change',
          'On your machine, in CI, or from an agent over MCP. Every run records its network policy.',
        ],
        [
          'Browser agents and synthetic buyers use the product',
          'Real Playwright journeys with screenshots and events. Each buyer is a seeded persona with a goal, a budget and limited patience.',
        ],
        [
          'Security and eval tools contribute evidence',
          'Promptfoo, garak, Gitleaks, Trivy and others plug in as adapters. Their results are evidence, not verdicts.',
        ],
        [
          'Buyer Arena normalises the evidence',
          'Everything becomes Evidence Protocol v1: portable JSONL records with a source, a location and a confidence.',
        ],
        [
          'Baseline and candidate are compared',
          'The same personas on both versions, paired deltas with intervals, friction resolved and friction introduced.',
        ],
        [
          'Real aggregate data calibrates future simulations',
          'When you bring real aggregate outcomes, calibration measures the error and marks each run UNCALIBRATED, PARTIALLY CALIBRATED or CALIBRATED.',
        ],
      ],
      tags: ['', '', 'Playwright', '', 'Evidence Protocol v1', 'Δ +35 pp', ''],
    },
    report: {
      title: 'A real report, not a mock-up',
      lead: 'Twenty deterministic synthetic buyers ran real browser journeys against two versions of the bundled demo store, “Tallybird”. This is the unedited HTML report that run produced.',
      note: 'Demo product is fictional; journeys are real, buyers are synthetic.',
      facts: {
        baseline: 'goal completion, baseline',
        candidate: 'goal completion, candidate',
        delta: 'delta · 95% interval',
        journeys: 'browser journeys',
        shots: 'screenshots',
        cost: 'model cost · 0 tokens · network LOCAL',
      },
      points: [
        'Every finding cites a journey event, a screenshot, a URL or <b>file:line</b>.',
        'Exports to CSV, PNG, JPG, Markdown, JSON and PDF; reports in Spanish, English and Dutch.',
        'Deterministic buyers: same seed, same result. No model and no API key needed.',
      ],
      cta: 'Open the real report',
      meta: 'Single HTML file · works offline',
    },
    limits: {
      title: 'Limitations — read these first',
      lead: 'What Buyer Arena measures today, and what it does not.',
      items: [
        [
          'A conversion proxy, not revenue',
          'Synthetic buyers measure whether a journey reaches its goal. That is a proxy for conversion, not a forecast of sales or revenue.',
        ],
        [
          'Uncalibrated by default',
          'Until you feed in real aggregate data, every run is UNCALIBRATED: read deltas as directional.',
        ],
        [
          'No live LLM run verified yet',
          'Model-backed buyers and routes are implemented and tested with scripted models; a real run against a paid provider has not been verified for this release.',
        ],
        [
          'Hosted repository execution is future work',
          'Auditing a repository by URL is static only: files are read as data. Label: STATIC AUDIT · NO CODE EXECUTED.',
        ],
        [
          'Experimental parts are labelled',
          'Anything marked EXPERIMENTAL may change or be removed before 1.0.',
        ],
      ],
    },
    panels: {
      title: 'Five panels, five intents',
      lead: 'A launch fails for different reasons depending on who is looking. Each panel looks for its own problems and scores them with evidence.',
      items: {
        users: {
          name: 'End users',
          intent: 'Where do conversions leak, and why?',
          points: [
            'Real browser journeys by synthetic buyers.',
            'Step-by-step funnel, detected friction and drop-off.',
            'Baseline vs candidate comparison with paired deltas.',
          ],
        },
        developers: {
          name: 'Developers',
          intent: 'How long until a newcomer gets a first success?',
          points: [
            'Starts from a clean checkout and follows the README to the letter.',
            'Installs and runs until the first working result (only with --execute, for repositories you trust).',
            'Measures time to first success and notes what breaks.',
          ],
        },
        commercial: {
          name: 'Commercial readiness',
          intent: 'Is the commercial story backed by evidence?',
          points: [
            'Problem, differentiation and business-model fit: open source, open core, SaaS, subscription, services or API.',
            'Distribution potential and strategic relevance, with the evidence behind each signal.',
          ],
          note: 'Investor lens inside: signals for due diligence, never a prediction of investment decisions.',
        },
        security: {
          name: 'Red team',
          intent: 'Where would someone with bad intentions get in?',
          points: [
            'Secrets, dependencies, CI script injection and install scripts.',
            'Website surface with Argus, privacy and cookies.',
            'AI-agent attack surface: prompt injection in skills, AGENTS.md and docs, hidden Unicode, MCP tool poisoning and over-broad agent permissions.',
          ],
        },
        segments: {
          name: 'Segments',
          intent: 'Does it work for people who are not like your team?',
          points: [
            'Target audiences, not stereotypes.',
            'Accessibility, slow connections, 200% zoom and mobile.',
            'People who do not want an account, and other languages.',
          ],
        },
      },
    },
    caps: {
      title: 'What is in this release',
      lead: 'Brief and accurate. Experimental items are marked.',
      experimental: 'EXPERIMENTAL',
      items: [
        ['Evidence Protocol v1', 'Portable JSONL evidence that any tool can write and read.'],
        [
          'Integration SDK',
          'A small contract for adding tools as adapters; <code>integrations list</code> shows what is available.',
        ],
        [
          'agent-eval',
          'Evaluates what an AI coding agent produced — build, tests, deleted or skipped tests, secrets, gates — and never trusts the agent’s own claims.',
        ],
        ['Model router', 'Explicit pinning and cost-aware routing: quality, balanced, economy or offline.'],
        ['Token economy report', 'Tokens and cost per run, and cost per finding.'],
        [
          'Exact response cache',
          'An identical request is answered from a local cache instead of the provider.',
        ],
        ['GitHub PR workflow', 'A reusable workflow that posts one compact comment with the delta.'],
        ['Calibration states', 'UNCALIBRATED · PARTIALLY CALIBRATED · CALIBRATED, with error metrics.'],
        [
          'Static repository audit',
          'Audit a public repository by URL without running it: STATIC AUDIT · NO CODE EXECUTED.',
        ],
        ['Model ensemble', 'Several model routes on the same buyer to surface disagreement.', 1],
      ],
    },
    integ: {
      title: 'Works with the tools you already use',
      lead: 'Text only, no logos. Each entry states how far the integration goes.',
      disclaimer: 'Listed for interoperability; no partnership or endorsement is implied.',
      groups: {
        models: 'Models / gateways',
        browser: 'Browser',
        evals: 'AI evals',
        security: 'Red team / security',
        obs: 'Observability',
      },
      notes: {
        sidecar: 'reference sidecar',
        importOnly: 'import-only by default',
        genai: 'GenAI conventions',
        viaOtel: 'via OpenTelemetry',
      },
      legendTitle: 'What each status means',
      legend: {
        built: 'Ships with Buyer Arena and is covered by tests.',
        supported: 'Works through a maintained bridge; you install the tool separately.',
        adapter: 'A contract or reference adapter exists; you run the tool.',
        experimental: 'Works in limited cases and may change.',
        planned: 'On the roadmap; not available yet.',
      },
    },
    offline: {
      title: 'Offline first, by design',
      lead: 'Nothing leaves your machine unless you pick a cloud model. And when something does, the run writes it down.',
      points: [
        'No paid API required',
        'Deterministic mode',
        'LM Studio / Ollama',
        'All evidence stored locally',
        'No telemetry by default',
        'No source upload required',
        'Cloud is optional',
      ],
      machine: 'YOUR MACHINE',
      machineItems: ['repository', 'browser', 'local models', 'artifacts & evidence'],
      lan: 'private network (LAN, Docker)',
      cloud: 'OPTIONAL CLOUD',
      cloudItem: 'only the model provider you select',
      cloudAny: 'any host, within the safety rules',
      blocked: 'blocked',
      allowed: 'allowed',
      modesTitle: 'Network policy',
      modes: {
        offline: 'Loopback only. Local models, localhost targets and local repositories work; nothing else.',
        local:
          'Loopback plus your private network (LAN, Docker). The starting point when you choose nothing.',
        hybrid: 'Local plus the model providers you selected. Nothing else leaves the machine.',
        online: 'Any host, still within the safety rules such as same-origin browsing.',
      },
      ledger:
        'Every run records what left the machine: hosts contacted, providers that received data, and anything refused. With no explicit choice it starts at LOCAL and only widens for a target you name on the command line — and says so.',
    },
    mix: {
      title: 'Choose the mix',
      lead: 'You decide how much attention each panel gets. Before a launch, more end users; before opening the source, more red team.',
      exampleLabel: 'Example: before a launch',
      depthTitle: 'Depth',
      depth: {
        quick: ['Quick', 'Fewer participants and shorter journeys. For a check before every deploy.'],
        standard: ['Standard', 'The default. Enough to decide whether to launch.'],
        deep: ['Deep', 'More journeys and more steps per journey. For before a major launch.'],
      },
      cta: 'Open the run builder',
    },
    quick: {
      title: 'Run locally',
      lead: 'You need Node.js 22.12 or later. The demo downloads Chromium for Playwright once.',
      soonTitle: 'Available at public launch',
      soonText:
        'The source is not public yet. These are the commands you will run once it opens; there is nothing to install today.',
      steps: {
        clone: 'Clone the repository',
        cd: 'Go into the folder',
        install: 'Install the dependencies',
        demo: 'Run the demo and open the report it produces',
        studio: 'Open the visual control room locally',
        launch: 'Audit your own product: change the URL and the text that signals success',
        agentEval: 'Evaluate what an AI agent produced in this repository',
      },
      copy: 'Copy',
      copied: 'Copied',
      ciTitle: 'In CI and from your phone',
      ciText:
        'The “Launch check” workflow runs on GitHub Actions and can be started from the GitHub app. A reusable PR workflow posts one compact comment with the delta.',
      ciLink: 'Open the “Launch check” workflow',
      agentsTitle: 'From AI agents',
      agentsText: 'An MCP server so an agent can start audits and read the results.',
      agentsNote:
        'Listens on localhost only by default. Exposing it to the network is an explicit choice you make.',
    },
    safety: {
      title: 'Safety and privacy',
      lead: 'A tool that tests websites should not become a risk itself.',
      items: [
        ['Runs locally', 'On your machine or your own CI runner. There is no service in between.'],
        ['Only the origin you name', 'It visits only the domain you give it.'],
        ['Blocks third parties', 'Requests to other domains are blocked during journeys.'],
        ['Never real payment data', 'It never enters a card or real payment details.'],
        ['Tests cost nothing', 'The test suite makes zero calls to paid APIs.'],
        ['One file', 'The report is a single HTML file that works offline.'],
      ],
    },
    pricing: {
      title: 'Pricing and licences',
      lead: 'The core is complete and free. Paid plans will charge for what we operate — hosted runs, retention, collaboration, compliance and people’s time — never for what you run yourself.',
      previewTitle: 'Prices set — nothing is on sale yet',
      previewText:
        'There is no company, no payment provider and no hosted service yet. These prices are a published plan, exclude VAT and may change before anything is sold.',
      forever: 'forever',
      perMonth: '/ month',
      from: 'from',
      licenceLabel: 'Licence',
      status: { launch: 'AT PUBLIC LAUNCH', planned: 'PLANNED' },
      licences: {
        apache: 'Apache-2.0 + trademark policy',
        cloud: 'Cloud terms + data processing agreement',
        commercial: 'Commercial licence for add-ons + MSA',
      },
      runs: '{runs} journey runs / month included',
      over: 'then {price} per 100 runs',
      plans: {
        community: {
          name: 'Community',
          who: 'Everyone',
          points: [
            'All five panels, Studio, MCP, agent-eval and every integration',
            'Local or bring-your-own models; unlimited runs on your machine or CI',
            'Community support on GitHub',
          ],
        },
        starter: {
          name: 'Cloud Starter',
          who: 'Solo builders and small teams',
          points: ['Hosted browsers, 3 projects, 30-day retention', 'Shareable reports, unlimited users'],
        },
        team: {
          name: 'Cloud Team',
          who: 'Product and engineering teams',
          points: [
            'PR gate for private repositories, agent benchmark history',
            'Calibration workspace, 1-year retention, email support',
          ],
        },
        enterprise: {
          name: 'Enterprise',
          who: 'Regulated and larger organisations',
          points: [
            'SSO/SAML, SCIM, audit logs, EU data residency',
            'Self-hosted or VPC control plane, SLA, annual contract',
          ],
        },
      },
      unit: 'A journey run is one synthetic buyer attempting one journey on one version. A 20-buyer before/after comparison uses 40. Model tokens are never hidden in the price.',
      servicesTitle: 'Services, fixed fee',
      servicesLead:
        'Done with the open-source tool, so you can reproduce every finding afterwards. Available once the company exists.',
      services: {
        audit: [
          'Launch Audit',
          'One product, before vs after, all five panels, written report and a review call.',
        ],
        agents: ['Agent Benchmark', 'Two to four AI coding agents on your repository, with raw evidence.'],
        calibration: [
          'Calibration Setup',
          'Connect your aggregate analytics and get your first calibration report.',
        ],
        support: [
          'Self-hosted support',
          'A support contract for teams running the open-source core in production.',
        ],
      },
      discounts:
        'Discounts: free Cloud Team for open-source projects and non-profits, free Starter for education, 50% off the first year for early-stage startups.',
      source: 'Full details, formulas and market anchors: docs/PRICING.md in the repository.',
    },
    roi: {
      title: 'Work out your return',
      lead: 'Five ways Buyer Arena can pay for itself. The calculator uses the formula from our pricing document; change the numbers to yours.',
      paths: [
        ['Research spend avoided', 'Usability rounds you no longer need to run for every release.'],
        [
          'Conversion recovered',
          'Friction found before launch — counted at the lower bound, times a confidence factor.',
        ],
        ['Engineering time saved', 'Regression hunting and manual QA you did not have to do.'],
        [
          'Model spend avoided',
          'Exact cache, routing and local models; every run reports its token economy.',
        ],
        ['Better agent choice', 'Pick the AI coding agent whose changes actually pass your gates.'],
      ],
      calcTitle: 'ROI calculator — illustrative',
      fields: {
        rounds: 'Usability rounds avoided per year',
        roundCost: 'All-in cost per round (€)',
        visitors: 'Visitors per month',
        uplift: 'Real conversion uplift (percentage points)',
        value: 'Value per conversion (€)',
        confidence: 'Confidence factor (0–1)',
        hours: 'Engineering hours saved per year',
        rate: 'Loaded cost per hour (€)',
        plan: 'Buyer Arena cost per month (€)',
      },
      out: {
        a: 'Research spend avoided',
        b: 'Conversion recovered',
        c: 'Engineering time saved',
        cost: 'Buyer Arena cost',
        net: 'Net per year',
        ratio: 'Return on cost',
      },
      perYear: 'per year',
      note: 'Illustrative, not a customer result. Buyer Arena measures a conversion proxy, not revenue; while a run is UNCALIBRATED keep the confidence factor at 0.5 or lower. Model spend and agent choice are left out of the calculator.',
    },
    selfAudit: {
      label: 'SELF-AUDIT — NOT EXTERNAL VALIDATION',
      title: 'Buyer Arena on itself',
      text: 'We run launch-check on Buyer Arena’s own repository. The 2026-09-25 run scored 84/100 (its web panels measure the fictional demo store, which has planted defects, not Buyer Arena). The tool graded itself, so this is not independent evidence and not the proof we rely on — the real report above is.',
      link: 'Open the self-audit report',
    },
    footer: {
      tagline: 'The evidence-first evaluation layer for software built by humans and AI agents.',
      license: 'Apache-2.0 licence',
      privacy: 'Privacy: no cookies, no trackers',
      report: 'Real demo report',
      selfAudit: 'Self-audit (not external validation)',
      langs: 'Languages',
    },
    run: {
      eyebrow: 'run builder · everything happens in your browser',
      title: 'Build a run',
      lead: 'Adjust the mix and copy the command. Nothing leaves this page.',
      mixTitle: 'Attention per panel',
      mixHelp: 'Relative weights. They are normalised to 100%.',
      size: 'Size (participants)',
      depth: 'Depth',
      depthOpts: { quick: 'Quick', standard: 'Standard', deep: 'Deep' },
      repo: 'Repository path',
      url: 'Your website URL',
      execute: 'Run install/build (executes repository code)',
      executeHelp: 'Only for repositories you trust: the developers panel will run their scripts.',
      resultTitle: 'Result',
      panel: 'Panel',
      share: 'Share',
      participants: 'Participants',
      total: 'Total',
      estimate: 'Approximate time',
      estimateNote: 'A rough laptop estimate; it depends on your website and your machine.',
      minutes: 'min',
      command: 'Command',
      copy: 'Copy',
      copied: 'Copied',
      ghTitle: 'Run on GitHub',
      ghLead: 'Open the workflow, press “Run workflow” and paste these values:',
      ghLink: 'Open “Launch check” on GitHub',
      reset: 'Reset',
      minNote: 'At least 2 per panel and 5 for end users.',
      skipped: 'skipped',
      zeroError: 'Give at least one panel some attention.',
      under1: 'under 1 min',
      depthNote: 'Depth multiplies participants: quick ×0.5, deep ×2.',
      soonNote: 'Commands for when the source opens: available at public launch.',
    },
    notFound: {
      title: 'This page does not exist',
      text: 'The link may be mistyped, or the page may have moved.',
      home: 'Back to home',
    },
  },

  nl: {
    lang: 'nl',
    locale: 'nl-NL',
    label: 'Nederlands',
    meta: {
      index: {
        title: 'Buyer Arena — evaluatie op basis van bewijs voor software van mensen en AI-agents',
        desc: 'Meet wat er gebeurt voordat gebruikers de problemen vinden: echte browsertrajecten, synthetische kopers, security- en eval-tools. Offline eerst, modelonafhankelijk.',
      },
      run: {
        title: 'Run-configurator · Buyer Arena',
        desc: 'Kies hoeveel aandacht elk panel krijgt, de omvang en de diepgang, en kopieer het exacte Buyer Arena-commando voor je repository en website.',
      },
      notFound: {
        title: 'Pagina niet gevonden · Buyer Arena',
        desc: 'Dit adres bestaat niet op de website van Buyer Arena.',
      },
    },
    nav: {
      skip: 'Naar de inhoud',
      home: 'Home',
      how: 'Hoe het werkt',
      report: 'Echt rapport',
      integrations: 'Integraties',
      offline: 'Offline eerst',
      limits: 'Beperkingen',
      pricing: 'Prijzen',
      quickstart: 'Lokaal draaien',
      run: 'Configurator',
      theme: 'Wisselen tussen licht en donker thema',
      langLabel: 'Taal',
      sections: 'Onderdelen',
    },
    state: {
      prelaunch: 'Privé release candidate — de broncode gaat open na een onafhankelijke audit',
      public: 'Open source · Apache-2.0',
      soon: 'beschikbaar bij de publieke lancering',
    },
    hero: {
      title: 'De evaluatielaag <em>op basis van bewijs</em> voor software gebouwd door mensen en AI-agents.',
      sub: 'Meet wat er echt gebeurt — echte browsertrajecten, synthetische kopers, security- en eval-tools — voordat je gebruikers de problemen vinden. Offline eerst, onafhankelijk van model en aanbieder.',
      priceHint: 'Gratis kern · €0 · cloudplannen gepland vanaf €29/maand — nog niet te koop',
      cta1: 'Lokaal draaien',
      cta2: 'Bekijk een echt rapport',
      source: 'Broncode op GitHub',
      sourceSoon: 'Broncode · bij de lancering',
      caption: 'Illustratieve animatie — demodata',
      pause: 'Animatie pauzeren',
      play: 'Animatie afspelen',
      replay: 'Animatie opnieuw afspelen',
      sceneLabel:
        'Illustratieve animatie met demodata. Twintig synthetische kopers gaan door de trechter van een product. In de basisversie halen 8 van de 20 het doel (40%); een aantal haakt af bij een aanmeldstap die om een telefoonnummer vraagt, en bij elke fout wordt bewijs vastgelegd. De verbeterde kandidaat haalt 15 van de 20 (75%): +35 procentpunt. Daarna voeden vijf modelroutes — Claude, GPT, Gemini, een lokaal model en een deterministische heuristiek — Buyer Arena, dat onenigheid, bewijs en betrouwbaarheid rapporteert.',
      scene: {
        baseline: 'BASIS',
        candidate: 'KANDIDAAT',
        stages: ['prijzen', 'aanmelden', 'afrekenen', 'doel'],
        friction: 'telefoon verplicht',
        chips: ['form_error · stap 3', 'screenshot · p-009', 'bezwaar · telefoon'],
        routes: ['Claude', 'GPT', 'Gemini', 'lokaal model', 'heuristiek'],
        outputs: ['onenigheid', 'bewijs', 'betrouwbaarheid'],
        legend: ['doel', 'afgehaakt', 'frictie'],
      },
    },
    how: {
      title: 'Van wijziging naar oordeel, in zeven stappen',
      lead: 'Buyer Arena staat tussen wie de wijziging maakte — een mens of een AI-agent — en de beslissing om te releasen.',
      steps: [
        [
          'Een AI-agent of een mens bouwt software',
          'Een pull request, een branch of een uitgerolde preview. Voor Buyer Arena maakt het niet uit wie hem schreef.',
        ],
        [
          'Buyer Arena evalueert de wijziging',
          'Op je eigen machine, in CI of vanuit een agent via MCP. Elke run legt zijn netwerkbeleid vast.',
        ],
        [
          'Browseragents en synthetische kopers gebruiken het product',
          'Echte Playwright-trajecten met screenshots en events. Elke koper is een persona met seed, doel, budget en beperkt geduld.',
        ],
        [
          'Security- en eval-tools leveren bewijs',
          'Promptfoo, garak, Gitleaks, Trivy en andere sluiten aan als adapter. Hun resultaten zijn bewijs, geen oordeel.',
        ],
        [
          'Buyer Arena normaliseert het bewijs',
          'Alles wordt Evidence Protocol v1: draagbare JSONL-records met een bron, een locatie en een betrouwbaarheid.',
        ],
        [
          'Basis en kandidaat worden vergeleken',
          'Dezelfde persona’s op beide versies, gepaarde verschillen met intervallen, opgeloste en nieuwe frictie.',
        ],
        [
          'Echte geaggregeerde data kalibreert toekomstige simulaties',
          'Als je echte geaggregeerde uitkomsten aanlevert, meet de kalibratie de fout en markeert elke run als UNCALIBRATED, PARTIALLY CALIBRATED of CALIBRATED.',
        ],
      ],
      tags: ['', '', 'Playwright', '', 'Evidence Protocol v1', 'Δ +35 pp', ''],
    },
    report: {
      title: 'Een echt rapport, geen mock-up',
      lead: 'Twintig deterministische synthetische kopers liepen echte browsertrajecten door twee versies van de meegeleverde demowinkel “Tallybird”. Dit is het onbewerkte HTML-rapport van die run.',
      note: 'Het demoproduct is fictief; de trajecten zijn echt, de kopers synthetisch.',
      facts: {
        baseline: 'doel gehaald, basis',
        candidate: 'doel gehaald, kandidaat',
        delta: 'verschil · 95%-interval',
        journeys: 'browsertrajecten',
        shots: 'screenshots',
        cost: 'modelkosten · 0 tokens · netwerk LOCAL',
      },
      points: [
        'Elke bevinding verwijst naar een event in het traject, een screenshot, een URL of <b>bestand:regel</b>.',
        'Exporteert naar CSV, PNG, JPG, Markdown, JSON en PDF; rapporten in het Spaans, Engels en Nederlands.',
        'Deterministische kopers: zelfde seed, zelfde resultaat. Geen model en geen API-sleutel nodig.',
      ],
      cta: 'Open het echte rapport',
      meta: 'Eén HTML-bestand · werkt offline',
    },
    limits: {
      title: 'Beperkingen — lees deze eerst',
      lead: 'Wat Buyer Arena vandaag meet, en wat niet.',
      items: [
        [
          'Een conversie-indicator, geen omzet',
          'Synthetische kopers meten of een traject zijn doel haalt. Dat is een benadering van conversie, geen voorspelling van verkoop of omzet.',
        ],
        [
          'Standaard niet gekalibreerd',
          'Tot je echte geaggregeerde data aanlevert, is elke run UNCALIBRATED: lees verschillen als richting, niet als belofte.',
        ],
        [
          'Nog geen live LLM-run geverifieerd',
          'Kopers en routes met een model zijn gebouwd en getest met gescripte modellen; een echte run tegen een betaalde aanbieder is voor deze release nog niet geverifieerd.',
        ],
        [
          'Gehoste uitvoering van repositories komt later',
          'Een repository auditen via een URL is alleen statisch: bestanden worden als data gelezen. Label: STATIC AUDIT · NO CODE EXECUTED.',
        ],
        [
          'Experimentele onderdelen zijn gemarkeerd',
          'Alles met het label EXPERIMENTAL kan vóór 1.0 veranderen of verdwijnen.',
        ],
      ],
    },
    panels: {
      title: 'Vijf panels, vijf invalshoeken',
      lead: 'Een lancering mislukt om verschillende redenen, afhankelijk van wie er kijkt. Elk panel zoekt zijn eigen problemen en onderbouwt de score met bewijs.',
      items: {
        users: {
          name: 'Eindgebruikers',
          intent: 'Waar lekken conversies weg, en waarom?',
          points: [
            'Echte browsertrajecten door synthetische kopers.',
            'Trechter per stap, gevonden frictie en afhakers.',
            'Vergelijking van basis en kandidaat met gepaarde verschillen.',
          ],
        },
        developers: {
          name: 'Ontwikkelaars',
          intent: 'Hoe lang duurt het voordat een nieuwkomer een eerste succes heeft?',
          points: [
            'Begint met een schone checkout en volgt de README letterlijk.',
            'Installeert en draait tot het eerste werkende resultaat (alleen met --execute, voor repositories die je vertrouwt).',
            'Meet de tijd tot het eerste succes en noteert wat er misgaat.',
          ],
        },
        commercial: {
          name: 'Commerciële gereedheid',
          intent: 'Wordt het commerciële verhaal door bewijs gedragen?',
          points: [
            'Probleem, onderscheidend vermogen en passend verdienmodel: open source, open core, SaaS, abonnement, diensten of API.',
            'Distributiepotentieel en strategische relevantie, met het bewijs achter elk signaal.',
          ],
          note: 'Met investeerdersblik: signalen voor due diligence, nooit een voorspelling van investeringsbeslissingen.',
        },
        security: {
          name: 'Red team',
          intent: 'Waar zou iemand met kwade bedoelingen binnenkomen?',
          points: [
            'Secrets, dependencies, injectie in CI-scripts en installatiescripts.',
            'Aanvalsoppervlak van de website met Argus, privacy en cookies.',
            'Aanvalsoppervlak voor AI-agents: promptinjectie in skills, AGENTS.md en documentatie, verborgen Unicode, vergiftigde MCP-tools en te ruime agentrechten.',
          ],
        },
        segments: {
          name: 'Segmenten',
          intent: 'Werkt het voor mensen die niet op je team lijken?',
          points: [
            'Doelgroepen, geen stereotypen.',
            'Toegankelijkheid, trage verbindingen, 200% zoom en mobiel.',
            'Mensen die geen account willen, en andere talen.',
          ],
        },
      },
    },
    caps: {
      title: 'Wat er in deze release zit',
      lead: 'Kort en precies. Experimentele onderdelen zijn gemarkeerd.',
      experimental: 'EXPERIMENTAL',
      items: [
        ['Evidence Protocol v1', 'Draagbaar bewijs in JSONL dat elke tool kan schrijven en lezen.'],
        [
          'Integratie-SDK',
          'Een klein contract om tools als adapter toe te voegen; <code>integrations list</code> toont wat beschikbaar is.',
        ],
        [
          'agent-eval',
          'Beoordeelt wat een AI-codeeragent opleverde — build, tests, verwijderde of overgeslagen tests, secrets, gates — en vertrouwt nooit op wat de agent zelf beweert.',
        ],
        ['Modelrouter', 'Expliciet vastpinnen en routeren op kosten: quality, balanced, economy of offline.'],
        ['Tokeneconomie-rapport', 'Tokens en kosten per run, en kosten per bevinding.'],
        [
          'Exacte response-cache',
          'Een identiek verzoek wordt uit een lokale cache beantwoord in plaats van door de aanbieder.',
        ],
        [
          'GitHub-PR-workflow',
          'Een herbruikbare workflow die één compacte reactie met het verschil plaatst.',
        ],
        ['Kalibratiestatussen', 'UNCALIBRATED · PARTIALLY CALIBRATED · CALIBRATED, met foutmaten.'],
        [
          'Statische repository-audit',
          'Audit een publieke repository via een URL zonder hem uit te voeren: STATIC AUDIT · NO CODE EXECUTED.',
        ],
        ['Modelensemble', 'Meerdere modelroutes op dezelfde koper om onenigheid zichtbaar te maken.', 1],
      ],
    },
    integ: {
      title: 'Werkt met de tools die je al gebruikt',
      lead: 'Alleen tekst, geen logo’s. Bij elke vermelding staat hoe ver de integratie gaat.',
      disclaimer: 'Vermeld voor interoperabiliteit; er is geen samenwerking of aanbeveling mee bedoeld.',
      groups: {
        models: 'Modellen / gateways',
        browser: 'Browser',
        evals: 'AI-evals',
        security: 'Red team / security',
        obs: 'Observability',
      },
      notes: {
        sidecar: 'referentie-sidecar',
        importOnly: 'standaard alleen import',
        genai: 'GenAI-conventies',
        viaOtel: 'via OpenTelemetry',
      },
      legendTitle: 'Wat elke status betekent',
      legend: {
        built: 'Zit in Buyer Arena en is gedekt door tests.',
        supported: 'Werkt via een onderhouden koppeling; de tool installeer je zelf.',
        adapter: 'Er is een contract of referentie-adapter; de tool draai je zelf.',
        experimental: 'Werkt in beperkte gevallen en kan veranderen.',
        planned: 'Op de roadmap; nog niet beschikbaar.',
      },
    },
    offline: {
      title: 'Offline eerst, zo ontworpen',
      lead: 'Er verlaat niets je machine, tenzij je een cloudmodel kiest. En gebeurt dat wel, dan legt de run het vast.',
      points: [
        'Geen betaalde API nodig',
        'Deterministische modus',
        'LM Studio / Ollama',
        'Al het bewijs lokaal opgeslagen',
        'Standaard geen telemetrie',
        'Broncode uploaden is niet nodig',
        'De cloud is optioneel',
      ],
      machine: 'JOUW MACHINE',
      machineItems: ['repository', 'browser', 'lokale modellen', 'artefacten en bewijs'],
      lan: 'privénetwerk (LAN, Docker)',
      cloud: 'OPTIONELE CLOUD',
      cloudItem: 'alleen de modelaanbieder die jij kiest',
      cloudAny: 'elke host, binnen de veiligheidsregels',
      blocked: 'geblokkeerd',
      allowed: 'toegestaan',
      modesTitle: 'Netwerkbeleid',
      modes: {
        offline:
          'Alleen loopback. Lokale modellen, doelen op localhost en lokale repositories werken; verder niets.',
        local: 'Loopback plus je privénetwerk (LAN, Docker). Het vertrekpunt als je niets kiest.',
        hybrid: 'Lokaal plus de modelaanbieders die je koos. Verder verlaat niets de machine.',
        online: 'Elke host, nog steeds binnen de veiligheidsregels, zoals browsen binnen dezelfde origin.',
      },
      ledger:
        'Elke run legt vast wat de machine verliet: gecontacteerde hosts, aanbieders die data ontvingen en wat er geweigerd is. Zonder expliciete keuze begint hij bij LOCAL en verruimt hij alleen voor een doel dat je in het commando noemt — en meldt dat.',
    },
    mix: {
      title: 'Kies de mix',
      lead: 'Jij bepaalt hoeveel aandacht elk panel krijgt. Voor een lancering meer eindgebruikers; voordat je de broncode openzet, meer red team.',
      exampleLabel: 'Voorbeeld: voor een lancering',
      depthTitle: 'Diepgang',
      depth: {
        quick: ['Snel', 'Minder deelnemers en kortere trajecten. Voor een check voor elke deploy.'],
        standard: ['Standaard', 'De standaardkeuze. Genoeg om te beslissen of je lanceert.'],
        deep: ['Diep', 'Meer trajecten en meer stappen per traject. Voor een grote lancering.'],
      },
      cta: 'Open de configurator',
    },
    quick: {
      title: 'Lokaal draaien',
      lead: 'Je hebt Node.js 22.12 of nieuwer nodig. De demo downloadt eenmalig Chromium voor Playwright.',
      soonTitle: 'Beschikbaar bij de publieke lancering',
      soonText:
        'De broncode is nog niet openbaar. Dit zijn de commando’s die je gebruikt zodra hij opengaat; vandaag valt er niets te installeren.',
      steps: {
        clone: 'Kloon de repository',
        cd: 'Ga naar de map',
        install: 'Installeer de dependencies',
        demo: 'Draai de demo en open het rapport dat hij maakt',
        studio: 'Open de visuele controlekamer lokaal',
        launch: 'Audit je eigen product: pas de URL en de succestekst aan',
        agentEval: 'Beoordeel wat een AI-agent in deze repository heeft opgeleverd',
      },
      copy: 'Kopiëren',
      copied: 'Gekopieerd',
      ciTitle: 'In CI en vanaf je telefoon',
      ciText:
        'De workflow “Launch check” draait op GitHub Actions en start je vanuit de GitHub-app. Een herbruikbare PR-workflow plaatst één compacte reactie met het verschil.',
      ciLink: 'Open de workflow “Launch check”',
      agentsTitle: 'Vanuit AI-agents',
      agentsText: 'Een MCP-server, zodat een agent audits kan starten en de resultaten kan lezen.',
      agentsNote:
        'Luistert standaard alleen op localhost. Openstellen voor het netwerk is een bewuste keuze van jou.',
    },
    safety: {
      title: 'Veiligheid en privacy',
      lead: 'Een tool die websites test, mag zelf geen risico worden.',
      items: [
        ['Draait lokaal', 'Op je eigen machine of je eigen CI-runner. Er zit geen dienst tussen.'],
        ['Alleen de origin die je opgeeft', 'Bezoekt uitsluitend het domein dat je meegeeft.'],
        ['Blokkeert derden', 'Verzoeken naar andere domeinen worden tijdens trajecten geblokkeerd.'],
        ['Nooit echte betaalgegevens', 'Vult nooit een kaart of echte betaalgegevens in.'],
        ['Tests kosten niets', 'De testsuite doet nul aanroepen naar betaalde API’s.'],
        ['Eén bestand', 'Het rapport is één HTML-bestand dat offline werkt.'],
      ],
    },
    pricing: {
      title: 'Prijzen en licenties',
      lead: 'De kern is compleet en gratis. Betaalde plannen rekenen voor wat wij draaien — gehoste runs, bewaartermijn, samenwerking, compliance en tijd van mensen — nooit voor wat je zelf draait.',
      previewTitle: 'Prijzen vastgesteld — nog niets te koop',
      previewText:
        'Er is nog geen bedrijf, geen betaalprovider en geen gehoste dienst. Deze prijzen zijn een gepubliceerd plan, exclusief btw, en kunnen veranderen voordat er iets verkocht wordt.',
      forever: 'voor altijd',
      perMonth: '/ maand',
      from: 'vanaf',
      licenceLabel: 'Licentie',
      status: { launch: 'BIJ DE PUBLIEKE LANCERING', planned: 'GEPLAND' },
      licences: {
        apache: 'Apache-2.0 + merkbeleid',
        cloud: 'Cloudvoorwaarden + verwerkersovereenkomst',
        commercial: 'Commerciële licentie voor add-ons + MSA',
      },
      runs: '{runs} journey-runs / maand inbegrepen',
      over: 'daarna {price} per 100 runs',
      plans: {
        community: {
          name: 'Community',
          who: 'Voor iedereen',
          points: [
            'Alle vijf panels, Studio, MCP, agent-eval en elke integratie',
            'Lokale modellen of je eigen sleutel; onbeperkt runs op je machine of CI',
            'Communitysupport op GitHub',
          ],
        },
        starter: {
          name: 'Cloud Starter',
          who: 'Solo-bouwers en kleine teams',
          points: [
            'Gehoste browsers, 3 projecten, 30 dagen bewaren',
            'Deelbare rapporten, onbeperkt gebruikers',
          ],
        },
        team: {
          name: 'Cloud Team',
          who: 'Product- en engineeringteams',
          points: [
            'PR-gate voor privérepositories, geschiedenis van agentbenchmarks',
            'Kalibratiewerkruimte, 1 jaar bewaren, e-mailsupport',
          ],
        },
        enterprise: {
          name: 'Enterprise',
          who: 'Grotere en gereguleerde organisaties',
          points: [
            'SSO/SAML, SCIM, auditlogs, dataopslag in de EU',
            'Zelf gehost of VPC-controlelaag, SLA, jaarcontract',
          ],
        },
      },
      unit: 'Een journey-run is één synthetische koper die één journey probeert op één versie. Een voor/na-vergelijking met 20 kopers gebruikt er 40. Modeltokens zitten nooit verborgen in de prijs.',
      servicesTitle: 'Diensten tegen vaste prijs',
      servicesLead:
        'Uitgevoerd met de opensourcetool, zodat je elke bevinding achteraf kunt reproduceren. Beschikbaar zodra het bedrijf bestaat.',
      services: {
        audit: [
          'Lanceringsaudit',
          'Eén product, voor en na, alle vijf panels, schriftelijk rapport en een reviewgesprek.',
        ],
        agents: ['Agentbenchmark', 'Twee tot vier AI-codeeragents op je repository, met het ruwe bewijs.'],
        calibration: [
          'Kalibratie-inrichting',
          'Koppel je geaggregeerde analytics en krijg je eerste kalibratierapport.',
        ],
        support: [
          'Support voor zelf hosten',
          'Een supportcontract voor teams die de open kern in productie draaien.',
        ],
      },
      discounts:
        'Kortingen: Cloud Team gratis voor opensourceprojecten en non-profits, Starter gratis voor onderwijs en 50% korting in het eerste jaar voor startups in een vroege fase.',
      source: 'Details, formules en marktankers: docs/PRICING.md in de repository.',
    },
    roi: {
      title: 'Bereken je rendement',
      lead: 'Vijf manieren waarop Buyer Arena zichzelf kan terugverdienen. De calculator gebruikt de formule uit ons prijsdocument; vul je eigen cijfers in.',
      paths: [
        ['Onderzoeksbudget bespaard', 'Usabilityrondes die je niet meer voor elke release hoeft te doen.'],
        [
          'Conversie teruggewonnen',
          'Frictie die vóór de lancering gevonden is, geteld op de ondergrens en maal een betrouwbaarheidsfactor.',
        ],
        ['Engineeringtijd bespaard', 'Regressies zoeken en handmatige QA die je niet hoefde te doen.'],
        [
          'Modelkosten vermeden',
          'Exacte cache, routering en lokale modellen; elke run rapporteert zijn tokeneconomie.',
        ],
        ['Betere agentkeuze', 'Kies de AI-codeeragent waarvan de wijzigingen echt door je gates komen.'],
      ],
      calcTitle: 'ROI-calculator — illustratief',
      fields: {
        rounds: 'Vermeden usabilityrondes per jaar',
        roundCost: 'Totale kosten per ronde (€)',
        visitors: 'Bezoekers per maand',
        uplift: 'Echte conversiestijging (procentpunten)',
        value: 'Waarde per conversie (€)',
        confidence: 'Betrouwbaarheidsfactor (0–1)',
        hours: 'Bespaarde engineeringuren per jaar',
        rate: 'Kosten per uur (€)',
        plan: 'Kosten Buyer Arena per maand (€)',
      },
      out: {
        a: 'Onderzoeksbudget bespaard',
        b: 'Conversie teruggewonnen',
        c: 'Engineeringtijd bespaard',
        cost: 'Kosten Buyer Arena',
        net: 'Netto per jaar',
        ratio: 'Rendement op kosten',
      },
      perYear: 'per jaar',
      note: 'Illustratief, geen klantresultaat. Buyer Arena meet een benadering van conversie, geen omzet; zolang een run ONGEKALIBREERD is, houd je de betrouwbaarheidsfactor op 0,5 of lager. Modelkosten en agentkeuze zitten niet in de calculator.',
    },
    selfAudit: {
      label: 'ZELFAUDIT — GEEN EXTERNE VALIDATIE',
      title: 'Buyer Arena op zichzelf',
      text: 'We draaien launch-check op de eigen repository van Buyer Arena. De run van 25-09-2026 scoorde 84/100 (de webpanels meten de fictieve demowinkel met ingebouwde fouten, niet Buyer Arena). De tool beoordeelde zichzelf: dit is geen onafhankelijk bewijs en niet het bewijs waarop we leunen — dat is het echte rapport hierboven.',
      link: 'Open het zelfauditrapport',
    },
    footer: {
      tagline: 'De evaluatielaag op basis van bewijs voor software gebouwd door mensen en AI-agents.',
      license: 'Apache-2.0-licentie',
      privacy: 'Privacy: geen cookies, geen trackers',
      report: 'Echt demorapport',
      selfAudit: 'Zelfaudit (geen externe validatie)',
      langs: 'Talen',
    },
    run: {
      eyebrow: 'configurator · alles gebeurt in je browser',
      title: 'Stel een run samen',
      lead: 'Pas de mix aan en kopieer het commando. Er verlaat niets deze pagina.',
      mixTitle: 'Aandacht per panel',
      mixHelp: 'Relatieve gewichten. Ze worden genormaliseerd naar 100%.',
      size: 'Omvang (deelnemers)',
      depth: 'Diepgang',
      depthOpts: { quick: 'Snel', standard: 'Standaard', deep: 'Diep' },
      repo: 'Pad naar de repository',
      url: 'URL van je website',
      execute: 'Install/build uitvoeren (voert code uit de repository uit)',
      executeHelp: 'Alleen voor repositories die je vertrouwt: het ontwikkelaarspanel draait hun scripts.',
      resultTitle: 'Resultaat',
      panel: 'Panel',
      share: 'Aandeel',
      participants: 'Deelnemers',
      total: 'Totaal',
      estimate: 'Geschatte duur',
      estimateNote: 'Een ruwe schatting op een laptop; hangt af van je website en je machine.',
      minutes: 'min',
      command: 'Commando',
      copy: 'Kopiëren',
      copied: 'Gekopieerd',
      ghTitle: 'Draaien op GitHub',
      ghLead: 'Open de workflow, klik op “Run workflow” en plak deze waarden:',
      ghLink: 'Open “Launch check” op GitHub',
      reset: 'Herstellen',
      minNote: 'Minimaal 2 per panel en 5 voor eindgebruikers.',
      skipped: 'overgeslagen',
      zeroError: 'Geef ten minste één panel wat aandacht.',
      under1: 'minder dan 1 min',
      depthNote: 'Diepgang vermenigvuldigt het aantal deelnemers: snel ×0,5, diep ×2.',
      soonNote: 'Commando’s voor zodra de broncode opengaat: beschikbaar bij de publieke lancering.',
    },
    notFound: {
      title: 'Deze pagina bestaat niet',
      text: 'Misschien is de link verkeerd getypt of is de pagina verplaatst.',
      home: 'Terug naar home',
    },
  },
};
