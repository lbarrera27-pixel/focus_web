# Focus! API — Backend en la nube

Backend de **Focus!**, una app Android que reduce gradualmente el tiempo en pantalla.
Proyecto final de **Servicios Cloud** (Facultad de Informática, UAQ).

| Requisito de la entrega (19/oct/2026) | Cómo se cumple |
|---|---|
| CRUD de las APIs mediante controladores y rutas de cada tabla | 10 tablas, un controlador por tabla en `app/controllers/` (56 operaciones) |
| Base de datos en la nube | **Azure SQL Database** con SQLAlchemy (`create_all` sincroniza el esquema al arrancar) |
| Servicio de almacenamiento | **Azure Blob Storage**: `POST /usuarios/me/foto/archivo` sube la foto de perfil |
| 1 API desplegada en la nube (mínimo 12 rutas) | FastAPI en **Azure App Service** (Linux, Python 3.12) |
| 1 API con funciones serverless (una ruta) | **Azure Functions**: `POST /api/ajuste-semanal` (carpeta `serverless/`) |

## Arquitectura

```
App Android ──HTTPS + X-Usuario-Id──▶ Azure App Service (FastAPI)
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

```
focus-api/
├── main.py                  # crea la app, registra controladores y manejadores de error
├── app/
│   ├── config.py            # variables de entorno (BD, Blob, CORS)
│   ├── database.py          # engine, sesión y sincronización del esquema
│   ├── dependencies.py      # usuario_actual(): lee el header X-Usuario-Id
│   ├── models/              # 10 tablas (una por archivo)
│   ├── schemas/             # entrada / salida de cada tabla
│   ├── repositories/        # acceso a datos
│   ├── services/            # lógica de negocio
│   ├── controllers/         # rutas (un controlador por tabla)
│   └── utils/               # bcrypt, Blob Storage, reglas del plan, errores
├── serverless/              # Azure Function (API serverless)
├── deploy/                  # scripts de PowerShell para crear y desplegar en Azure
├── postman/                 # colección Focus_API_v2 con pruebas automáticas
└── tests/                   # pruebas con pytest
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

Requisitos: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) y
[Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

```powershell
az login
# 1. (una sola vez) edita deploy\config.ps1 y cambia $Sufijo por algo tuyo
.\deploy\01_crear_recursos.ps1     # SQL, Storage, App Service y Function App
.\deploy\02_desplegar_api.ps1      # sube la API y prueba /salud
.\deploy\03_desplegar_funcion.ps1  # publica la función serverless y la prueba
```

Si PowerShell bloquea los scripts: `Set-ExecutionPolicy -Scope Process Bypass`.

Al terminar, las URLs quedan en `deploy\salida.env` (**no lo subas a GitHub**, tiene contraseñas):

- API: `https://focus-api-<sufijo>.azurewebsites.net/docs`
- Función: `https://focus-func-<sufijo>.azurewebsites.net/api/ajuste-semanal`

Para volver a subir cambios de la API solo ejecuta `02_desplegar_api.ps1`.
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

## Rutas (56 operaciones)

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
| POST / GET | `/api/ajuste-semanal` | **Azure Function** (serverless) |

## Reglas de negocio destacadas

- **Integridad referencial:** no se puede borrar una app con eventos o pausas, ni una franja con eventos (`409`).
  Eventos y pausas validan que la app (y la franja) existan (`404`).
- **Contraseñas** con bcrypt; el email se guarda en minúsculas y es único.
- **Un solo plan activo:** al crear un plan, los anteriores se desactivan.
- **Ajuste semanal:** si no se envía `cambio_pct`, se calcula por la adherencia
  (≥ 0.90 → −10 %, ≥ 0.75 → −5 %, ≥ 0.50 → 0 %, menor → +5 %). La Azure Function usa las mismas reglas.
- **Sesión de foco:** al marcarla `completada`, se registra la hora de fin.
