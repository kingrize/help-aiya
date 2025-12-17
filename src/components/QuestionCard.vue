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
        class="group relative bg-cozy-card rounded-[24px] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cozy-primary/5 border border-transparent hover:border-cozy-border cursor-pointer active:scale-[0.99] flex flex-col overflow-hidden"
        @click="toggleCard"
    >
        <div class="flex justify-between items-start mb-4 relative z-10">
            <div class="flex items-start gap-3 max-w-[80%]">
                <div
                    class="w-10 h-10 shrink-0 rounded-xl bg-cozy-bg flex items-center justify-center text-cozy-primary group-hover:bg-cozy-primary group-hover:text-white transition-colors duration-500 shadow-sm mt-0.5"
                >
                    <component
                        :is="iconMap[item.icon] || Brain"
                        class="w-5 h-5"
                        stroke-width="2.5"
                    />
                </div>

                <div
                    class="px-2.5 py-1.5 bg-cozy-bg rounded-lg border border-cozy-border/50 h-auto w-full"
                >
                    <p
                        class="text-[10px] font-bold text-cozy-muted uppercase tracking-wider leading-snug break-words whitespace-normal text-left"
                    >
                        {{ item.tag }}
                    </p>
                </div>
            </div>

            <div
                class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0"
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
            class="flex-1 flex flex-col justify-center transition-all duration-500"
            :class="isRevealed ? 'mb-4' : 'mb-8 py-4'"
        >
            <h3
                class="font-display font-bold text-cozy-text leading-snug group-hover:text-cozy-primary transition-colors text-center"
                :class="
                    isRevealed ? 'text-lg text-left' : 'text-xl md:text-2xl'
                "
            >
                {{ item.q }}
            </h3>
        </div>

        <div
            class="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            :class="isRevealed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
            <div class="overflow-hidden">
                <div
                    class="pt-4 border-t border-dashed border-cozy-border relative"
                >
                    <div
                        class="prose-content text-cozy-text text-base leading-relaxed"
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

        <div v-if="!isRevealed" class="mt-auto flex justify-center">
            <div
                class="flex items-center gap-2 px-4 py-2 rounded-full bg-cozy-bg/50 border border-cozy-border/50 text-xs font-bold text-cozy-muted group-hover:text-cozy-primary group-hover:border-cozy-primary/30 transition-all"
            >
                <Eye class="w-4 h-4" />
                <span>Ketuk untuk lihat jawaban</span>
            </div>
        </div>
        <div
            v-else
            class="mt-auto pt-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-300"
        >
            <div
                class="flex items-center gap-2 text-[10px] font-bold text-cozy-muted/50 uppercase tracking-widest"
            >
                <EyeOff class="w-3 h-3" /> Tutup Kartu
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
