Holos — Contexto actual y hoja de ruta

## Estado actual de la aplicación

Holos es una plataforma multi-negocio para administrar operaciones de pequeñas empresas. La aplicación ya funciona con backend real y PostgreSQL; esta sección tiene prioridad sobre las notas históricas de los sprints que aparecen más abajo.

### Stack implementado

- Next.js 16.3.5 con App Router y TypeScript.
- Prisma 6.12.0 con PostgreSQL.
- React 19 y validaciones con Zod.
- Sesiones propias mediante cookies HTTP-only y `bcryptjs`.
- Vitest para validaciones de dominio.
- CSS global con soporte light/dark, sin Tailwind actualmente.

### Funcionalidades terminadas

1. **Autenticación y perfil**
  - Registro sin necesidad de crear un negocio.
  - Login, logout y sesiones persistentes.
  - Edición de nombre, email y contraseña.

2. **Multi-negocio y aislamiento**
  - Un usuario puede crear varios negocios.
  - Cada membership pertenece a un negocio específico.
  - Todas las rutas operativas validan `businessId` y membership.
  - Productos, clientes, ventas, facturas, inventario, proveedores y gastos están asociados a un negocio.

3. **Dashboard y negocios**
  - Vista general de los negocios del usuario.
  - Métricas por negocio: clientes, productos, ventas del día, ventas del mes y stock crítico.
  - Accesos a las operaciones de cada negocio.

4. **Productos e inventario**
  - Alta, edición y archivado de productos.
  - Precio, costo, categoría, descripción, stock y stock mínimo.
  - Movimientos iniciales, reposición, ajustes y descuento por venta.

5. **Clientes**
  - Alta, edición y baja lógica.
  - Datos de contacto, notas e historial de ventas.

6. **Ventas**
  - Carrito con múltiples productos.
  - Cliente, medio de pago, cálculo de totales y confirmación.
  - Validación de stock y transacción serializable.
  - Historial y cancelación de ventas pendientes.

7. **Equipo y permisos**
  - Miembros por negocio con roles `OWNER` y `EMPLOYEE`.
  - Invitaciones vinculadas a un negocio.
  - Cambio de rol y baja lógica de miembros.
  - Protección para no dejar un negocio sin propietario.

8. **Proveedores y gastos**
  - Proveedores por negocio, clasificados como productos, insumos, herramientas, servicios u otros.
  - Registro de gastos por negocio.
  - Asociación opcional de cada gasto con un proveedor del mismo negocio.
  - Restricción de base de datos para impedir asociaciones entre negocios.

9. **Facturación actual**
  - La confirmación de una venta crea una factura asociada.
  - Existe un adaptador ARCA en `src/server/services/arca.ts`.
  - En desarrollo puede funcionar en modo mock.

## Backlog priorizado

Este es el orden recomendado para completar la aplicación sin mezclar tareas de infraestructura con mejoras visuales.

### Prioridad 0 — Seguridad y consistencia multi-negocio

- Rotar las credenciales que hayan sido expuestas durante el desarrollo y mantener `.env` fuera del repositorio.
- Agregar autorización por permisos granulares, no solo por rol global.
- Validar todas las rutas dinámicas con UUID antes de consultar Prisma.
- Agregar pruebas de aislamiento: un usuario no puede leer ni modificar datos de otro negocio.
- Registrar auditoría para cambios de roles, productos, gastos, proveedores y ventas.
- Revisar que las operaciones de facturación no dejen stock descontado si ARCA rechaza la factura.

### Prioridad 1 — Facturación electrónica real con ARCA

- Reemplazar el fallback mock por integración oficial con autenticación y certificados de ARCA.
- Incorporar configuración fiscal por negocio: CUIT, punto de venta, condición frente al IVA, domicilio y certificado.
- Modelar tipos de comprobante, numeración por punto de venta, CAE, vencimiento y errores de ARCA.
- Crear pantalla de configuración fiscal y estado de conexión.
- Agregar reintento idempotente y consulta de comprobante sin duplicar facturas.
- Permitir visualizar y descargar el comprobante emitido.

