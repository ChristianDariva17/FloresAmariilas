(() => {
    'use strict';

    const audio = document.getElementById('mainAudio');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const shareDialog = document.getElementById('shareDialog');
    const welcomeStorageKey = 'flores-para-ti-welcome-seen';
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const prefersReducedMotion = () => reducedMotionQuery.matches;

    const playlist = [
        { file: 'sound/FloresAmarillas.mp3', name: 'Flores Amarillas · Floricienta' },
        { file: 'sound/ColorEsperanza.mp3', name: 'Color Esperanza · Diego Torres' },
        { file: 'sound/Sunflower.mp3', name: 'Sunflower · Post Malone & Swae Lee' },
        { file: 'sound/Yellow.mp3', name: 'Yellow · Coldplay' }
    ];

    const quotes = [
        '🌼 La vida es mejor con amigos que se vuelven familia',
        '💛 La amistad verdadera no se trata de ser inseparables, sino de poder estar separados y que nada cambie',
        '✨ Un verdadero amigo es aquel que conoce tus cicatrices y aún así elige quedarse',
        '🌻 La amistad es el único cemento que podrá mantener unido al mundo',
        '💝 Los amigos son la familia que elegimos',
        '🌞 Un amigo fiel es un refugio seguro; el que lo encuentra ha encontrado un tesoro',
        '🎈 Los amigos verdaderos son como las estrellas, no siempre las ves, pero sabes que están ahí',
        '🌸 La amistad duplica las alegrías y divide las angustias por la mitad',
        '💫 Los mejores momentos de la vida se disfrutan mejor cuando se comparten con un amigo',
        '🌺 Un verdadero amigo te conoce tal como eres, te acompaña en tus logros y fallas, y aún así te permite crecer'
    ];

    const state = {
        currentSongIndex: 0,
        isPlaying: false,
        nextFlowerId: 4,
        flowerTimer: null,
        starTimer: null,
        recipient: '',
        message: ''
    };

    const getAll = (selector) => [...document.querySelectorAll(selector)];

    function updatePersonalMessage() {
        const hasMessage = Boolean(state.recipient || state.message);
        const text = [state.recipient ? `Para ${state.recipient}` : '', state.message].filter(Boolean).join(' · ');
        getAll('[data-personal-message]').forEach((element) => {
            element.textContent = text;
            element.hidden = !hasMessage;
        });
    }

    function announce(message) {
        getAll('#statusMessage, [data-share-status]').forEach((element) => {
            element.textContent = message;
        });
    }

    function updateDocumentMeta() {
        const title = state.recipient ? 'Flores para ' + state.recipient + ' 🌻' : 'Flores para ti 🌻';
        const description = state.message || 'Una dedicatoria amarilla para alguien especial.';
        document.title = title;
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
        document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    }

    function hasSeenWelcome() {
        try {
            return window.sessionStorage.getItem(welcomeStorageKey) === 'true';
        } catch (error) {
            return false;
        }
    }

    function markWelcomeAsSeen() {
        try {
            window.sessionStorage.setItem(welcomeStorageKey, 'true');
        } catch (error) {
            // Algunos navegadores bloquean storage en navegación privada.
        }
    }

    function openGift() {
        if (welcomeScreen) welcomeScreen.hidden = true;
        markWelcomeAsSeen();
        const activeVideoClass = window.matchMedia('(max-width: 768px)').matches ? 'hero-video--mobile' : 'hero-video--desktop';
        getAll('.hero-video').forEach((video) => {
            if (video.classList.contains(activeVideoClass)) video.play().catch(() => {});
            else video.pause();
        });
        document.querySelector('[data-action="bloom"]')?.focus();
    }

    function updateCurrentSongName() {
        const currentSong = playlist[state.currentSongIndex];
        getAll('#currentSongName, #mobileCurrentSongName').forEach((element) => {
            element.textContent = currentSong ? `♪ ${currentSong.name}` : '♪';
            element.classList.toggle('playing', state.isPlaying);
        });
    }

    function updatePlayPauseButtons() {
        const label = state.isPlaying ? 'Pausar música' : 'Reproducir música';
        getAll('#playPauseBtn, #mobilePlayPauseBtn').forEach((button) => {
            button.textContent = state.isPlaying ? '⏸️' : '▶️';
            button.setAttribute('aria-label', label);
        });
    }

    async function togglePlayPause() {
        if (!audio) return;

        if (state.isPlaying) {
            audio.pause();
            return;
        }

        try {
            await audio.play();
        } catch (error) {
            state.isPlaying = false;
            updatePlayPauseButtons();
            announce('No se pudo reproducir la música. Probá nuevamente.');
            console.warn('Reproducción bloqueada:', error);
        }
    }

    async function changeSong(direction) {
        if (!audio) return;

        state.currentSongIndex = (state.currentSongIndex + direction + playlist.length) % playlist.length;
        const shouldResume = state.isPlaying;
        audio.pause();
        audio.src = playlist[state.currentSongIndex].file;
        audio.load();
        updateCurrentSongName();

        if (shouldResume) {
            try {
                await audio.play();
            } catch (error) {
                state.isPlaying = false;
                updatePlayPauseButtons();
                console.warn('No se pudo cambiar la canción:', error);
            }
        }
    }

    function classifyQuote(element, quote) {
        element.classList.remove('short-text', 'medium-text', 'long-text');
        element.classList.add(quote.length < 60 ? 'short-text' : quote.length < 120 ? 'medium-text' : 'long-text');
    }

    function changeQuote() {
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        getAll('#quoteDisplay, #mobileQuoteDisplay').forEach((element) => {
            element.textContent = `“${quote}”`;
            classifyQuote(element, quote);
        });
    }

    function createSparkles(flower) {
        if (prefersReducedMotion()) return;

        const rect = flower.getBoundingClientRect();
        const symbols = ['✨', '🌟', '⭐', '💫'];

        for (let index = 0; index < 5; index += 1) {
            window.setTimeout(() => {
                const sparkle = document.createElement('span');
                sparkle.className = 'sparkle';
                sparkle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                sparkle.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 100}px`;
                sparkle.style.top = `${rect.top + rect.height / 2 + (Math.random() - 0.5) * 100}px`;
                sparkle.setAttribute('aria-hidden', 'true');
                document.body.appendChild(sparkle);
                window.setTimeout(() => sparkle.remove(), 2000);
            }, index * 120);
        }
    }

    function flowerMarkup(number) {
        const variant = (number % 3) + 1;
        const lights = Array.from({ length: 8 }, (_, index) => `<div class="flower__light flower__light--${index + 1}"></div>`).join('');
        const leaves = [1, 2, 3, 4, 5, 6].map((index) => `<div class="flower__line__leaf flower__line__leaf--${index}"></div>`).join('');

        return `
            <div class="flower__leafs flower__leafs--${variant}">
                <div class="flower__leaf flower__leaf--1"></div>
                <div class="flower__leaf flower__leaf--2"></div>
                <div class="flower__leaf flower__leaf--3"></div>
                <div class="flower__leaf flower__leaf--4"></div>
                <div class="flower__white-circle"></div>
                ${lights}
            </div>
            <div class="flower__line">${leaves}</div>`;
    }

    function createNewFlower(container) {
        if (!container || container.querySelectorAll('.flower').length >= 9) return;

        const flower = document.createElement('div');
        flower.className = 'flower flower--dynamic new-flower';
        flower.setAttribute('role', 'button');
        flower.setAttribute('tabindex', '0');
        flower.setAttribute('aria-label', 'Tocar este girasol');
        flower.dataset.flowerId = `dynamic-${state.nextFlowerId}`;
        flower.style.left = `${15 + Math.random() * 70}%`;
        flower.style.transform = `rotate(${(Math.random() - 0.5) * 40}deg)`;
        flower.innerHTML = flowerMarkup(state.nextFlowerId);
        container.appendChild(flower);
        state.nextFlowerId += 1;
    }

    function startAutoFlowers() {
        if (prefersReducedMotion() || state.flowerTimer) return;

        state.flowerTimer = window.setInterval(() => {
            createNewFlower(document.getElementById('flowersContainer'));
            createNewFlower(document.getElementById('mobileFlowersContainer'));
        }, 9000);
    }

    function createFallingStar() {
        const container = document.getElementById('fallingStars');
        if (!container || prefersReducedMotion()) return;

        const star = document.createElement('span');
        star.className = `falling-star ${Math.random() > 0.5 ? 'white' : 'yellow'}`;
        star.textContent = ['⭐', '✨', '🌟'][Math.floor(Math.random() * 3)];
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDuration = `${3 + Math.random() * 4}s`;
        star.setAttribute('aria-hidden', 'true');
        container.appendChild(star);
        window.setTimeout(() => star.remove(), 7000);
    }

    function bindFlowerInteractions(container) {
        if (!container || container.dataset.eventsBound === 'true') return;
        container.dataset.eventsBound = 'true';

        container.addEventListener('click', (event) => {
            const flower = event.target.closest('.flower');
            if (flower) createSparkles(flower);
        });

        container.addEventListener('keydown', (event) => {
            const flower = event.target.closest('.flower');
            if (!flower || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            createSparkles(flower);
        });
    }

    function readPersonalizationFromUrl() {
        const params = new URLSearchParams(window.location.search);
        state.recipient = (params.get('para') || '').trim().slice(0, 60);
        state.message = (params.get('mensaje') || '').trim().slice(0, 180);
        updatePersonalMessage();
        updateDocumentMeta();
    }

    function openCustomize() {
        const dialog = document.getElementById('dedicationDialog');
        if (!dialog) return;
        document.getElementById('dedicationName').value = state.recipient;
        document.getElementById('dedicationMessage').value = state.message;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        document.getElementById('dedicationName').focus();
    }

    function closeCustomize() {
        const dialog = document.getElementById('dedicationDialog');
        if (!dialog) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    function applyCustomization(event) {
        event.preventDefault();
        state.recipient = document.getElementById('dedicationName').value.trim().slice(0, 60);
        state.message = document.getElementById('dedicationMessage').value.trim().slice(0, 180);
        const url = new URL(window.location.href);
        state.recipient ? url.searchParams.set('para', state.recipient) : url.searchParams.delete('para');
        state.message ? url.searchParams.set('mensaje', state.message) : url.searchParams.delete('mensaje');
        window.history.replaceState({}, '', url);
        updatePersonalMessage();
        updateDocumentMeta();
        closeCustomize();
        announce(state.recipient ? `Dedicatoria lista para ${state.recipient}.` : 'Dedicatoria personalizada.');
        window.dispatchEvent(new CustomEvent('dedication:applied', {
            detail: { recipient: state.recipient, message: state.message }
        }));
    }

    function getShareData() {
        return {
            title: state.recipient ? 'Flores para ' + state.recipient + ' 🌻' : 'Flores para ti 🌻',
            text: state.message || 'Te comparto una dedicatoria amarilla.',
            url: window.location.href
        };
    }

    function updateSharePreview() {
        const shareData = getShareData();
        const titleElement = document.getElementById('shareCardTitle');
        const messageElement = document.getElementById('shareCardMessage');
        const qrCode = document.getElementById('shareQrCode');
        const status = document.getElementById('shareDialogStatus');

        if (titleElement) titleElement.textContent = state.recipient ? 'Para ' + state.recipient : 'Una dedicatoria para vos';
        if (messageElement) messageElement.textContent = state.message || 'Que nunca falte un motivo para florecer.';
        if (qrCode) {
            qrCode.hidden = navigator.onLine === false;
            qrCode.onerror = () => {
                qrCode.hidden = true;
                const status = document.getElementById('shareDialogStatus');
                if (status) status.textContent = 'El QR necesita conexión. Podés descargar la tarjeta o copiar el enlace.';
            };
            qrCode.onload = () => { qrCode.hidden = false; };
            if (navigator.onLine !== false) {
                qrCode.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=' + encodeURIComponent(shareData.url);
            } else {
                qrCode.removeAttribute('src');
            }
            qrCode.dataset.url = shareData.url;
            qrCode.referrerPolicy = 'no-referrer';
            if (navigator.onLine === false && status) status.textContent = 'Sin conexión: descargá la tarjeta o copiá el enlace para compartirla.';
        }
    }

    function shareViaWhatsApp() {
        const shareData = getShareData();
        const status = document.getElementById('shareDialogStatus');
        const message = `${shareData.text}\n${shareData.url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
        if (status) status.textContent = 'WhatsApp está listo para enviar tu dedicatoria.';
    }

    function drawCardSunflower(context, x, y, scale) {
        context.save();
        context.translate(x, y);
        for (let index = 0; index < 18; index += 1) {
            context.save();
            context.rotate((index / 18) * Math.PI * 2);
            context.fillStyle = index % 2 ? '#f5b72d' : '#ffd95d';
            context.beginPath();
            context.ellipse(0, -105 * scale, 36 * scale, 92 * scale, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
        context.fillStyle = '#4d230e';
        context.beginPath();
        context.arc(0, 0, 58 * scale, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#9c5920';
        for (let index = 0; index < 28; index += 1) {
            const angle = index * 2.39996;
            const radius = (18 + (index % 6) * 6) * scale;
            context.beginPath();
            context.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 4 * scale, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }

    function downloadShareCard() {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const context = canvas.getContext('2d');
        if (!context) return;

        const background = context.createLinearGradient(0, 0, 1200, 630);
        background.addColorStop(0, '#120b04');
        background.addColorStop(0.52, '#3c2108');
        background.addColorStop(1, '#0c0804');
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'rgba(255, 210, 83, 0.12)';
        context.beginPath();
        context.arc(1060, 120, 180, 0, Math.PI * 2);
        context.fill();
        drawCardSunflower(context, 1030, 315, 1.25);

        context.fillStyle = '#ffe48a';
        context.font = '700 30px Georgia, serif';
        context.fillText('FLORES PARA TI', 72, 92);
        context.fillStyle = '#fff7dc';
        context.font = '700 58px Georgia, serif';
        context.fillText(state.recipient ? `Para ${state.recipient}` : 'Una dedicatoria para vos', 72, 185);
        context.fillStyle = 'rgba(255, 247, 220, 0.88)';
        context.font = 'italic 32px Georgia, serif';
        const message = state.message || 'Que nunca falte un motivo para florecer.';
        const words = message.split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach((word) => {
            const next = line ? `${line} ${word}` : word;
            if (context.measureText(next).width > 690 && line) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        });
        if (line) lines.push(line);
        lines.slice(0, 4).forEach((text, index) => context.fillText(text, 72, 270 + index * 46));
        context.fillStyle = 'rgba(255, 228, 138, 0.62)';
        context.font = '600 22px Arial, sans-serif';
        context.fillText('Abrí el enlace y hacé florecer la escena 🌻', 72, 548);

        const status = document.getElementById('shareDialogStatus');
        canvas.toBlob((blob) => {
            if (!blob) {
                if (status) status.textContent = 'No se pudo generar la tarjeta en este navegador.';
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const slug = (state.recipient || 'dedicatoria').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
            link.href = url;
            link.download = `flores-para-${slug || 'dedicatoria'}.png`;
            link.click();
            URL.revokeObjectURL(url);
            if (status) status.textContent = 'Tarjeta descargada. Podés enviarla incluso sin conexión.';
        }, 'image/png');
    }

    function openShareDialog() {
        if (!shareDialog) return;
        updateSharePreview();
        if (typeof shareDialog.showModal === 'function') shareDialog.showModal();
        else shareDialog.setAttribute('open', '');
        shareDialog.querySelector('[data-action="close-share"]')?.focus();
    }

    function closeShareDialog() {
        if (!shareDialog) return;
        if (typeof shareDialog.close === 'function') shareDialog.close();
        else shareDialog.removeAttribute('open');
    }

    async function copyShareLink() {
        const url = window.location.href;
        const status = document.getElementById('shareDialogStatus');
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                if (status) status.textContent = 'Enlace copiado. Ya podés enviarlo por WhatsApp.';
                announce('Enlace copiado.');
            } else if (status) {
                status.textContent = 'Copiá este enlace: ' + url;
            }
        } catch (error) {
            if (status) status.textContent = 'No se pudo copiar automáticamente. Copiá el enlace desde el navegador.';
        }
    }

    async function performShare() {
        const shareData = getShareData();
        const status = document.getElementById('shareDialogStatus');
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                if (status) status.textContent = 'Dedicatoria compartida.';
                announce('Dedicatoria compartida.');
                closeShareDialog();
            } else {
                await copyShareLink();
            }
        } catch (error) {
            if (error.name !== 'AbortError' && status) status.textContent = 'No se pudo compartir. Probá copiando el enlace.';
        }
    }

    function shareExperience() {
        openShareDialog();
    }
    function bindEvents() {
        getAll('[data-action="quote"]').forEach((button) => button.addEventListener('click', changeQuote));
        getAll('[data-action="share"]').forEach((button) => button.addEventListener('click', shareExperience));
        getAll('[data-action="open-gift"]').forEach((button) => button.addEventListener('click', openGift));
        document.querySelector('[data-action="close-share"]')?.addEventListener('click', closeShareDialog);
        document.querySelector('[data-action="share-now"]')?.addEventListener('click', performShare);
        document.querySelector('[data-action="copy-link"]')?.addEventListener('click', copyShareLink);
        document.querySelector('[data-action="share-whatsapp"]')?.addEventListener('click', shareViaWhatsApp);
        document.querySelector('[data-action="download-card"]')?.addEventListener('click', downloadShareCard);
        getAll('[data-action="customize"]').forEach((button) => button.addEventListener('click', openCustomize));
        document.querySelector('[data-action="close-customize"]')?.addEventListener('click', closeCustomize);
        document.getElementById('dedicationForm')?.addEventListener('submit', applyCustomization);
        document.getElementById('playPauseBtn')?.addEventListener('click', togglePlayPause);
        document.getElementById('mobilePlayPauseBtn')?.addEventListener('click', togglePlayPause);
        document.getElementById('prevBtn')?.addEventListener('click', () => changeSong(-1));
        document.getElementById('mobilePrevBtn')?.addEventListener('click', () => changeSong(-1));
        document.getElementById('nextBtn')?.addEventListener('click', () => changeSong(1));
        document.getElementById('mobileNextBtn')?.addEventListener('click', () => changeSong(1));
        bindFlowerInteractions(document.getElementById('flowersContainer'));
        bindFlowerInteractions(document.getElementById('mobileFlowersContainer'));
    }

    function bindAudioState() {
        if (!audio) return;
        audio.addEventListener('play', () => {
            state.isPlaying = true;
            document.body.classList.add('audio-playing');
            updatePlayPauseButtons();
            updateCurrentSongName();
        });
        audio.addEventListener('pause', () => {
            state.isPlaying = false;
            document.body.classList.remove('audio-playing');
            updatePlayPauseButtons();
            updateCurrentSongName();
        });
        audio.addEventListener('ended', () => changeSong(1));
        audio.addEventListener('error', () => {
            document.body.classList.remove('audio-playing');
            announce('La música no está disponible en este momento.');
        });
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker no disponible:', error));
    }

    function init() {
        bindEvents();
        bindAudioState();
        readPersonalizationFromUrl();
        if (welcomeScreen && !hasSeenWelcome()) welcomeScreen.hidden = false;
        updateCurrentSongName();
        updatePlayPauseButtons();
        registerServiceWorker();

        if (!prefersReducedMotion()) {
            window.setTimeout(startAutoFlowers, 12000);
            state.starTimer = window.setInterval(createFallingStar, 2500);
        }
    }

    window.changeQuote = changeQuote;
    window.togglePlayPause = togglePlayPause;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
