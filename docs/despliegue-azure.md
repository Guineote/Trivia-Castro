# Despliegue en Azure (una VM con Docker Compose)

Resultado: **una sola URL pública con HTTPS** (`https://triviacastro.<región>.cloudapp.azure.com`) que sirve el Website y la API. Corre en una VM Linux con tres contenedores: MySQL (interno), la API + Website (interna) y Caddy (HTTPS, puertos 80/443).

Archivos: [`Dockerfile`](../Dockerfile), [`docker-compose.prod.yml`](../docker-compose.prod.yml), [`Caddyfile`](../Caddyfile). Ya se probó el stack completo en local.

> No pegues contraseñas en chats ni las subas a git. El `.env` del servidor se crea **en el servidor**.

## 1. Crear la VM (portal de Azure)

1. **Máquinas virtuales → Crear → Máquina virtual de Azure**.
2. Suscripción **Azure for Students**. Grupo de recursos nuevo: `trivia-castro`.
3. Nombre: `trivia-castro-vm`. **Región:** la más cercana que te deje elegir (p. ej. México Central o EE. UU. Sur-Centro). Si el tamaño que quieres no aparece, prueba otra región (las cuentas de estudiante tienen restricciones).
4. Imagen: **Ubuntu Server 24.04 LTS** (o 22.04).
5. Tamaño: **Standard_B2s** (2 vCPU, 4 GB) si aparece; mínimo viable **B1ms** o **B1s** (con 1 GB, crea swap: paso 3).
6. Autenticación: **clave pública SSH**, usuario `azureuser`. Descarga el `.pem` y guárdalo.
7. Reglas de puerto de entrada: marca **SSH (22), HTTP (80) y HTTPS (443)**.
8. Discos: SSD estándar de 30 GB está bien. **Revisar y crear.**

## 2. Dominio gratis (etiqueta DNS)

1. Abre la VM → **Información general** → **Dirección IP pública** (enlace) → **Configuración**.
2. **Etiqueta de nombre DNS:** `triviacastro` → Guardar.
3. Tu dominio queda: `triviacastro.<región>.cloudapp.azure.com` (aparece en la misma pantalla). Anótalo: es la variable `DOMAIN`.
4. (Recomendado) Asignación de IP **Estática**, para que no cambie si se reinicia.

## 3. Entrar y preparar el servidor

Desde PowerShell, en la carpeta donde está el `.pem`:

```powershell
ssh -i .\trivia-castro-vm_key.pem azureuser@triviacastro.<región>.cloudapp.azure.com
```

Ya dentro de la VM:

```bash
# Docker + Compose (script oficial de Docker)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Vuelve a entrar por SSH (para que aplique el grupo `docker`). **Solo si la VM tiene 1 GB de RAM**, crea swap para que la compilación del Website no se quede sin memoria:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Descargar el proyecto y configurar

```bash
git clone <URL-DEL-REPO> trivia && cd trivia
cp .env.example .env
nano .env
```

En `.env` pon **contraseñas nuevas** (hex, sin símbolos raros) y el dominio. Para generarlas: `openssl rand -hex 16`.

```
MYSQL_ROOT_PASSWORD=<hex-1>
MYSQL_DATABASE=trivia_castro
MYSQL_USER=trivia_user
MYSQL_PASSWORD=<hex-2>
DOMAIN=triviacastro.<región>.cloudapp.azure.com
```

Si el repositorio es privado, usa un token de acceso personal de GitHub (solo lectura) como contraseña al clonar.

## 5. Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # los 3 servicios "Up"; mysql "healthy"
docker compose -f docker-compose.prod.yml logs -f api   # Ctrl+C para salir
```

La primera vez tarda unos minutos (compila el Website). La API crea las tablas (`alembic upgrade head`) y carga las 120 preguntas sola. Caddy obtiene el certificado HTTPS al primer acceso (puede tardar ~1 min).

Abre `https://triviacastro.<región>.cloudapp.azure.com` en el navegador. Si el certificado falla, revisa que los puertos 80 y 443 estén abiertos (VM → **Redes**) y que `DOMAIN` coincida con la etiqueta DNS.

## 6. Probar antes del viernes

- Dos navegadores (uno en incógnito) o un celular con datos móviles: crear sala, unirse, jugar completo.
- Bots desde tu laptop contra el servidor (PowerShell, en `api/`):
  ```powershell
  $env:API_BASE = "https://triviacastro.<región>.cloudapp.azure.com/api/v1"
  .venv\Scripts\python scripts\play_bots.py --room K7X4QM --bots 3
  ```
- Con 4+ dispositivos a la vez, revisa que el juego fluya y que `GET /state` responda 304 (F12 → Red).

## 7. Operación

| Quiero… | Comando (en la VM, carpeta `trivia`) |
|---|---|
| Ver logs de la API | `docker compose -f docker-compose.prod.yml logs -f api` |
| Actualizar a lo último de `main` | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Reiniciar todo | `docker compose -f docker-compose.prod.yml restart` |
| Detener | `docker compose -f docker-compose.prod.yml down` (conserva datos) |
| **Borrar también los datos** | `docker compose -f docker-compose.prod.yml down -v` (¡destruye la BD!) |

- Los contenedores tienen `restart: unless-stopped`: vuelven solos si se reinicia la VM.
- **Ahorra crédito:** si no usas la VM, **detenla (desasigna)** desde el portal. Apagada con `sudo shutdown` Azure sigue cobrando el cómputo. Enciéndela y verifica el sitio **antes** de la demo.
- **Un solo proceso:** no agregues `--workers` ni réplicas del servicio `api` (fases evaluadas por petición + candado global).

## 8. Plan B (si algo falla el viernes)

Correr todo en tu laptop y publicarlo con un túnel temporal (gratis, sin cuenta): arranca la API con el Website compilado (`cd web && npm run build`, luego `cd api && .venv\Scripts\python -m uvicorn app.main:app --port 8000`; la API sirve `web/dist` sola) y en otra terminal `cloudflared tunnel --url http://localhost:8000`. Comparte la URL `https://....trycloudflare.com` que imprime.

## 9. Seguridad rápida

- Abre solo 22, 80 y 443. Restringe el 22 a tu IP si puedes (VM → Redes).
- No publiques el puerto 3306: en `docker-compose.prod.yml` MySQL no expone puertos al exterior.
- No uses las contraseñas de desarrollo en el servidor.