### Prioridad 2 — Gestión completa de proveedores y gastos

- Agregar edición y baja lógica de proveedores.
- Agregar edición, anulación y filtros de gastos.
- Incorporar comprobante del gasto: número, tipo, archivo o referencia externa.
- Agregar filtros por fecha, categoría, proveedor y rango de importes.
- Mostrar gastos en el dashboard del negocio y en el dashboard general.
- Agregar reportes de compras, gastos y margen estimado.

### Prioridad 3 — Dashboard financiero y operativo

- Incorporar ventas, gastos, costo de mercadería y margen.
- Agregar comparaciones contra el período anterior.
- Mostrar actividad reciente real, ya que hoy el bloque de actividad es básico.
- Agregar selector de negocio activo y navegación persistente entre negocios.
- Incorporar métricas de cuentas a pagar por proveedor.

### Prioridad 4 — Equipo e invitaciones completas

- Crear flujo real de aceptación de invitaciones.
- Enviar emails de invitación y recuperación.
- Permitir revocar y reenviar invitaciones.
- Reemplazar roles rígidos por permisos configurables por módulo.
- Ocultar en la navegación las secciones que el usuario no tenga habilitadas.

### Prioridad 5 — Calidad de producto

- Agregar búsqueda, filtros y paginación en listados grandes.
- Agregar estados de error, carga y vacío consistentes.
- Revisar responsive en 375px, 768px y desktop.
- Mejorar accesibilidad: foco, teclado, etiquetas y contraste.
- Incorporar tests de rutas API y flujos críticos, no solo tests de schemas.
- Agregar logging estructurado y monitoreo de errores.

### Prioridad 6 — Operación y despliegue

- Crear migraciones Prisma versionadas en lugar de depender de `db push`.
- Preparar seed reproducible para desarrollo.
- Documentar variables de entorno, ARCA sandbox y producción.
- Configurar CI con lint, tests, typecheck, Prisma validate y build.
- Definir backups, restauración y retención de datos.

---

Esta guía convierte todo lo ya definido (visión, modelo de datos, sistema de diseño, prototipo) en un plan de trabajo ejecutable dentro de Cursor, organizado en sprints cortos con historias de usuario y prompts listos para copiar y pegar.

0. Antes de escribir el primer prompt
0.1 — Poné el contexto del proyecto donde Cursor lo vea siempre
Cursor respeta un archivo de reglas de proyecto. Creá .cursor/rules/holos.md (o .cursorrules si tu versión es más vieja) en la raíz del repo con el bloque de abajo. Esto evita el problema más común de programar con IA: que cada prompt nuevo "olvide" las convenciones y el resultado quede inconsistente entre pantallas.

# Reglas del proyecto — Holos

## Qué es
Plataforma de gestión para pymes de indumentaria/retail chico. Un dueño (Owner)
ve todo el negocio; un colaborador (Employee) solo ve lo que tiene permitido.
El concepto central: una venta actualiza stock, cliente, factura y dashboard
en una sola operación.

## Stack
- Next.js (App Router) + TypeScript estricto (sin `any`)
- Tailwind CSS
- Lucide Icons
- Estado inicial: React state + mock data (sin backend todavía)
- Backend futuro: Node.js + Express + PostgreSQL + Prisma (no lo escribas
  todavía salvo que el prompt lo pida explícitamente)

## Paleta (usar SIEMPRE estos valores, no inventar otros)
- Primary #315C72 · Secondary #4F7568 · Accent #67A0A5
- Light: bg #F4F3EF, surface #FFFFFF
- Dark: bg #0B1117, surface #111B24, elevated #182631
- Tipografía: Inter

## Estructura de carpetas (no crear otra)
src/
  app/
  components/ui/
  components/layout/
  components/features/
  data/mock/
  hooks/
  lib/
  types/
  utils/

## Convenciones de código
- Componentes funcionales, un componente por archivo salvo primitivas de UI muy chicas.
- Props tipadas con `interface`, nunca `any`.
- Nombrar archivos de componentes en PascalCase, hooks con prefijo `use`.
- No usar `localStorage`/`sessionStorage` para datos de negocio — todo vive en
  mock data o, más adelante, en la API.
