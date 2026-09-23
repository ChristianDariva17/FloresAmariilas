# Flores para ti 🌻 — Dedicatoria Amarilla 3D

[![Live Demo](https://img.shields.io/badge/Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://flores-amarillas-omega-virid.vercel.app/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/es/docs/Web/Progressive_web_apps)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-yellow?style=for-the-badge)](LICENSE)

> Una experiencia interactiva 3D y musical creada para sorprender y dedicar flores amarillas de manera única, emotiva y personalizada.

🔗 **Ver proyecto en vivo**: [flores-amarillas-omega-virid.vercel.app](https://flores-amarillas-omega-virid.vercel.app/)

---

## 🌟 Sobre el Proyecto

Inspirado en la popular tradición de regalar **flores amarillas** cada 21 de septiembre (y en fechas especiales de cariño y amistad), este proyecto reimagina la típica postal o mensaje estático para transformarlo en una **experiencia sensorial completa en la web**:

- 🌻 **Girasoles en 3D en tiempo real**: Modelado e iluminación realista renderizados en el navegador mediante WebGL.
- 💌 **Dedicatorias personalizables**: Permite ingresar el nombre de la persona especial y un mensaje personalizado, codificados directamente en la URL para compartir fácilmente sin necesidad de base de datos.
- 📱 **Generador de QR y Compartir rápido**: Código QR dinámico para escanear entre dispositivos, botón nativo para compartir vía Web Share API y envío directo a WhatsApp.
- 🎵 **Ambiente musical inmersivo**: Reproductor sincronizado con soporte para audio HTML5 y fallbacks (`mp3` / `ogg`).
- ⚡ **PWA (Progressive Web App)**: Instalable en dispositivos móviles y de escritorio, optimizada con Service Worker para tiempos de carga ultrarrápidos y acceso sin conexión.

---

## 🛠️ Stack Tecnológico

El proyecto está construido priorizando el máximo rendimiento, sin frameworks pesados, aprovechando las capacidades nativas modernas de la plataforma web:

### Gráficos 3D & Renderizado WebGL
- **[Three.js](https://threejs.org/)**: Motor gráfico para la escena 3D, cámaras, iluminación PBR y renderizado interactivo.
- **Modelos GLTF / GLB adaptativos (LOD)**: Diferentes niveles de detalle según el dispositivo:
  - Móviles (`sunflower-mobile.glb`)
  - Pantallas estándar (`sunflower-optimized.glb`)
  - Pantallas de alta resolución (`sunflower.glb`)
- **Compresión KTX2 & Basis Universal**: Carga y descompresión de texturas GPU ultra-ligeras con decodificación Zstandard (`zstddec`).
- **Materiales PBR & RoomEnvironment**: Iluminación ambiental y reflejos realistas en pétalos y tallos.

### Frontend & Experiencia de Usuario
- **HTML5 Semántico**: Accesibilidad (`aria-*`), metadatos Open Graph, Twitter Cards y SEO básico.
- **CSS3 Moderno**: Variables CSS (Custom Properties), efectos de *glassmorphism*, diseño responsivo mobile-first y micro-animaciones fluidas.
- **Vanilla JavaScript (ES Modules)**: Arquitectura limpia y modular sin dependencias de frameworks externos.

### APIs Web & Capacidades Nativas
- **Web Share API & Clipboard API**: Para compartir el enlace o copiarlo en un clic.
- **Canvas API**: Renderizado y descarga de tarjetas digitales personalizadas.
- **QR Code Generator (`qrcode.min.js`)**: Generación de códigos QR vectoriales en el cliente.
- **Service Workers & Cache API**: Soporte offline, precarga de assets críticos y experiencia PWA.

---

## 📂 Estructura del Directorio

```text
├── assets/
│   └── models/              # Modelos 3D (GLB adaptativos para móvil/desktop)
├── css/                     # Hojas de estilo modulares y diseño responsivo
├── img/                     # Iconos, marcas y texturas visuales
├── js/
│   ├── vendor/              # Three.js, loaders (KTX2, GLTF), basis y qrcode
│   ├── interactive-scene.js # Lógica central de la escena 3D y controles
│   └── mov.js               # Gestos táctiles y movimiento de cámara
├── sound/                   # Banda sonora y audios con fallbacks
├── index.html               # Página principal y diálogos de personalización
├── manifest.json            # Manifiesto PWA
└── sw.js                    # Service Worker y estrategias de caché
```

---

## 🚀 Cómo ejecutarlo localmente

Dado que el proyecto carga modelos 3D (`.glb`), módulos JavaScript y archivos de audio, **requiere un servidor web local** para evitar bloqueos por políticas CORS del navegador:

### Opción 1: Con VS Code (Recomendado)
1. Instala la extensión **Live Server**.
2. Haz clic derecho sobre `index.html` y selecciona **"Open with Live Server"**.

### Opción 2: Con Node.js / npx
```bash
npx serve .
# O también:
npx http-server -p 8080
```

### Opción 3: Con Python
```bash
# Python 3
python -m http.server 8000
```

Abre tu navegador en `http://localhost:8000` (o el puerto indicado) y disfruta de la experiencia.

---

## 💖 Dedicatoria

Hecho con dedicación para compartir momentos especiales. ¡Siéntete libre de clonarlo, personalizarlo y dedicárselo a quien más quieras!
