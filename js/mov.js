
// Variables globales
let audio = document.getElementById('mainAudio');
let lyrics = document.querySelector("#lyrics");
let flowerCounter = 3;
let nextFlowerId = 4;
let currentSongIndex = 0;
let isPlaying = false;
let autoQuoteEnabled = false;
let quoteInterval;
let autoFlowerInterval;

// Lista de canciones con nombres amigables
const playlist = [
    {
        file: "sound/FloresAmarillas.mp3",
        name: "♪ Flores Amarillas - Floricienta"
    },
    {
        file: "sound/ColorEsperanza.mp3",
        name: "♪ Color Esperanza - Diego Torres"
    },
    {
        file: "sound/Sunflower.mp3",
        name: "♪ Sunflower - Post Malone & Swae Lee"
    },
    {
        file: "sound/Yellow.mp3",
        name: "♪ Yellow - Coldplay"
    }
];

// Frases románticas
const romanticQuotes = [
    "🌼 La vida es mejor con amigos que se vuelven familia",
    "💛 La amistad verdadera no se trata de ser inseparables, sino de poder estar separados y que nada cambie",
    "✨ Un verdadero amigo es aquel que conoce tus cicatrices y aún así elige quedarse",
    "🌻 La amistad es el único cemento que podrá mantener unido al mundo",
    "💝 Los amigos son la familia que elegimos",
    "🌞 Un amigo fiel es un refugio seguro; el que lo encuentra ha encontrado un tesoro",
    "🎈 Los amigos verdaderos son como las estrellas, no siempre las ves, pero sabes que están ahí",
    "🌸 La amistad duplica las alegrías y divide las angustias por la mitad",
    "💫 Los mejores momentos de la vida se disfrutan mejor cuando se comparten con un amigo",
    "🌺 Un verdadero amigo es alguien que te conoce tal como eres, comprende dónde has estado, te acompaña en tus logros y fallas, y aún así te permite crecer"
];

// Manejo de audio
function enableAudioPlayback() {
    if (audio) {
        // Intentar reproducir
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("Audio iniciado automáticamente");
                isPlaying = true;
                updateCurrentSongName();
                updatePlayPauseButtons();
            }).catch(error => {
                console.log("Autoplay bloqueado, esperando interacción del usuario");
                isPlaying = false;
                updatePlayPauseButtons();
            });
        }
    }
}

// Actualizar el nombre de la canción actual
function updateCurrentSongName() {
    const songNameElement = document.getElementById('currentSongName');
    const mobileSongNameElement = document.getElementById('mobileCurrentSongName');
    const currentSong = playlist[currentSongIndex];

    if (songNameElement && currentSong) {
        songNameElement.textContent = currentSong.name;
        if (isPlaying) {
            songNameElement.classList.add('playing');
        } else {
            songNameElement.classList.remove('playing');
        }
    }

    if (mobileSongNameElement && currentSong) {
        mobileSongNameElement.textContent = currentSong.name;
        if (isPlaying) {
            mobileSongNameElement.classList.add('playing');
        } else {
            mobileSongNameElement.classList.remove('playing');
        }
    }
}

// Actualizar botones de play/pause
function updatePlayPauseButtons() {
    const playBtn = document.getElementById('playPauseBtn');
    const mobilePlayBtn = document.getElementById('mobilePlayPauseBtn');

    const symbol = isPlaying ? '⏸️' : '▶️';

    if (playBtn) playBtn.textContent = symbol;
    if (mobilePlayBtn) mobilePlayBtn.textContent = symbol;
}

// Toggle play/pause
function togglePlayPause() {
    if (!audio) return;

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                isPlaying = true;
            }).catch(error => {
                console.log("Error al reproducir:", error);
                isPlaying = false;
            });
        }
    }

    updatePlayPauseButtons();
    updateCurrentSongName();
}

// Cambiar canción
function changeSong() {
    const currentSong = playlist[currentSongIndex];
    if (currentSong && audio) {
        audio.src = currentSong.file;
        if (isPlaying) {
            audio.play().catch(error => {
                console.log("Error al cambiar canción:", error);
            });
        }
        updateCurrentSongName();
    }
}

// Siguiente canción
function playNextSong() {
    currentSongIndex = (currentSongIndex + 1) % playlist.length;
    changeSong();
}

// Canción anterior
function playPrevSong() {
    currentSongIndex = currentSongIndex === 0 ? playlist.length - 1 : currentSongIndex - 1;
    changeSong();
}