- Todo texto visible de la interfaz en español (es-AR).
- Los números de moneda se formatean con `Intl.NumberFormat("es-AR")`.

## Lo que no hay que construir todavía
Sin autenticación real, sin base de datos, sin integración con ARCA real,
sin proveedores/compras/gastos, sin IA. Si un prompt lo pide por error, avisar
antes de escribir código.
0.2 — Sumá los artefactos que ya tenés como referencia
Copiá estos archivos a una carpeta docs/ del repo (no se ejecutan, son contexto para vos y para Cursor):

docs/vision.md → el documento de producto completo.
docs/schema.prisma → el modelo de datos ya definido (se usa recién en la Fase 2, pero sirve para que Cursor entienda las entidades desde el día uno).
docs/mockup-reference.jsx → el prototipo interactivo ya construido. Es la referencia visual más importante: cuando un prompt diga "como en el prototipo", Cursor puede abrir este archivo.
0.3 — Flujo de trabajo por prompt (agile, aplicado a IA)
Un prompt = una historia de usuario chica (nunca "hacé todo el módulo de ventas" de una).
Pedile a Cursor que primero te muestre el plan de archivos que va a tocar, antes de generar el código, en tareas grandes.
Revisá el diff completo antes de aceptar — nunca aceptes en piloto automático.
Commiteá por historia terminada, con Conventional Commits (feat:, fix:, refactor:, chore:).
Al cerrar cada sprint, corré una revisión rápida de consistencia visual (paleta, spacing, dark mode) contra el prototipo.
0.4 — Git y ramas
main siempre desplegable.
Una rama por historia: feature/dashboard-stats, feature/nueva-venta, etc.
Commits chicos y frecuentes en vez de uno gigante al final del sprint.
Sprint 0 — Setup del proyecto y sistema de diseño
Objetivo: repo andando, design tokens y componentes base, sin pantallas de negocio todavía.

Historias de usuario

Como developer, quiero un proyecto Next.js configurado con TypeScript y Tailwind para empezar a construir sobre una base sólida.
Como developer, quiero los componentes de UI base (Button, Badge, Input, Modal, etc.) para no reconstruirlos en cada pantalla.
Prompts

Creá un proyecto Next.js 14 con App Router, TypeScript estricto y Tailwind CSS.
Configurá ESLint + Prettier con reglas razonables para un equipo chico.
Armá la estructura de carpetas src/app, src/components/{ui,layout,features},
src/data/mock, src/hooks, src/lib, src/types, src/utils, tal como está en
.cursor/rules/holos.md. No crees ninguna pantalla de negocio todavía, solo
el esqueleto y una página de inicio con un placeholder.
Definí los design tokens de Holos en un archivo src/lib/theme.ts: colores
(primary #315C72, secondary #4F7568, accent #67A0A5, backgrounds y
surfaces de light/dark mode según .cursor/rules/holos.md), y un hook
useTheme() que lea la preferencia del sistema y permita alternar
light/dark, guardando la elección en una cookie (no localStorage, para que
funcione con server components).
Construí los componentes base en src/components/ui/: Button (variantes
primary/secondary/ghost/danger), Badge (tonos success/warning/danger/
neutral/accent), Input, Select, Modal (con overlay y cierre por click
afuera), Card, Toast (con auto-dismiss), EmptyState. Usá los tokens de
theme.ts, nunca colores hardcodeados. Cada componente en su propio archivo,
tipado con TypeScript, sin lógica de negocio.
Definition of Done: el proyecto corre con npm run dev, el dark mode alterna correctamente, y los componentes de ui/ se pueden importar y probar en una página de storybook casera (/dev/components) sin errores de tipos.

Sprint 1 — Layout, navegación y datos mock
Objetivo: la aplicación tiene esqueleto navegable (sidebar, topbar, rutas) con datos de Casa Norte cargados, aunque las pantallas todavía estén vacías.

