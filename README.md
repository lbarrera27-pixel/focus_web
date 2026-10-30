<p align="center"><img src="docs/logo.svg" alt="Focus! · Menos pantalla, más enfoque" width="460"></p>

# Focus! — Portal web y API en la nube

Frontend web y backend de **Focus!**, una app que reduce gradualmente el tiempo en pantalla.
Proyecto final de **Servicios Cloud** (Facultad de Informática, UAQ).

| Parte | Servicio de Azure | URL |
|---|---|---|
| Frontend: portal web (`web/`) | Azure Static Web Apps | https://green-moss-07816e210.4.azurestaticapps.net |
| Backend: API FastAPI | Azure App Service + Azure SQL + Blob Storage | https://focus-api-luisbb27.azurewebsites.net/docs |
| API serverless | Azure Functions | `POST https://focus-func-luisbb27.azurewebsites.net/api/ajuste-semanal` |

| Requisito de la entrega (19/oct/2026) | Cómo se cumple |
|---|---|
| CRUD de las APIs mediante controladores y rutas de cada tabla | 11 tablas, un controlador por tabla en `app/controllers/` (60 operaciones) |
| Base de datos en la nube | **Azure SQL Database** con SQLAlchemy (`create_all` sincroniza el esquema al arrancar) |
| Servicio de almacenamiento | **Azure Blob Storage**: `POST /usuarios/me/foto/archivo` sube la foto de perfil |
| 1 API desplegada en la nube (mínimo 12 rutas) | FastAPI en **Azure App Service** (Linux, Python 3.12) |
| 1 API con funciones serverless (una ruta) | **Azure Functions**: `POST /api/ajuste-semanal` (carpeta `serverless/`) |
| Frontend en la nube conectado a las API | Portal React (`web/`, diseño de Figma) en **Azure Static Web Apps**, llamando a la API de App Service |

## Arquitectura

```
Portal web (Azure Static Web Apps) ──HTTPS + X-Usuario-Id──┐
App Android ──HTTPS + X-Usuario-Id──▶ Azure App Service (FastAPI) ◀┘
                                         │  Controller → Service → Repository (SQLAlchemy)
                                         ├──────────────▶ Azure SQL Database
                                         └──────────────▶ Azure Blob Storage (fotos)
App Android ──HTTPS──▶ Azure Functions (/api/ajuste-semanal)
```

Capas (igual que en el proyecto de clase):

- **Controller** (`app/controllers/`): recibe la petición HTTP, llama al servicio y regresa la respuesta.
- **Service** (`app/services/`): reglas de negocio (numeración por usuario, integridad, cálculo del ajuste).
- **Repository** (`app/repositories/`): la única capa que habla con la base de datos.
- **Models** (`app/models/`): tablas del ORM. **Schemas** (`app/schemas/`): validación de entrada/salida con Pydantic.

## Estructura del repositorio

```
focus_web/
│
├── README.md                      ← URLs de Azure, arquitectura, rutas y cómo desplegar
├── .env.example, .gitignore
│
├── ─────────── BACKEND (API FastAPI → Azure App Service) ───────────
├── main.py                        ← crea la app, registra controladores y manejadores de error
├── requirements.txt
├── app/
│   ├── config.py                  variables de entorno (BD, Blob, CORS, LLM)
│   ├── database.py                engine, sesión y sincronización del esquema
│   ├── dependencies.py            usuario_actual(): lee el header X-Usuario-Id
│   ├── controllers/               rutas (un controlador por tabla, más riesgo y compañero)
│   ├── services/                  reglas de negocio
│   ├── repositories/              acceso a datos (única capa que usa SQLAlchemy)
│   ├── models/                    11 tablas del ORM (Azure SQL)
│   ├── schemas/                   validación de entrada / salida con Pydantic
│   └── utils/                     Blob Storage, reglas difusas, riesgo, LLM, bcrypt, errores
│
├── serverless/                    ← API serverless → Azure Functions (/api/ajuste-semanal)
├── ia/                            ← generador sintético, regresión logística desde cero,
│                                    métricas y evaluación del Compañero Foqui
│
├── ─────────── FRONTEND (portal React + Vite → Azure Static Web Apps) ───────────
├── web/
│   ├── package.json, vite.config.js, index.html, .env.example
│   └── src/
│       ├── App.jsx, main.jsx
│       ├── api.js                 cliente de la API (header X-Usuario-Id)
│       ├── components/            Sidebar, TopBar, Card, Icono
│       ├── data/                  lógica de cada pantalla (panel, telemetría, análisis, clústeres, ajustes)
│       ├── pages/                 Login, Panel General, Telemetría, Análisis, Clústeres
│       │   └── ajustes/           Ajustes y sus 4 pestañas
│       └── assets/                íconos y logos del diseño de Figma
│
├── ─────────── DESPLIEGUE Y PRUEBAS ───────────
├── deploy/
│   ├── config.ps1                 nombres y región de los recursos
│   ├── 01_crear_recursos.ps1      SQL, Storage, App Service y Function App
│   ├── 02_desplegar_api.ps1       backend
│   ├── 03_desplegar_funcion.ps1   serverless
│   ├── 04_borrar_todo.ps1         elimina el grupo de recursos
│   ├── 05_desplegar_web.ps1       frontend
│   └── 06_datos_demo.py           cuenta con datos de ejemplo
├── postman/                       colección Focus_API_v2 con pruebas automáticas
└── tests/                         pytest: API, riesgo, compañero y reglas del plan
```

