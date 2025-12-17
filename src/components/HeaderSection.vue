<script setup>
import { computed } from "vue";
import { BrainCircuit } from "lucide-vue-next"; // Logo Icon
import ThemeToggle from "./ThemeToggle.vue";

const greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat Pagi";
    if (h < 15) return "Selamat Siang";
    if (h < 18) return "Selamat Sore";
    return "Selamat Malam";
});
</script>

<template>
    <div class="w-full bg-cozy-bg transition-colors duration-500">
        <div
            class="px-6 md:px-12 pt-6 flex justify-between items-center max-w-6xl mx-auto"
        >
            <div class="flex items-center gap-2">
                <div
                    class="w-8 h-8 bg-cozy-primary/10 rounded-xl flex items-center justify-center text-cozy-primary"
                >
                    <BrainCircuit class="w-5 h-5" />
                </div>
                <span
                    class="font-display font-bold text-lg text-cozy-text tracking-tight"
                    >Aghnia.</span
                >
            </div>

            <ThemeToggle />
        </div>

        <header class="pt-10 pb-8 px-6 md:px-12 max-w-6xl mx-auto">
            <div class="flex flex-col gap-3 animate-fade-in-down">
                <div
                    class="flex items-center gap-2 text-cozy-primary font-bold text-xs tracking-[0.2em] uppercase opacity-80"
                >
                    <span class="w-8 h-[1px] bg-cozy-primary"></span>
                    <span>Ruang Belajar Aghnia</span>
                </div>

                <h1
                    class="font-display text-4xl md:text-6xl font-bold text-cozy-text leading-[1.1] tracking-tight"
                >
                    {{ greeting }},<br />
                    <span class="text-cozy-muted opacity-50 font-medium"
                        >Siap Review Materi?</span
                    >
                </h1>

                <p
                    class="text-cozy-muted text-sm md:text-base max-w-lg leading-relaxed mt-4 border-l-2 border-cozy-primary/30 pl-4"
                >
                    Semoga ini bisa bantu kamu belajar ya!
                </p>
            </div>
        </header>
    </div>
</template>

<style scoped>
@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.animate-fade-in-down {
    animation: fadeInDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
