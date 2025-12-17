<template>
    <footer
        class="w-full py-8 px-6 mt-12 border-t border-cozy-border/50 bg-cozy-bg text-center relative z-10"
    >
        <div class="max-w-md mx-auto flex flex-col items-center gap-4">
            <p
                class="text-xs font-bold text-cozy-muted/60 tracking-widest uppercase flex items-center gap-1 justify-center"
            >
                ( ˘ ³˘)
                <span
                    class="text-cozy-primary inline-block animate-heartbeat text-sm"
                    >♥</span
                >
                Belajar yang Rajin Ya!
            </p>

            <div
                class="flex items-center gap-2 text-[10px] text-cozy-muted/40 font-bold"
            >
                <span>&copy; {{ new Date().getFullYear() }} Help Aiya.</span>
            </div>
        </div>
    </footer>
</template>

<style scoped>
/* Definisi Animasi Detak Jantung */
@keyframes heartbeat {
    0%,
    100% {
        transform: scale(1);
        opacity: 0.8;
    }
    50% {
        transform: scale(1.3);
        opacity: 1;
        text-shadow: 0 0 10px rgba(230, 142, 142, 0.5);
    }
}

.animate-heartbeat {
    animation: heartbeat 2s infinite ease-in-out; /* Durasi 2 detik agar santai */
}
</style>