## Identificación del usuario por header

Las rutas privadas requieren el header **`X-Usuario-Id`**. Los números de las rutas son
**relativos a ese usuario**, no ids globales:

| Petición | Resultado |
|---|---|
| `GET /pausas/7` + `X-Usuario-Id: 1` | 7.ª pausa del usuario 1 |
| `GET /pausas/7` + `X-Usuario-Id: 2` | 7.ª pausa del usuario 2 (otro registro) |
| `GET /pausas/7` sin header | `422` |
| `GET /pausas/7` + `X-Usuario-Id: 999` | `401` (usuario inexistente o inactivo) |

Cada tabla del usuario tiene `id` (clave primaria global) y `numero` (consecutivo por usuario,
`UNIQUE(usuario_id, numero)`). `POST /auth/login` devuelve el `usuario_id` que la app debe enviar en el header.

## Correr en local

```powershell
cd C:\Users\angel\Documents\GitHub\focus-api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- Swagger: http://127.0.0.1:8000/docs
- Sin variables de entorno usa SQLite (`focus.db`). Para usar Azure SQL desde tu compu, copia
  `.env.example` a `.env` y llena los datos (necesitas el *ODBC Driver 18 for SQL Server*).

Pruebas automáticas (usan una BD temporal):

```powershell
pip install pytest httpx
pytest -q
```

## Portal web (`web/`)

Panel de investigación hecho con React + Vite a partir del diseño de Figma ("Dashboards web").
Consume esta misma API: inicia sesión con `/auth/login` y manda `X-Usuario-Id` en cada petición.

```powershell
cd web
copy .env.example .env    # VITE_API_URL apunta a la API (local o Azure)
npm install
npm run dev               # http://localhost:5173
```

- **Ver demo sin cuenta** muestra el portal con datos de ejemplo, sin servidor.
- Hecho: Panel General (6 tarjetas con datos reales), Telemetría Cloud (dispositivo, estado de
  la API, bitácora en vivo), Análisis e IA (curva de riesgo y el mismo motor Mamdani de la API)
  y Clústeres (K-Means sobre los días del usuario; "Aplicar" llama a `PUT /apps` y
  `POST /planes/{n}/ajustes`) y Ajustes y Perfil (4 pestañas).
- En Ajustes, "Guardar" envía a la API el límite diario (`PUT /planes/{n}`) y el límite de aperturas
  de cada app (`PUT /apps/{n}`); también se pueden crear apps (`POST /apps`) y desactivar la cuenta
  (`DELETE /usuarios/me`). Los ajustes sin endpoint (niveles de fricción, modo foco, privacidad…)
  se guardan solo en el navegador y la interfaz lo indica con la etiqueta "Solo en este navegador".

## Desplegar en Azure

Requisitos: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
[Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) y Node.js 18+ (portal web).

```powershell
az login
# 1. (una sola vez) edita deploy\config.ps1 y cambia $Sufijo por algo tuyo
.\deploy\01_crear_recursos.ps1     # SQL, Storage, App Service y Function App
.\deploy\02_desplegar_api.ps1      # sube la API y prueba /salud
.\deploy\03_desplegar_funcion.ps1  # publica la función serverless y la prueba
.\deploy\05_desplegar_web.ps1      # compila web/ contra la API y lo publica en Static Web Apps
```

Si PowerShell bloquea los scripts: `Set-ExecutionPolicy -Scope Process Bypass`.

Al terminar, las URLs quedan en `deploy\salida.env` (**no lo subas a GitHub**, tiene contraseñas):

- API: `https://focus-api-<sufijo>.azurewebsites.net/docs`
- Función: `https://focus-func-<sufijo>.azurewebsites.net/api/ajuste-semanal`
- Portal web: la URL `https://<nombre>.azurestaticapps.net` que imprime `05_desplegar_web.ps1`

