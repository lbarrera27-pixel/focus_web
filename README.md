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
| POST | `/ia/prob-ignorar` | IA (ML): probabilidad de ignorar una pausa, con el contexto completo |
| POST | `/ia/prob-ignorar/app/{numero}` | IA (ML): lo mismo, con el contexto tomado de la BD del usuario |
| GET | `/ia/modelo-pausas` | IA (ML): métricas del modelo |
| POST | `/ia/pronostico-uso` | IA (red neuronal): minutos esperados a partir de 7 días |
| GET | `/ia/pronostico-uso` | IA (red neuronal): pronóstico de hoy con EVENTO_USO y PLAN |
| GET | `/ia/modelo-uso` | IA (red neuronal): métricas y curva de aprendizaje |
| POST | `/ia/optimizar-pausas` | IA (algoritmo genético): horario de pausas del día |
| POST | `/ia/ruta-plan` | IA (búsqueda A*): ruta semanal del límite a la meta |

## Reglas de negocio destacadas

- **Integridad referencial:** no se puede borrar una app con eventos o pausas, ni una franja con eventos (`409`).
  Eventos y pausas validan que la app (y la franja) existan (`404`).
- **Contraseñas** con bcrypt; el email se guarda en minúsculas y es único.
- **Un solo plan activo:** al crear un plan, los anteriores se desactivan.
- **Ajuste semanal:** si no se envía `cambio_pct`, se calcula con lógica difusa (ver abajo).
  La Azure Function usa las mismas reglas.
- **Sesión de foco:** al marcarla `completada`, se registra la hora de fin.

## Inteligencia artificial (materia de IA)

| Técnica | Dónde | Qué hace en Focus! | Ruta |
|---|---|---|---|
| Lógica difusa (Mamdani) | `app/utils/reglas_plan.py` | Cuánto bajar el límite cada semana | `/planes/{n}/ajustes`, `/api/ajuste-semanal` |
| Aprendizaje supervisado | `app/ia/modelo_pausas.py` | Predice si el usuario ignorará una pausa | `/ia/prob-ignorar` |
| Red neuronal | `app/ia/modelo_uso.py` | Pronostica los minutos de pantalla de mañana | `/ia/pronostico-uso` |
| Algoritmo genético | `app/ia/genetico.py` | Elige a qué horas y de qué tipo poner las pausas | `/ia/optimizar-pausas` |
| Búsqueda A* | `app/ia/busqueda.py` | Planea la ruta semanal del límite actual a la meta | `/ia/ruta-plan` |

Las técnicas se apoyan entre sí: el genético usa el modelo de ML para saber qué pausas se
ignorarán, A* busca recortes graduales como los que premia la lógica difusa, y la red avisa
si hoy se rebasará el límite del plan.

```
App Android ──▶ POST /ia/prob-ignorar/app/3 {"tipo": "media"}
                   la API arma el contexto con APP, EVENTO_USO y PAUSA de hoy
              ◀── {"tipo_recomendado": "alta", "probabilidad_ignorar": 0.41, …}
App Android ──▶ muestra la pausa y luego POST /pausas {"ignorada": true|false}
                   (cada pausa real es un ejemplo más para reentrenar)
```

### Datos simulados

Aún no hay usuarios con historial, así que `app/ia/simulador.py` genera datos sintéticos:

- **Pausas:** 200 usuarios × 28 días ≈ 36 600 pausas (42 % ignoradas). La probabilidad de ignorar
  depende de la categoría de la app, el tipo de pausa, la hora, el fin de semana, los minutos que
  lleva en la app, las pausas previas del día y un rasgo oculto de disciplina de cada usuario.
- **Uso diario:** 300 usuarios × 120 días. Escala propia de cada usuario, más uso el fin de semana,
  rachas (proceso AR(1)) y una tendencia que baja poco a poco.

En todos los modelos la partición entrenamiento/prueba es **por usuario** (75 % / 25 %): se evalúa
con usuarios que el modelo nunca vio. Los modelos se entrenan al primer uso y se quedan en memoria.

### Aprendizaje supervisado: pausas ignoradas

Clasificación binaria comparando regresión logística y árbol de decisión; se sirve el de mejor AUC.

| Modelo | Exactitud | Precisión | Sensibilidad | F1 | AUC |
|---|---|---|---|---|---|
| Línea base (siempre "no ignora") | 0.568 | — | — | — | — |
| Árbol de decisión | 0.676 | 0.702 | 0.434 | 0.536 | 0.726 |
| **Regresión logística** (elegido) | **0.691** | 0.683 | **0.532** | **0.598** | **0.745** |

El modelo recupera solo los factores del simulador: más minutos de uso y más pausas en el día
suben el riesgo; las apps de productividad y las pausas altas lo bajan. La disciplina de cada
usuario no es un atributo, por eso el AUC no llega a 1.

### Red neuronal: pronóstico de uso

Perceptrón multicapa 14 → 32 → 16 → 1 (ReLU, Adam, paro temprano). Entradas: los 7 días previos
divididos entre su promedio (para que aprenda la forma y no la escala) y el día de la semana.

| Método (error en minutos/día) | MAE | RMSE | MAPE |
|---|---|---|---|
| Mismo día de la semana pasada | 46.1 | 61.4 | 21.3 % |
| Promedio de 7 días | 40.4 | 52.9 | 18.8 % |
| Lo mismo que ayer | 36.8 | 49.6 | 16.7 % |
| **Red neuronal** | **28.6** | **37.9** | **13.0 %** |

### Algoritmo genético: horario de pausas

Cromosoma de 24 genes (uno por hora: sin pausa, leve, media o alta), 4^24 ≈ 2.8 × 10^14 horarios.
Aptitud = minutos ahorrados esperados − molestia, donde la probabilidad de que cada pausa se ignore
la da el modelo de ML (con las pausas previas, así que poner muchas también cuesta). Torneo,
cruce de un punto, mutación y elitismo; 60 individuos × 150 generaciones (≈ 0.1 s).

Con un sábado típico en redes sociales (máx. 8 pausas) el genético espera ahorrar **25.8 min**
contra **8.5 min** de un horario hecho a mano (pausas medias en las 8 horas de más uso). Aprende
algo poco obvio: conviene poner pausas temprano, cuando todavía se respetan, en lugar de
amontonarlas en la noche, cuando casi todas se ignoran.

### Búsqueda A*: ruta del plan

Estados (semana, límite); acciones: bajar 5, 10, 15 o 20 % por semana; costo de una semana
= 1 + (reducción / 10 %)², que castiga los recortes bruscos. Heurística admisible: 1.25 × semanas
mínimas que faltan. Encuentra la misma ruta óptima que la búsqueda de costo uniforme expandiendo
menos nodos (300 → 120 min en 12 semanas: costo 17.25 con 155 nodos contra 168).

### Comandos

```bash
python -m app.ia.simulador --salida pausas_simuladas.csv   # CSV para graficar en Excel
python -m app.ia.modelo_pausas                              # reporte del modelo de pausas
python -m app.ia.modelo_uso                                 # reporte de la red neuronal
```

La hora local de los usuarios se toma de `UTC_OFFSET_HORAS` (por defecto −6, centro de México),
porque la BD guarda las fechas en UTC.
