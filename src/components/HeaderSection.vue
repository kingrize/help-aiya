<script setup>
import { computed } from "vue";
import { Sparkles, HeartHandshake } from "lucide-vue-next";

const greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat Pagi, Aiya! ☀️";
    if (hour < 15) return "Selamat Siang, Semangat! 🍧";
    if (hour < 18) return "Selamat Sore, Cantik! 🍵";
    return "Selamat Malam, Sayang! 🌙";
});
</script>

<template>
    <header
        class="pt-10 pb-6 px-6 relative overflow-hidden text-center transition-colors duration-300"
    >
        <div
            class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10 opacity-60"
        >
            <div
                class="absolute -top-20 -left-20 w-72 h-72 bg-cozy-primary/20 rounded-full blur-3xl mix-blend-multiply animate-pulse"
            ></div>
            <div
                class="absolute top-10 -right-20 w-72 h-72 bg-cozy-accent/20 rounded-full blur-3xl mix-blend-multiply"
            ></div>
        </div>

        <div class="relative space-y-4">
            <div
                class="inline-flex items-center gap-2 bg-cozy-card/90 backdrop-blur-sm px-5 py-2 rounded-full shadow-sm border border-cozy-border hover:scale-105 transition-transform duration-300 cursor-default group"
            >
                <Sparkles
                    class="w-4 h-4 text-cozy-accent group-hover:animate-spin"
                />
                <span
                    class="text-[11px] md:text-xs font-bold tracking-widest text-cozy-primary uppercase"
                >
                    {{ greeting }}
                </span>
            </div>

            <h1
                class="font-display text-3xl md:text-5xl font-bold text-cozy-text tracking-tight transition-colors duration-300"
            >
                Psychology <span class="text-cozy-primary">Review</span>
            </h1>

            <div
                class="flex flex-col items-center justify-center gap-1 text-cozy-muted text-sm md:text-base font-medium max-w-md mx-auto leading-relaxed transition-colors duration-300"
            >
                <p>Belajar pelan-pelan ya, jangan dipaksain.</p>
                <div
                    class="flex items-center gap-1.5 text-cozy-primary font-bold"
                >
                    <HeartHandshake class="w-4 h-4" />
                    <span>Aku bangga banget sama kamu!</span>
                </div>
            </div>
        </div>
    </header>
</template>
