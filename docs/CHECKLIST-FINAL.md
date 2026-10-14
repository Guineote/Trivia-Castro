# Checklist final — lo que falta para dejar Trivia Castro listo

Para **Jared** (con las partes de Adler marcadas). Es la lista completa de lo que queda, en el orden en que conviene hacerlo. Los detalles de cada paso están en los documentos enlazados; aquí solo está *qué* hacer y *qué revisar*.

**Fecha límite:** la semana del 12 al 16 de octubre (día exacto por confirmar: **confirmarlo hoy**, porque decide cuánto margen hay para el plan B).

## Dónde estamos

| | Estado |
|---|---|
| Frontend (`web/`) | Terminado: 15 pantallas, sonido, CRT, revancha. 55 pruebas |
| API (`api/`) | Terminada: 17 de 18 endpoints, 31 pruebas |
| Integración real | Probada: API real + Website con `VITE_USE_MOCK=false`, también sobre **MySQL 8.4** (migración, seed, concurrencia, revancha, reinicio de la API) |
| Ensayo de producción local (sin Docker) | Hecho el 14 oct: el build limpio de `main`, el bundle sin mock, la API sirviendo el Website, recarga en cualquier ruta |
| **Falta** | Azure (VM + Docker + HTTPS), probar con dispositivos reales, plan B, el manual de la API, cerrar decisiones abiertas y ensayar la demo |

Lo único que **nadie ha probado todavía** es el contenedor de Docker en sí (Jared dice que lo probó en su máquina; no se ha repetido después de los últimos cambios), varios dispositivos en la red y Azure.

## Resumen en una línea por fase

1. **Antes de tocar Azure (15 min):** `git pull` y confirmar que todo pasa.
2. **Azure (1–2 h):** crear la VM, levantar con Docker y comprobar la URL.
3. **Verificar desde fuera (1 h):** bots, dos navegadores, celulares con datos móviles.
4. **Plan B (30 min):** ensayar el túnel antes de necesitarlo.
5. **Papeles (en paralelo):** manual de la API, decisiones al contrato, documentos al día.
6. **Ensayo de la demo y día de la entrega.**

---

## Fase 0 — Antes de empezar (en tu máquina)