Historias de usuario

Como Owner, quiero ver un sidebar con Dashboard, Gestión y Administración para navegar el negocio.
Como Employee, quiero ver un sidebar reducido según mis permisos.
Como usuario, quiero cambiar entre light y dark mode.
Prompts

Migrá los datos mock de Casa Norte (productos, clientes, ventas, equipo,
actividad) desde docs/mockup-reference.jsx a archivos separados en
src/data/mock/: products.ts, customers.ts, sales.ts, team.ts, activity.ts,
workspaces.ts. Tipá cada entidad en src/types/ (Product, Customer, Sale,
SaleItem, Member, ActivityLogEntry, Workspace) reflejando los mismos campos
que tiene el schema de Prisma en docs/schema.prisma, para que migrar a la
API real después no cambie las interfaces.
Construí el componente Sidebar en src/components/layout/Sidebar.tsx,
replicando el comportamiento de docs/mockup-reference.jsx: agrupa la
navegación en "Gestión" y "Administración", el segundo grupo solo visible
para Owner, y cada item se oculta si el rol/permiso activo no lo habilita
(no se muestra deshabilitado, se oculta). Incluí el selector de workspace
como un dropdown separado, componentizado en WorkspaceSwitcher.tsx.
Construí el Topbar en src/components/layout/Topbar.tsx con el toggle de
tema, el selector Owner/Employee (por ahora solo para la demo, sin auth
real) y el nombre del negocio activo. Armá el layout raíz
(src/app/layout.tsx o un (app)/layout.tsx) que combine Sidebar + Topbar +
el contenido de cada ruta, con el manejo de mobile (drawer) igual que en
el prototipo.
Creá las rutas vacías con App Router: /dashboard, /sales, /products,
/stock, /customers, /billing, /team, /settings, /activity. Cada una por
ahora solo debe mostrar un <h1> con el nombre de la sección — el contenido
real se construye en los próximos sprints. Confirmá que la navegación del
sidebar apunta a estas rutas con next/link.
Definition of Done: se puede navegar por todas las secciones, el sidebar cambia correctamente entre Owner y Employee, el layout es responsive (drawer en mobile), y no hay pantallas de negocio construidas todavía — solo el esqueleto.

Sprint 2 — Dashboard
Objetivo: el Dashboard muestra datos reales del mock, no números sueltos.

Historias de usuario

Como Owner, quiero ver ventas del mes, ventas de hoy, productos vendidos, clientes y stock crítico calculados a partir de los datos, no hardcodeados.
Como Owner, quiero ver la actividad reciente del negocio.
Prompts

Construí src/app/dashboard/page.tsx. Los StatCards (ventas del mes, ventas
de hoy, productos vendidos, clientes, stock crítico) deben calcularse con
funciones puras en src/lib/metrics.ts a partir de src/data/mock/sales.ts y
products.ts — nada hardcodeado. Escribí también un test unitario simple
(Vitest o Jest, el que ya esté configurado) para la función que calcula
ventas de hoy, dado que es la más propensa a errores de fecha.
Agregá el bloque de actividad reciente, leyendo de
src/data/mock/activity.ts, y el componente de "conexión" (los 5 nodos
Venta → Stock → Cliente → Factura → Dashboard) tal como está en
docs/mockup-reference.jsx, como un componente propio
ConnectionFlow.tsx reutilizable.
Definition of Done: todos los números del Dashboard vienen de funciones calculadas y testeadas, no de valores fijos en el JSX.

Sprint 3 — Productos y Stock
Historias de usuario

Como Owner/Employee con permiso, quiero listar, buscar, crear y editar productos.
Como Owner/Employee con permiso, quiero ver el estado de stock y alertas de stock bajo.
Prompts

