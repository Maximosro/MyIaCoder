# Guía de Setup — AI Code Manager

Pasos para levantar el proyecto desde `git clone` limpio hasta tenerlo funcionando en desarrollo.

---

## 1. Requisitos previos

### 1.1 Software obligatorio

| Herramienta | Versión mínima | Dónde descargar |
|---|---|---|
| **Node.js** | ≥ 18 (probado con 24.16) | [nodejs.org](https://nodejs.org/) |
| **npm** | ≥ 9 (incluido con Node) | — |
| **Visual Studio Build Tools** | 2022 | [visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) |
| **Git** | cualquiera reciente | [git-scm.com](https://git-scm.com/download/win) |
| **Claude Code CLI** | latest | `npm install -g @anthropic-ai/claude-code` |

### 1.2 Visual Studio Build Tools — ¡importante!

`node-pty` compila código nativo C++ al hacer `npm install`. Sin las Build Tools, el install falla con errores de `node-gyp`.

1. Descargar **Build Tools for Visual Studio 2022**
2. Ejecutar el instalador
3. En la pestaña **Cargas de trabajo**, marcar:
   - ✅ **Desarrollo para el escritorio con C++**
4. En la pestaña **Componentes individuales**, verificar que esté marcado:
   - ✅ **MSVC v143 — VS 2022 C++ x64/x86 build tools**
   - ✅ **Windows 11 SDK** (o Windows 10 SDK)
5. Instalar

### 1.3 Claude Code CLI

```powershell
npm install -g @anthropic-ai/claude-code
```

Verificar instalación:

```powershell
claude --version
```

---

## 2. Clonar e instalar dependencias

```powershell
git clone <url-del-repo>
cd ai-code-manager
npm install
```

Esto instala todas las dependencias listadas en `package.json`, incluyendo:
- React 19, TailwindCSS 4, Vite 6
- Electron 35, electron-builder
- xterm.js 5.x, node-pty

---

## 3. ⚠️ Verificar el binario de Electron

**Este es el paso más frágil en Windows.** El postinstall de `@electron/get` a veces falla silenciosamente: descarga el binario de ~200 MB desde GitHub y puede fallar por timeout, rate-limiting o problemas de red.

### 3.1 Comprobar si el binario se descargó correctamente

```powershell
# Debe existir electron.exe (~200 MB)
ls node_modules/electron/dist/electron.exe

# Debe existir path.txt con el contenido "electron.exe"
cat node_modules/electron/path.txt
```

Si ambos archivos existen, saltá a la sección 4.

### 3.2 Si falta el binario (error: "Electron failed to install correctly")

El síntoma al ejecutar `npm run dev` es:

```
Error: Electron failed to install correctly, please delete node_modules/electron and try installing again
```

**Solución — 3 pasos:**

#### Paso A: Descargar el binario manualmente

Desde la raíz del proyecto, ejecutar en Node:

```powershell
node -e "
const { downloadArtifact } = require('@electron/get');
downloadArtifact({
  version: '35.7.5',
  artifactName: 'electron',
  platform: 'win32',
  arch: 'x64',
}).then(p => console.log('OK:', p)).catch(e => console.error('FAIL:', e.message));
"
```

Esto descarga `electron-v35.7.5-win32-x64.zip` a `%LOCALAPPDATA%\electron\Cache\...`.

> **Nota**: La versión debe coincidir con la del `package.json` (`devDependencies.electron`). Si actualizás Electron, cambiá el número.

#### Paso B: Extraer el zip

```powershell
# Ajustá la ruta del zip según lo que devolvió el paso A
Expand-Archive -Path "$env:LOCALAPPDATA\electron\Cache\*\electron-v35.7.5-win32-x64.zip" -DestinationPath "node_modules\electron\dist" -Force
```

O con `unzip` si tenés Git Bash:

```bash
unzip -o "$LOCALAPPDATA/electron/Cache/"*/electron-v35.7.5-win32-x64.zip -d node_modules/electron/dist/
```

#### Paso C: Crear `path.txt`

```powershell
# SIN salto de línea al final — es crítico
[System.IO.File]::WriteAllText("$PWD\node_modules\electron\path.txt", "electron.exe")
```

O desde Git Bash:

```bash
printf "electron.exe" > node_modules/electron/path.txt
```

> ⚠️ **No uses `echo`** porque agrega `\r\n` y Electron interpreta el salto de línea como parte del path, causando `ENOENT`.

#### Verificar de nuevo

```powershell
ls node_modules/electron/dist/electron.exe   # debe existir
cat node_modules/electron/path.txt            # debe decir "electron.exe" sin espacios ni saltos
```

---

## 4. Arrancar en desarrollo

```powershell
npm run dev
```

Salida esperada:

```
vite v6.4.3 building for development...
VITE v6.4.3 ready in ~300ms
➜ Local:   http://localhost:5173/
✓ preload.js  0.99 kB
✓ main.js     7.14 kB
```

Se abre la ventana de Electron con la app.

---

## 5. Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Vite hot-reload + Electron (desarrollo) |
| `npm run build` | Compila TypeScript + Vite producción |
| `npm run build:electron` | Build completo + .exe instalable (NSIS) |
| `npm run lint` | TypeScript type-check |
| `npm test` | Vitest test suite |

---

## 6. Estructura del proyecto tras instalar

```
ai-code-manager/
├── electron/              # Main process (TypeScript)
│   ├── main.ts
│   ├── preload.ts
│   ├── pty-manager.ts
│   └── services/
├── src/                   # Renderer (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   └── types/
├── public/
├── dist/                  # Build de Vite renderer (generado)
├── dist-electron/         # Build de Vite main+preload (generado)
├── node_modules/          # Dependencias (instalado)
│   └── electron/dist/     # Binario de Electron (descargado)
├── vite.config.ts
├── electron-builder.yml
├── package.json
└── tsconfig.json
```

---

## 7. Problemas comunes

### 7.1 `node-pty` falla al compilar

```
Error: node-gyp rebuild failed
```

**Causa**: Faltan Visual Studio Build Tools.
**Solución**: Instalar Build Tools for VS 2022 (sección 1.2), luego:

```powershell
npm rebuild node-pty
```

### 7.2 `Electron failed to install correctly`

**Causa**: El postinstall no descargó el binario.
**Solución**: Seguir los pasos de la sección 3.2.

### 7.3 `ENOENT: spawn ... electron.exe\n`

**Causa**: `path.txt` tiene un salto de línea al final.
**Solución**: Reescribir `path.txt` con `printf` o `[System.IO.File]::WriteAllText` (sección 3.2, paso C).

### 7.4 La ventana de Electron se abre pero no carga nada

**Causa**: Vite no terminó de compilar el frontend.
**Solución**: Esperar a que aparezca `ready in ... ms` en la terminal. Recargar con `Ctrl+R` en la ventana de Electron.

### 7.5 `npm run dev` funciona pero Electron no abre ventana

**Causa**: El proceso `electron.exe` puede estar siendo bloqueado por antivirus o firewall.
**Solución**: Agregar `node_modules/electron/dist/` a exclusiones del antivirus.
