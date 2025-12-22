<script setup>
import { computed, ref, inject } from "vue";
import { marked } from "marked";
import { playPop } from "../utils/sound.js";
import {
    Sparkles,
    Star,
    Volume2,
    Brain,
    MessageCircle,
    Dna,
    Lightbulb,
    SplitSquareHorizontal,
    Heart,
    Swords,
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
    EyeOff,
    ChevronDown,
} from "lucide-vue-next";

const props = defineProps({ item: Object, isRevealed: Boolean });
const emit = defineEmits(["toggle"]);
const isBookmarked = ref(false);
const askAi = inject("askAi");

const toggleCard = () => {
    playPop();
    emit("toggle", props.item.id);
};

const toggleBookmark = (e) => {
    e.stopPropagation();
    playPop();
    isBookmarked.value = !isBookmarked.value;
};

const askGemini = (e) => {
    e.stopPropagation();
    if (askAi) askAi(props.item.q);
};

const speakAnswer = (e) => {
    e.stopPropagation();
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(props.item.a.replace(/[*#_]/g, ""));
    u.lang = "id-ID";
    synth.speak(u);
};

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
        class="group relative rounded-[24px] p-6 cursor-pointer border transition-all duration-300 flex flex-col overflow-hidden bg-cozy-card shadow-sm h-full"
        :class="[
            isRevealed
                ? 'bg-white border-cozy-primary/40 shadow-lg ring-1 ring-cozy-primary/10'
                : 'border-transparent hover:border-cozy-border hover:shadow-md',
        ]"
        @click="toggleCard"
    >
        <div class="flex justify-between items-start mb-4 relative z-10">
            <div class="flex items-center gap-3 max-w-[80%]">
                <div
                    class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors duration-300 shadow-sm"
                    :class="
                        isRevealed
                            ? 'bg-cozy-primary text-white'
                            : 'bg-cozy-bg text-cozy-primary group-hover:bg-cozy-primary group-hover:text-white'
                    "
                >
                    <component
                        :is="iconMap[item.icon] || Brain"
                        class="w-5 h-5"
                        stroke-width="2.5"
                    />
                </div>

                <div
                    class="px-2.5 py-1.5 bg-cozy-bg rounded-lg border border-cozy-border/50 h-auto w-full transition-colors duration-300"
                    :class="
                        isRevealed
                            ? 'bg-cozy-primary/5 border-cozy-primary/20'
                            : ''
                    "
                >
                    <p
                        class="text-[10px] font-bold uppercase tracking-wider leading-snug break-words whitespace-normal text-left transition-colors"
                        :class="
                            isRevealed ? 'text-cozy-primary' : 'text-cozy-muted'
                        "
                    >
                        {{ item.tag }}
                    </p>
                </div>
            </div>

            <div
                class="flex gap-1 transition-opacity duration-300 shrink-0"
                :class="
                    isRevealed
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                "
            >
                <button
                    @click="askGemini"
                    class="p-2 rounded-full hover:bg-cozy-bg text-cozy-muted hover:text-cozy-primary transition-all"
                    title="Tanya AI"
                >
                    <Sparkles class="w-4 h-4" />
                </button>
                <button
                    @click="toggleBookmark"
                    class="p-2 rounded-full hover:bg-cozy-bg transition-all"
                    :class="
                        isBookmarked
                            ? 'text-cozy-accent'
                            : 'text-cozy-muted hover:text-cozy-accent'
                    "
                >
                    <Star
                        class="w-4 h-4"
                        :class="{ 'fill-current': isBookmarked }"
                    />
                </button>
            </div>
        </div>

        <div
            class="flex-1 flex flex-col justify-center mb-4 transition-all duration-300"
        >
            <h3
                class="font-display font-bold text-cozy-text leading-snug transition-all duration-300"
                :class="
                    isRevealed
                        ? 'text-lg text-left'
                        : 'text-lg md:text-xl text-center'
                "
            >
                {{ item.q }}
            </h3>
        </div>

        <div
            class="grid transition-[grid-template-rows] duration-300 ease-out"
            :class="isRevealed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
            <div class="overflow-hidden">
                <div
                    class="pt-4 border-t border-dashed border-cozy-border relative"
                >
                    <div
                        class="prose-content text-cozy-text text-sm md:text-base leading-relaxed"
                        v-html="parsedAnswer"
                    ></div>
                    <div class="flex justify-end mt-4">
                        <button
                            @click="speakAnswer"
                            class="flex items-center gap-2 text-xs font-bold text-cozy-primary px-3 py-1.5 rounded-full bg-cozy-bg hover:bg-cozy-primary hover:text-white transition-all"
                        >
                            <Volume2 class="w-3 h-3" /> Dengar
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-auto relative h-6 flex justify-center items-center">
            <div
                class="absolute transition-all duration-300 flex items-center gap-2"
                :class="
                    isRevealed
                        ? 'opacity-0 translate-y-2'
                        : 'opacity-100 translate-y-0'
                "
            >
                <div
                    class="px-3 py-1 rounded-full bg-cozy-bg/50 border border-cozy-border/50 text-[10px] font-bold text-cozy-muted group-hover:text-cozy-primary group-hover:border-cozy-primary/30 transition-all flex items-center gap-1.5"
                >
                    <span>Lihat Jawaban</span>
                    <ChevronDown class="w-3 h-3 opacity-50" />
                </div>
            </div>

            <div
                class="absolute transition-all duration-300 flex items-center gap-2"
                :class="
                    isRevealed
                        ? 'opacity-50 hover:opacity-100 translate-y-0'
                        : 'opacity-0 -translate-y-2'
                "
            >
                <div
                    class="flex items-center gap-2 text-[10px] font-bold text-cozy-muted/70 hover:text-cozy-text uppercase tracking-widest cursor-pointer"
                >
                    <EyeOff class="w-3 h-3" /> Tutup
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.prose-content :deep(strong) {
    color: var(--c-primary);
    font-weight: 700;
}
.prose-content :deep(p) {
    margin-bottom: 0.8em;
}
.prose-content :deep(ul) {
    list-style: disc;
    padding-left: 1.2em;
    margin-bottom: 0.8em;
}
</style>