Para tener una cuenta con datos de ejemplo (p. ej. para la profesora), crea una con
`python deploy/06_datos_demo.py --api https://focus-api-<sufijo>.azurewebsites.net --email profesora@focus.app`:
pide la contraseña y registra por la API 6 apps, ~2 semanas de eventos, pausas, un plan con ajustes,
un dispositivo, sesiones de foco y dominios bloqueados.

Para volver a subir cambios de la API solo ejecuta `02_desplegar_api.ps1`; los del portal, `05_desplegar_web.ps1`.
Al acabar la materia, `04_borrar_todo.ps1` elimina todo para no gastar créditos.

### Problemas comunes

| Síntoma | Solución |
|---|---|
| `RequestDisallowedByPolicy` o "región no permitida" | Azure for Students limita las regiones. Cambia `$Ubicacion` en `config.ps1` (p. ej. `westus2`, `eastus2`, `southcentralus`). |
| Azure SQL: "location is not accepting creation of new servers" | Cambia solo `$UbicacionSql` a otra región. |
| `/salud` da error 500 o tarda la primera vez | La base serverless se pausa; tarda ~1 min en despertar. Vuelve a intentar. |
| Log: `Can't open lib 'ODBC Driver 18 for SQL Server'` | Agrega en App Service la variable `AZURE_SQL_DRIVER=ODBC Driver 17 for SQL Server`. |
| Ver errores del servidor | `az webapp log tail -g rg-focus -n focus-api-<sufijo>` |

## Probar con Postman

1. Importa `postman/Focus_API_v2.postman_collection.json`.
2. En la pestaña **Variables** cambia `baseUrl` y `funcUrl` por las URLs de Azure.
3. **Run collection**: el registro guarda `usuarioId` y el header `X-Usuario-Id` se agrega solo
   a cada petición (script a nivel colección). Incluye casos de error (401, 404, 409, 422).
4. Para la foto con Blob Storage: en *POST /usuarios/me/foto/archivo* → Body → form-data → elige una imagen.

## Rutas (60 operaciones)

| Método | Ruta | Tabla / módulo |
|---|---|---|
| GET | `/salud` | Salud (API + BD) |
| POST | `/auth/registro` | USUARIO |
| POST | `/auth/login` | USUARIO |
| GET / PUT / DELETE | `/usuarios/me` | USUARIO |
| POST | `/usuarios/me/foto` | USUARIO (guarda enlace) |
| POST | `/usuarios/me/foto/archivo` | USUARIO + Blob Storage |
| POST / GET | `/apps` | APP |
| GET / PUT / DELETE | `/apps/{numero}` | APP |
| POST / GET | `/eventos` | EVENTO_USO (filtros `app_numero`, `franja_id`, `desde`, `hasta`) |
| GET / PUT / DELETE | `/eventos/{numero}` | EVENTO_USO |
| POST / GET | `/franjas` | FRANJA (catálogo global) |
| POST | `/franjas/generar` | FRANJA (crea las 12 franjas de un día) |
| GET / PUT / DELETE | `/franjas/{franja_id}` | FRANJA |
| POST / GET | `/planes` | PLAN |
| GET | `/planes/activo` | PLAN |
| GET / PUT / DELETE | `/planes/{numero}` | PLAN |
| POST / GET | `/planes/{numero}/ajustes` | AJUSTE_PLAN |
| GET / PUT / DELETE | `/planes/{numero}/ajustes/{semana}` | AJUSTE_PLAN |
| POST / GET | `/pausas` | PAUSA |
| GET / PUT / DELETE | `/pausas/{numero}` | PAUSA |
| POST / GET | `/dominios` | DOMINIO_BLOQUEADO |
| GET / PUT / DELETE | `/dominios/{numero}` | DOMINIO_BLOQUEADO |
| POST / GET | `/sesiones-foco` | SESION_FOCO |
| GET / PUT / DELETE | `/sesiones-foco/{numero}` | SESION_FOCO |
| POST / GET | `/tokens-dispositivo` | TOKEN_DISPOSITIVO |
| GET / PUT / DELETE | `/tokens-dispositivo/{numero}` | TOKEN_DISPOSITIVO |
| GET | `/estadisticas?desde=&hasta=` | Indicadores del usuario |
| GET / PUT | `/configuracion/me` | CONFIGURACION_USUARIO (ajustes del portal web, JSON de máx. ~20 KB) |
| GET | `/riesgo` | **IA:** riesgo de recaída (regresión logística) |
| POST | `/companero/mensaje` | **IA:** Compañero Foqui (LLM que explica el plan y el riesgo) |
| POST / GET | `/api/ajuste-semanal` | **Azure Function** (serverless) |

## Reglas de negocio destacadas

- **Integridad referencial:** no se puede borrar una app con eventos o pausas, ni una franja con eventos (`409`).
  Eventos y pausas validan que la app (y la franja) existan (`404`).