Construí /products con listado, búsqueda por nombre (client-side, con
useState + filter, sin necesidad de librería), y un modal de alta/edición
de producto (nombre, precio, stock, stock mínimo, categoría, descripción).
El estado (Disponible/Stock bajo/Agotado) se calcula siempre a partir de
stock vs. stock mínimo, nunca se guarda como texto libre editable.
Construí /stock reutilizando los mismos datos de productos: una tabla con
stock actual, mínimo, estado y "último movimiento" (por ahora derivado de
la venta más reciente que incluya ese producto, ya que StockMovement como
entidad separada recién existe en el backend). Mostrá alertas destacadas
para productos en stock bajo o agotados.
Definition of Done: crear/editar un producto actualiza el estado de stock visible en ambas pantallas sin recargar la página.

Sprint 4 — Clientes
Historias de usuario

Como Owner/Employee con permiso, quiero ver la ficha de un cliente con su historial de compras.
Prompts

Construí /customers con listado, búsqueda, alta de cliente, y un modal de
detalle que muestre compras totales, gasto total, última compra, e
historial de ventas filtrando src/data/mock/sales.ts por customerId. No
dupliques estos datos en el objeto Customer — calculalos a partir de
sales.ts con una función en src/lib/customers.ts, igual que en el
Dashboard.
Definition of Done: el historial de un cliente coincide siempre con sus ventas reales del mock, sin datos duplicados que puedan desincronizarse.

Sprint 5 — Ventas y Nueva venta (el corazón del producto)
Este sprint es el más importante: es donde se demuestra la conexión real entre módulos. Conviene dedicarle más tiempo de revisión manual que a los anteriores.

Historias de usuario

Como Owner/Employee con permiso, quiero ver el listado de ventas recientes.
Como Owner/Employee con permiso, quiero crear una venta seleccionando cliente y productos, y ver el total calculado.
Como usuario, al confirmar una venta quiero ver que se actualizó el stock, el cliente, se generó la factura y el dashboard refleja el cambio.
Prompts

Construí /sales con el listado de ventas (cliente, productos, importe,
método de pago, fecha, estado), reutilizando el componente Badge para el
estado. Agregá el botón "Nueva venta" que abre el modal correspondiente
(se construye en el próximo prompt).
Construí el modal NewSaleModal con dos pasos: selección de cliente y
productos con cantidad (mostrando subtotal y total en tiempo real), y una
pantalla de confirmación que muestre el impacto (stock antes/después,
historial del cliente antes/después) igual que en
docs/mockup-reference.jsx. La lógica de "qué pasa al confirmar una venta"
tiene que vivir en una única función pura y testeada,
src/lib/sales.ts::confirmSale(), que reciba el estado actual (productos,
clientes, ventas) y devuelva el nuevo estado — así en la Fase 2 esta misma
función se puede convertir en la transacción de Prisma sin rehacer la
lógica de negocio, solo el lugar donde vive el estado.
Escribí tests unitarios para confirmSale() cubriendo: descuento correcto
de stock por cada producto de la venta, actualización de contador de
compras y gasto total del cliente, y el caso límite de vender la última
unidad de stock disponible. Este es el flujo más importante del producto,
no lo dejes sin cobertura.
Definition of Done: confirmar una venta actualiza stock, cliente, dashboard y genera una entrada de actividad, todo a partir de la misma función testeada — y ese comportamiento está cubierto por tests, no solo verificado a ojo.

Sprint 6 — Facturación, Equipo y permisos
Historias de usuario

Como Owner, quiero ver la factura generada por cada venta.
Como Owner, quiero invitar colaboradores, asignarles permisos y revocar acceso.
Como Employee, quiero ver solo lo que mis permisos habilitan.
Prompts

Construí /billing con el listado de facturas (derivadas 1 a 1 de las
ventas) y un modal de detalle con el formato de factura de
docs/mockup-reference.jsx. Agregá el banner de estado de conexión con
facturación electrónica (conectado/no conectado) como un componente
reutilizable, porque se muestra también en Configuración.
Construí /team con el listado de miembros, el modal de invitación
(email, rol, permisos granulares por los 7 módulos definidos en
docs/schema.prisma → Membership), y la acción de revocar/reactivar acceso.
La grilla de permisos por miembro tiene que leer los mismos datos que
controlan qué ve cada uno en el Sidebar — un único origen de verdad para
permisos, no dos listas que se puedan desincronizar.
Definition of Done: cambiar un permiso en /team se refleja inmediatamente en lo que ese rol puede ver en el sidebar de la demo (aunque no haya login real todavía).

