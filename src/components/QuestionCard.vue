<script setup>
import { computed, ref, onMounted } from "vue";
import { marked } from "marked";
import {
    Brain,
    MessageCircle,
    Dna,
    Lightbulb,
    SplitSquareHorizontal,
    Heart,
    Swords,
    Sparkles,
    BookOpen,
    Lock,
    Unlock,
    Volume2,
    Star,
    User,
    Activity,
    Users,
    Zap,
    Languages,
    Shuffle,
    Scroll,
    Search,
    PenTool,
    UserCheck,
    Coffee,
    GitMerge,
    Map,
    Eye,
    Target,
} from "lucide-vue-next";

const props = defineProps({
    item: Object,
    isRevealed: Boolean,
});

const emit = defineEmits(["toggle"]);
const isBookmarked = ref(false);

const toggleBookmark = (e) => {
    e.stopPropagation();
    isBookmarked.value = !isBookmarked.value;
};

// --- LOGIKA SUARA INDONESIA (FIXED) ---
const speakAnswer = (e) => {
    e.stopPropagation();

    if (!("speechSynthesis" in window)) {
        alert("Yah, browser kamu ga bisa ngomong 🥺");
        return;
    }

    const synth = window.speechSynthesis;
    synth.cancel(); // Stop suara sebelumnya

    // Fungsi untuk mendapatkan suara
    const getIndoVoice = () => {
        const voices = synth.getVoices();
        // 1. Cari suara "Google Bahasa Indonesia" (Android/Chrome)
        let selectedVoice = voices.find(
            (v) => v.name === "Google Bahasa Indonesia",
        );

        // 2. Kalau ga ada, cari "Microsoft Gadis" (Windows)
        if (!selectedVoice)
            selectedVoice = voices.find((v) =>
                v.name.includes("Microsoft Gadis"),
            );

        // 3. Kalau ga ada, cari apapun yang ada label "Indonesia" atau "id-ID"
        if (!selectedVoice)
            selectedVoice = voices.find(
                (v) => v.lang === "id-ID" || v.lang === "id_ID",
            );

        return selectedVoice;
    };

    const speak = () => {
        const voice = getIndoVoice();
        const cleanText = props.item.a.replace(/[*#_]/g, ""); // Bersihkan simbol

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Paksa settingan Indonesia
        utterance.lang = "id-ID";
        if (voice) {
            utterance.voice = voice;
        }

        utterance.rate = 0.9; // Sedikit lambat biar jelas
        utterance.pitch = 1.0; // Nada normal

        synth.speak(utterance);
    };

    // Chrome kadang butuh waktu muat suara
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = speak;
    } else {
        speak();
    }
};

// Icon Mapping
const iconMap = {
    Brain,
    MessageCircle,
    Dna,
    Lightbulb,
    SplitSquareHorizontal,
    Heart,
    Swords,
    Sparkles,
    BookOpen,
    User,
    Activity,
    Users,
    Zap,
    Languages,
    Shuffle,
    Scroll,
    Search,
    PenTool,
    UserCheck,
    Coffee,
    GitMerge,
    Map,
    Eye,
    Target,
};

const parsedAnswer = computed(() => marked.parse(props.item.a));
</script>

<template>
    <div
        class="relative bg-cozy-card rounded-2xl shadow-soft border border-cozy-border hover:border-cozy-primary/50 transition-all duration-300 overflow-hidden cursor-pointer group hover:-translate-y-1"
        @click="$emit('toggle', item.id)"
    >
        <div
            class="absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-500 ease-in-out"
            :class="
                isRevealed
                    ? 'bg-cozy-primary'
                    : 'bg-cozy-border group-hover:bg-cozy-primary/40'
            "
        ></div>

        <div class="p-5 pl-8 md:p-7 md:pl-10">
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-3">
                    <div
                        class="flex items-center gap-2 px-3 py-1.5 bg-cozy-bg rounded-lg border border-cozy-border transition-colors duration-300"
                    >
                        <component
                            :is="iconMap[item.icon] || Brain"
                            class="w-4 h-4 text-cozy-primary"
                            stroke-width="2.5"
                        />
                        <span
                            class="text-[11px] font-bold text-cozy-muted uppercase tracking-wider"
                        >
                            {{ item.tag }}
                        </span>
                    </div>

                    <button
                        @click="toggleBookmark"
                        class="p-1.5 rounded-full hover:bg-cozy-bg transition-colors group/star"
                    >
                        <Star
                            class="w-4 h-4 transition-all duration-300"
                            :class="
                                isBookmarked
                                    ? 'fill-cozy-accent text-cozy-accent'
                                    : 'text-cozy-border group-hover/star:text-cozy-accent'
                            "
                        />
                    </button>
                </div>

                <span
                    class="text-cozy-muted transition-all duration-300 transform"
                    :class="
                        isRevealed
                            ? 'scale-110 opacity-100 text-cozy-primary'
                            : 'opacity-30 -rotate-12'
                    "
                >
                    <component
                        :is="isRevealed ? Unlock : Lock"
                        class="w-5 h-5"
                    />
                </span>
            </div>

            <h3
                class="font-display text-lg md:text-xl font-bold text-cozy-text mb-2 leading-relaxed transition-colors duration-300"
            >
                {{ item.q }}
            </h3>

            <div
                class="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                :class="isRevealed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            >
                <div class="overflow-hidden">
                    <div
                        class="pt-5 mt-3 border-t border-dashed border-cozy-border relative"
                    >
                        <div
                            class="text-cozy-text/90 leading-relaxed text-sm md:text-base animate-fade-in markdown-body pr-10 transition-colors duration-300"
                            v-html="parsedAnswer"
                        ></div>

                        <button
                            @click="speakAnswer"
                            class="absolute top-5 right-0 p-2 bg-cozy-bg rounded-full text-cozy-primary hover:bg-cozy-primary hover:text-white transition-all shadow-sm active:scale-95 group/voice"
                            title="Bacakan (B.Indo)"
                        >
                            <Volume2
                                class="w-4 h-4 group-hover/voice:animate-pulse"
                            />
                        </button>
                    </div>
                </div>
            </div>

            <div
                v-if="!isRevealed"
                class="mt-4 flex items-center gap-2 text-xs text-cozy-muted font-medium opacity-60 group-hover:opacity-100 transition-opacity"
            >
                <span class="animate-bounce">👇</span> Ketuk untuk lihat jawaban
            </div>
        </div>
    </div>
</template>

<style>
.markdown-body p {
    margin-bottom: 0.75em;
}
.markdown-body p:last-child {
    margin-bottom: 0;
}
.markdown-body strong {
    color: var(--c-primary);
    font-weight: 700;
}
.markdown-body em {
    color: var(--c-secondary);
}
.markdown-body ul {
    list-style-type: disc;
    padding-left: 1.2rem;
    margin-bottom: 0.5rem;
}
.markdown-body li {
    margin-bottom: 0.25rem;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
}
</style>