- **Contraseñas** con bcrypt; el email se guarda en minúsculas y es único.
- **Un solo plan activo:** al crear un plan, los anteriores se desactivan.
- **Ajuste semanal:** si no se envía `cambio_pct`, lo calcula un controlador difuso Mamdani con la
  adherencia y las pausas ignoradas de esa semana (`app/utils/reglas_plan.py`). La Azure Function usa las mismas reglas.
- **Sesión de foco:** al marcarla `completada`, se registra la hora de fin.

## IA: riesgo de recaída

`GET /riesgo` estima la probabilidad de que el usuario **se pase de su límite la semana siguiente**
a su último ajuste (adherencia < 0.9). Usa 7 variables de esa semana: adherencia, tendencia,
pausas ignoradas, uso nocturno (22–06 h), sesiones de foco completadas, recorte difuso y racha.
Responde la probabilidad, el nivel (`bajo` debajo del umbral del modelo, `medio`, `alto` desde 0.6)
y los factores ordenados por cuánto pesan (`w_j · z_j`).

El modelo es una **regresión logística programada desde cero con NumPy** (`ia/regresion_logistica.py`)
y entrenada con usuarios sintéticos (`ia/generador.py`). La API solo lee los parámetros de
`app/utils/modelo_riesgo.json` y hace la inferencia en Python puro, así que no necesita NumPy.

```powershell
pip install -r ia/requirements.txt
python -m ia.generador   # resumen de los datos sintéticos
python -m ia.entrenar    # entrena, evalúa y reescribe modelo_riesgo.json e ia/resultados/
```

Resultados en prueba (usuarios que el modelo nunca vio), en `ia/resultados/metricas.json`:

| | Exactitud | Precisión | Recall | F1 | AUC |
|---|---|---|---|---|---|
| Modelo (umbral 0.42, recall ≥ 80 % en validación) | 0.761 | 0.720 | 0.759 | 0.739 | 0.848 |
| Línea base (siempre "no recae") | 0.553 | 0 | 0 | 0 | 0.5 |

Los coeficientes coinciden con `LogisticRegression` de scikit-learn (diferencia < 0.0001).

## IA: Compañero Foqui (LLM)

`POST /companero/mensaje` es el chat con **Foqui**, la mascota de la app (pantalla *Compañero IA (11)*).
Une las tres piezas de la IA: la **lógica difusa** decide el ajuste, la **regresión logística** estima el
riesgo y un **LLM (Claude)** solo lo explica en lenguaje cercano. No decide límites ni fricción.

```json
// Petición (header X-Usuario-Id). Sin "mensaje", Foqui saluda y explica la semana.
{ "mensaje": "¿Por qué bajó mi límite?", "historial": [{ "rol": "foqui", "texto": "¡Hola, Dani!" }] }

// Respuesta
{ "mensaje": "…", "estado_foqui": "Feliz", "fuente": "llm",
  "contexto": { "nombre": "Dani", "semana": 3, "adherencia": 0.92, "cambio_pct": -7.9, "riesgo_nivel": "bajo", … } }
```

- **Estado de Foqui** (`Normal`, `Atenta`, `Enfocado`, `Feliz`, `Cansado`, los mismos de `FoquiEstado` en la app):
  lo deciden reglas fijas con la adherencia, el cambio difuso, el riesgo y si hay una sesión de foco activa,
  no el LLM, para que siempre sea consistente con los números (`app/utils/companero.py`).
- **Privacidad:** el LLM recibe solo datos agregados de la semana (minutos totales, adherencia, cambio, nivel de
  riesgo, racha y el factor que más pesa). Nunca nombres de apps, horarios ni eventos.
- **La llave se queda en el servidor:** la app llama a la API y la API llama a Claude (`ANTHROPIC_API_KEY`).
  Modelo por defecto `claude-haiku-5-5` (rápido y económico); se cambia con `COMPANERO_MODELO`.
- **Respaldo:** sin llave, sin conexión o si el modelo no responde, Foqui usa mensajes predefinidos según su estado
  (`fuente: "respaldo"`) y la app sigue funcionando.
- **Conversación:** la API no guarda chats; la app manda los últimos 10 turnos en `historial`.
- **Seguridad:** tono breve y sin juzgar, sin consejos médicos; ante malestar serio sugiere apoyo profesional
  (Línea de la Vida 800 911 2000).

Evaluación con 24 casos (adherencia × pausas ignoradas × riesgo) y revisión automática de largo, formato,
cifras inventadas, porcentaje correcto y tono. Llama al modelo real 24 veces:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
python -m ia.evaluar_companero   # resultados en ia/resultados/companero.json
```