// Cambiar frase
function changeQuote() {
    const randomIndex = Math.floor(Math.random() * romanticQuotes.length);
    const newQuote = romanticQuotes[randomIndex];

    const quoteElement = document.getElementById('quoteDisplay');
    const mobileQuoteElement = document.getElementById('mobileQuoteDisplay');

    // Actualizar frase desktop
    if (quoteElement) {
        quoteElement.textContent = newQuote;

        // Clasificar por longitud
        quoteElement.className = quoteElement.className.replace(/\b(short|medium|long)-text\b/g, '');
        if (newQuote.length < 60) {
            quoteElement.classList.add('short-text');
        } else if (newQuote.length < 120) {
            quoteElement.classList.add('medium-text');
        } else {
            quoteElement.classList.add('long-text');
        }
    }

    // Actualizar frase móvil
    if (mobileQuoteElement) {
        mobileQuoteElement.textContent = newQuote;

        // Clasificar por longitud
        mobileQuoteElement.className = mobileQuoteElement.className.replace(/\b(short|medium|long)-text\b/g, '');
        if (newQuote.length < 60) {
            mobileQuoteElement.classList.add('short-text');
        } else if (newQuote.length < 120) {
            mobileQuoteElement.classList.add('medium-text');
        } else {
            mobileQuoteElement.classList.add('long-text');
        }
    }
}

// Toggle frases automáticas
function toggleAutoQuote() {
    autoQuoteEnabled = !autoQuoteEnabled;
    const autoBtn = document.getElementById('autoBtn');
    const mobileAutoBtn = document.getElementById('mobileAutoBtn');

    const newText = `Auto: ${autoQuoteEnabled ? 'ON' : 'OFF'}`;

    if (autoBtn) autoBtn.textContent = newText;
    if (mobileAutoBtn) mobileAutoBtn.textContent = newText;

    if (autoQuoteEnabled) {
        quoteInterval = setInterval(changeQuote, 5000); // Cambiar cada 5 segundos
    } else {
        if (quoteInterval) {
            clearInterval(quoteInterval);
            quoteInterval = null;
        }
    }
}

// Crear efecto sparkle
function createSparkles(flower) {
    const rect = flower.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Crear múltiples sparkles
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.textContent = ['✨', '🌟', '⭐', '💫'][Math.floor(Math.random() * 4)];

            // Posición aleatoria alrededor de la flor
            sparkle.style.left = `${centerX + (Math.random() - 0.5) * 100}px`;
            sparkle.style.top = `${centerY + (Math.random() - 0.5) * 100}px`;

            document.body.appendChild(sparkle);

            // Eliminar después de la animación
            setTimeout(() => {
                sparkle.remove();
            }, 2000);
        }, i * 200);
    }
}

// Crear estrella cayendo
function createFallingStar() {
    const star = document.createElement('div');
    star.className = `falling-star ${Math.random() > 0.5 ? 'white' : 'yellow'}`;
    star.textContent = ['⭐', '✨', '🌟'][Math.floor(Math.random() * 3)];

    // Posición aleatoria en la parte superior
    star.style.left = `${Math.random() * 100}%`;
    star.style.animationDuration = `${3 + Math.random() * 4}s`;

    const container = document.getElementById('fallingStars');
    if (container) {
        container.appendChild(star);

        // Eliminar después de la animación
        setTimeout(() => {
            star.remove();
        }, 7000);
    }
}

// Configurar interacciones de flores
function setupFlowerInteractions() {
    const flowers = document.querySelectorAll('.flower');
    flowers.forEach(flower => {
        flower.addEventListener('click', () => {
            createSparkles(flower);
        });

        flower.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                createSparkles(flower);
            }
        });
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar audio
    audio = document.getElementById('mainAudio');

    // Configurar controles de música desktop
    const playBtn = document.getElementById('playPauseBtn');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    if (playBtn) playBtn.addEventListener('click', togglePlayPause);
    if (nextBtn) nextBtn.addEventListener('click', playNextSong);
    if (prevBtn) prevBtn.addEventListener('click', playPrevSong);

    // Configurar controles de música móvil
    const mobilePlayBtn = document.getElementById('mobilePlayPauseBtn');
    const mobileNextBtn = document.getElementById('mobileNextBtn');
    const mobilePrevBtn = document.getElementById('mobilePrevBtn');

    if (mobilePlayBtn) mobilePlayBtn.addEventListener('click', togglePlayPause);
    if (mobileNextBtn) mobileNextBtn.addEventListener('click', playNextSong);
    if (mobilePrevBtn) mobilePrevBtn.addEventListener('click', playPrevSong);

    // Configurar eventos de audio
    if (audio) {
        audio.addEventListener('ended', playNextSong);
        audio.addEventListener('canplay', () => {
            updateCurrentSongName();
        });
    }

    // Configurar interacciones de flores
    setupFlowerInteractions();

    // Intentar habilitar audio automático
    enableAudioPlayback();

    // Crear estrellas cayendo periódicamente
    setInterval(createFallingStar, 2000);

    // Manejar clics en cualquier parte para habilitar audio
    let audioEnabled = false;
    document.addEventListener('click', () => {
        if (!audioEnabled && audio) {
            enableAudioPlayback();
            audioEnabled = true;
        }
    });

    console.log('Flores Para Ti - Inicializado');
});

// Service Worker registration (si existe)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