- [ ] `git checkout main && git pull`. Debe estar el último merge (PR #12 o posterior).
- [ ] API: `cd api` y `.venv\Scripts\python -m pytest -q` → **31 pruebas** en verde.
- [ ] Web: `cd web`, `npm install`, `npm test` (55 pruebas), `npm run lint`, `npm run build` sin errores.
- [ ] **Cuidado con `web/.env.local`:** si dice `VITE_USE_MOCK=true`, un `npm run build` incluye el simulador y la gente jugaría contra datos falsos. Debe decir `false` (o no existir). Revísalo antes de **cualquier** build local. En Docker no pasa, porque ese archivo queda excluido.
- [ ] Confirma la **fecha límite** con el equipo y anótala arriba.

## Fase 1 — Azure (sigue [`despliegue-azure.md`](despliegue-azure.md))

La guía ya está escrita; esta lista añade lo que conviene vigilar.

**1.1 Crear la VM**
- [ ] Portal → Máquinas virtuales → Crear. Suscripción **Azure for Students**, grupo `trivia-castro`.
- [ ] Imagen **Ubuntu Server 24.04 LTS**, tamaño **B2s** si aparece (mínimo **B1ms/B1s**).
- [ ] Autenticación por **clave SSH** (usuario `azureuser`); guarda el `.pem` en un lugar seguro y **fuera del repo**.
- [ ] Puertos de entrada: **22, 80 y 443**.
- [ ] Si el tamaño o la región no aparecen: prueba otra región (las cuentas de estudiante tienen restricciones). Apunta cuál usaste.
- [ ] Si la VM tiene **1 GB de RAM**, crea el swap (paso 3 de la guía) **antes** de levantar, o la compilación del Website se queda sin memoria.

**1.2 Dominio**
- [ ] En la IP pública: etiqueta DNS `triviacastro` (si está ocupada, usa otra, p. ej. `triviacastro-up`) y **IP estática**.
- [ ] Anota el dominio completo: `triviacastro.<región>.cloudapp.azure.com`. Es la variable `DOMAIN`.

**1.3 Preparar el servidor**
- [ ] Entra por SSH desde PowerShell: `ssh -i .\clave.pem azureuser@<dominio>`.
- [ ] Instala Docker (`curl -fsSL https://get.docker.com | sudo sh`), `sudo usermod -aG docker $USER`, sal y **vuelve a entrar**.
- [ ] `docker --version` y `docker compose version` responden.

**1.4 Descargar y configurar**
- [ ] `git clone https://github.com/Guineote/Trivia-Castro.git trivia && cd trivia`. Si el repositorio fuera privado, usa un token de acceso personal de GitHub (solo lectura) como contraseña, como dice la guía.
- [ ] `cp .env.example .env` y edítalo **en el servidor** (`nano .env`):
  - `MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD`: **nuevas**, generadas con `openssl rand -hex 16`. **No** uses las de desarrollo.
  - `MYSQL_DATABASE=trivia_castro`, `MYSQL_USER=trivia_user`.
  - `DOMAIN=<tu dominio>` (sin `https://`).
- [ ] **No pegues contraseñas en chats ni en git.** Guárdalas en un gestor de contraseñas.

**1.5 Levantar**
- [ ] `docker compose -f docker-compose.prod.yml up -d --build` (la primera vez tarda varios minutos).
- [ ] `docker compose -f docker-compose.prod.yml ps`: los 3 servicios **Up** y `mysql` **healthy**.
- [ ] `docker compose -f docker-compose.prod.yml logs api`: debe verse `Application startup complete` y no errores de migración.
- [ ] Abre `https://<dominio>` desde tu laptop: candado de HTTPS válido y la pantalla de inicio. (El certificado puede tardar ~1 minuto en el primer acceso.)
- [ ] Si falla el certificado: puertos 80 y 443 abiertos en **Redes** de la VM, y `DOMAIN` idéntico a la etiqueta DNS.

**Si algo falla aquí**, pásale a Adler la salida de `docker compose ... logs api` y `... logs caddy` (sin contraseñas).

## Fase 2 — Verificar que funciona (desde fuera de la VM)

Cuando tengas la URL, **mándasela a Adler**: puede correr una verificación completa desde su lado (headers, partida con bots, carga ligera) y reportar.

- [ ] `curl.exe -I https://<dominio>` → `HTTP/2 200` (o 1.1) y `content-type: text/html`.
- [ ] `curl.exe -s -i https://<dominio>/api/v1/categories` → **401** con `X-Server-Time` en milisegundos y cuerpo `{"error":{"code":"UNAUTHORIZED"...}}`.
- [ ] Recargar con F5 en `/sala/XXXXXX` y en `/partida/g1/resultados` abre la app (no un 404).
- [ ] **Dos navegadores** (uno en incógnito): crear sala, unirse, partida completa, estadísticas y **JUGAR OTRA VEZ**.
- [ ] **Bots contra el servidor** desde tu laptop (PowerShell, en `api/`):
  ```powershell
  $env:API_BASE = "https://<dominio>/api/v1"
  .venv\Scripts\python scripts\play_bots.py --bots 7 --rounds 3
  ```
  Eso crea una sala con 7 bots: revisa que el servidor no se sature (`docker stats` en la VM) y que no haya errores 500 en `logs api`.
- [ ] En F12 → Red, durante una partida: las peticiones a `/state` responden **304** casi siempre.
- [ ] **Celulares:** uno con **datos móviles** y otro con Wi-Fi. Crear sala desde un celular y unirse desde otro. Revisar: diseño a 360 px, que suene (el sonido necesita un primer toque), el botón COPIAR del código (requiere HTTPS) y que la partida no se corte al bloquear/desbloquear la pantalla.
- [ ] **Proyector** (si lo van a usar): ver el marcador, el podio y la tabla de resultados desde lejos.
- [ ] Una prueba **larga**: partida de 10 rondas con 4 o más dispositivos a la vez.

## Fase 3 — Plan B (ensayarlo ahora, no el viernes)

Para el caso de que Azure falle el día de la entrega. Está en la sección 8 de la guía; ensayarlo cuesta 30 minutos.

- [ ] Instalar `cloudflared` en la laptop que vaya a publicar.
- [ ] `cd web`, **comprobar que `VITE_USE_MOCK` no sea `true`**, y `npm run build`.
- [ ] `cd api` y arrancar con MySQL local (`docker compose up -d` y los pasos del `api/README.md`): `.venv\Scripts\python -m uvicorn app.main:app --port 8000`. La API sirve `web/dist` sola.
- [ ] En otra terminal: `cloudflared tunnel --url http://localhost:8000` y abrir la URL `https://....trycloudflare.com` desde un celular con datos móviles.
- [ ] Anotar el tiempo que toma montarlo de cero (para saber si da tiempo el día de la entrega).

## Fase 4 — Papeles y decisiones (se puede hacer en paralelo)

**4.1 Pasar al contrato lo que ya decidió la API** (`docs/contrato/`), todo en un solo PR de acuerdo con Adler:
- [ ] **D13 revancha** (hoy marcada como propuesta en `docs/contrato/README.md`): cambiarla a confirmada si estás de acuerdo.
- [ ] Decisiones de la tabla «Decisiones del frente A» de `docs/frontend/PENDIENTES.md`: milisegundos en timestamps, `lastResult` en timeout, rangos de `settings`, CORS, `activePower`, **`powerUsed`**, puntos base y bonus de velocidad.
- [ ] Códigos de error nuevos en la tabla del contrato: `NOT_FOUND` e `INTERNAL_ERROR`.
- [ ] (Opcional) añadir `powerUsed` a los ejemplos `state-reveal.json` y `state-scoreboard.json`. **Ojo:** hay pruebas que comparan las claves exactas contra esos ejemplos (en `api/tests/test_game.py` y `web/src/test/fixtures.test.ts`); si se tocan los ejemplos, hay que ajustar ambas.
- [ ] Revisar y mergear el cambio de la revancha en `api/` (`rooms.start_game`, `games.create_game`) y el de apodos con acentos (`_name_key`). Ya están mergeados; falta tu visto bueno explícito para dar por cerrada la D13.

**4.2 El manual de la API (entregable del proyecto)**
- [ ] Escribir el **documento final con el manual de la API** (aún no existe). La base es `docs/contrato/` + `docs/frontend/GUIA-PARA-LA-API.md` + `api/PLAN-API.md`. Debe incluir: qué es la API, cómo se arranca, autenticación por token, cada endpoint (request, respuesta, errores), el ciclo de fases, reglas de puntuación, poderes, ETag/304 y reloj, y la revancha. Adler puede ayudar con capturas del Website.
- [ ] Confirmar el **formato de entrega** (¿PDF, Word, Markdown?) con el maestro.

**4.3 Decisiones de juego que siguen provisionales**
- [ ] **Fórmula del bonus de velocidad y puntos base por dificultad:** hoy `400·(20 s − t)/20 s` y 500/800/1100 (`api/app/scoring.py`). Decidir si se quedan como definitivas y anotarlo en el contrato.
- [ ] **Desempate del ranking:** hoy es por orden de unión a la sala. Confirmar.
- [ ] `pointsThisRound` en `SCOREBOARD`: el contrato dice `null`; el frontend lo muestra en el reveal. Confirmar que se queda así.

**4.4 Limitaciones conocidas (decidir si se arreglan o se documentan)**
- [ ] Quien sale con SALIR **tras** la partida conserva su fila y entra igual a la revancha sin responder (acaba de espectador). Si estorba en la demo: pedirle a los jugadores que **se queden** en la pantalla final antes de la revancha.
- [ ] Salas viejas: las partidas terminadas se acumulan en la base. Irrelevante para la demo.
- [ ] No existe `GET /players/me`: un token viejo solo se descubre inválido con un 401 tardío (por ejemplo tras reiniciar la base). El Website lo maneja volviendo a Home.

**4.5 Documentos al día (Adler)**
- [ ] Limpiar `docs/frontend/PENDIENTES.md`: varios huecos ya están resueltos y siguen sin marcar.
- [ ] Poner la **URL de producción** en `README.md`, `web/README.md` y `docs/despliegue-azure.md`.
- [ ] Unificar el nombre del juego: el `CLAUDE.md` raíz, `docs/` y `.env.example` aún dicen «Trivia Chaos» en varios lugares; el nombre elegido es **Trivia Castro**.
- [ ] Revisar el `CLAUDE.md` raíz (secciones 12 y 13) cuando todo esté terminado.

## Fase 5 — Seguridad (rápida)

- [ ] Las contraseñas del `.env` de desarrollo estuvieron en el **historial de git**: si se usan en cualquier otro lado, **cámbialas**.
- [ ] En la VM: puertos abiertos **solo 22, 80 y 443**; si puedes, **restringe el 22 a tu IP** (VM → Redes).
- [ ] MySQL **no** debe tener puertos publicados (en `docker-compose.prod.yml` no los tiene; no lo cambies).
- [ ] **No** agregues `--workers` ni réplicas de la API: el reloj de las fases es por petición y hay un candado global; dos procesos = dos relojes.
- [ ] No subas el `.pem` ni el `.env` del servidor a ningún repositorio.

## Fase 6 — Ensayo y día de la entrega

**Un día antes**
- [ ] Último despliegue **como mínimo 1 hora antes** de cualquier ensayo: `git pull && docker compose -f docker-compose.prod.yml up -d --build` tarda varios minutos. **Después de ese último despliegue, no cambiar nada más.**
- [ ] Ensayo completo con **todos los dispositivos reales** que se usarán, con el tiempo de la presentación.
- [ ] Probar el sonido y el volumen en el equipo y el proyector que se usarán (el CRT y el sonido se pueden apagar desde los botones de arriba a la derecha).
- [ ] Tener a la mano: la URL, el código de una sala de prueba, el `.pem` y la contraseña de la VM.

**El día**
- [ ] **Encender la VM 30 minutos antes** si estaba desasignada, y abrir la URL. Con la IP estática el dominio no cambia, y los contenedores arrancan solos (`restart: unless-stopped`), pero **compruébalo con `docker compose ... ps` y abriendo el sitio**: no des por hecho que volvió.
- [ ] Crear una sala de prueba y jugar 1 ronda con un celular para confirmar que todo responde; después, descartarla (no se reutiliza).
- [ ] Cerrar pestañas y programas pesados en el equipo de la presentación.
- [ ] Plan B montado y probado en una laptop (Fase 3), pero **sin usarlo** salvo emergencia.
- [ ] Después de la entrega: **detener (desasignar)** la VM desde el portal para no gastar crédito.

## Comandos útiles en la VM (carpeta `trivia`)

| Quiero… | Comando |
|---|---|
| Ver el estado | `docker compose -f docker-compose.prod.yml ps` |
| Logs de la API | `docker compose -f docker-compose.prod.yml logs -f api` |
| Logs de HTTPS | `docker compose -f docker-compose.prod.yml logs caddy` |
| Uso de CPU/RAM | `docker stats` |
| Actualizar a lo último de `main` | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Reiniciar | `docker compose -f docker-compose.prod.yml restart` |
| Detener (conserva los datos) | `docker compose -f docker-compose.prod.yml down` |
| **Borrar también la base** | `docker compose -f docker-compose.prod.yml down -v` (¡destruye todo!) |

## Si algo sale mal

| Síntoma | Qué mirar |
|---|---|
| El certificado no se genera | Puertos 80/443 abiertos en la VM; `DOMAIN` = etiqueta DNS exacta; `logs caddy` |
| El build se queda sin memoria | VM de 1 GB sin swap (paso 3 de la guía) |
| La web carga pero todo da error | `logs api`: contraseña de MySQL distinta entre el primer arranque y el `.env`; si cambiaste `MYSQL_PASSWORD` después de crear el volumen, hay que borrar el volumen (`down -v`) o cambiarla dentro de MySQL |
| «Tu sesión no es válida» al volver | La base se reinició: es esperado, vuelve a escribir tu nombre |
| Los números de las estadísticas se quedan en 0 | Pestaña oculta: la animación se reanuda al volver |
| Todo lento con muchos jugadores | `docker stats`; sube de B1s a B2s en el portal |
| Nada funciona el día de la entrega | **Plan B** (Fase 3) |

## Orden recomendado si hay poco tiempo

1. Fase 0 y Fase 1 (Azure). **Sin esto no hay nada que enseñar.**
2. Fase 2 solo con dos navegadores y un celular.
3. Fase 3 (plan B), aunque sea una vez.
4. Fase 4.2 (el manual de la API): es un **entregable**, no lo dejes para el final.
5. El resto (contrato, limpieza de documentos) puede esperar a después de la entrega.