Sprint 7 — Pulido (responsive, estados vacíos, accesibilidad)
Historias de usuario

Como usuario, quiero que la aplicación se vea bien en mobile y tablet.
Como usuario, quiero estados vacíos y de carga claros, no pantallas en blanco.
Prompts

Revisá las 9 pantallas en viewport mobile (375px) y tablet (768px).
Corregí overflow horizontal, tamaños de touch target menores a 44px, y
tablas que no tengan scroll horizontal contenido. No cambies el layout de
desktop.
Agregá EmptyState a cada listado (ventas, productos, clientes, equipo)
para el caso de cero resultados de búsqueda, y un estado de carga
simulado (skeleton) de 300-500ms al cambiar de sección, preparando el
terreno para cuando esas cargas sean llamadas a una API real.
Pasá un chequeo de accesibilidad básico: todos los botones con solo ícono
necesitan aria-label, los modales deben atrapar el foco y cerrarse con
Escape, y el contraste de texto sobre fondo debe cumplir AA en ambos
modos. Corregí lo que encuentres.
Definition of Done del MVP frontend completo (fin de Fase 1): las 9 pantallas funcionan de punta a punta con mock data, el flujo de venta está testeado, y el producto se ve consistente en mobile, tablet y desktop, en ambos modos de color. Este es el punto en el que corresponde volver a la Fase 0 de validación con dueños reales antes de invertir en el backend.

Sprint 8 en adelante — Fase 2: Backend real
Estos sprints dependen de decisiones que todavía no se tomaron (proveedor de hosting de base de datos, proveedor de facturación electrónica), así que se detallan a nivel de objetivo en vez de prompt exacto — conviene volver a esta guía y precisarlos cuando llegue el momento.

Sprint 8 — Backend y base de datos

Inicializá Prisma en el proyecto usando docs/schema.prisma como punto de
partida. Configurá una base PostgreSQL de desarrollo (local con Docker
Compose). Corré la primera migración y escribí un seed script
(prisma/seed.ts) que cargue exactamente los mismos datos mock que ya
existen en src/data/mock/, para poder comparar frontend-con-mock contra
frontend-con-API con los mismos números.
Sprint 9 — API y reemplazo de mocks

Creá los endpoints REST mínimos (Next.js Route Handlers o Express, según
lo que ya se haya decidido): negocio activo, productos, clientes, ventas
(crear + listar), stock, facturación, equipo. La función confirmSale() del
Sprint 5 se convierte acá en una transacción de Prisma (Sale + SaleItem +
StockMovement + update de Customer + Invoice + ActivityLog) — reutilizá su
misma lógica de negocio, no la reescribas desde cero.
Sprint 10 — Autenticación y multi-tenant real

Implementá sesiones reales (NextAuth o similar), Membership real
conectando User↔Business con los 7 permisos, e invitaciones funcionales
por email. Cada request a la API debe resolver el negocio activo desde la
sesión, nunca confiar en un businessId que venga del cliente.
Sprint 11 — Facturación electrónica real

Integrar un proveedor externo de facturación electrónica (a definir) en
el flujo de confirmSale(), de modo que el Invoice generado sea válido
ante ARCA en vez de un mock. Este sprint es el que más impacta la
posibilidad de vender el producto — no debería quedar para el final del
proyecto.
Checklist de buenas prácticas para repetir en cada sprint
 ¿El prompt describe una sola historia de usuario chica?
 ¿Revisaste el diff completo antes de aceptar?
 ¿La lógica de negocio (cálculos, reglas de permisos) vive en lib/, no mezclada dentro del JSX?
 ¿Committeaste con un mensaje de Conventional Commits?
 ¿Comparaste visualmente contra docs/mockup-reference.jsx antes de dar el sprint por cerrado?
 ¿Actualizaste este documento si el alcance de un sprint cambió?