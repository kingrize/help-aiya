<script setup>
import { ref, computed, onMounted } from "vue";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase.js";
import HeaderSection from "../components/HeaderSection.vue";
import FooterSection from "../components/FooterSection.vue";
import QuestionCard from "../components/QuestionCard.vue";
import { playPop } from "../utils/sound.js";
import { Loader2, Bot, Search, XCircle } from "lucide-vue-next";

// --- STATE ---
const questions = ref([]);
const revealedCards = ref(new Set());
const selectedTag = ref("Semua");
const searchQuery = ref("");
const isLoading = ref(true);

// --- LOGIC: FETCH DATA ---
onMounted(async () => {
    try {
        isLoading.value = true;
        const q = query(collection(db, "courses"));
        const querySnapshot = await getDocs(q);

        let allQuestions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.questionsList && Array.isArray(data.questionsList)) {
                allQuestions = [...allQuestions, ...data.questionsList];
            }
        });

        questions.value = allQuestions;
    } catch (error) {
        console.error("Gagal mengambil data:", error);
    } finally {
        isLoading.value = false;
    }
});

// --- INTERAKSI ---
const toggleCard = (id) => {
    playPop();
    const newSet = new Set(revealedCards.value);
    if (newSet.has(id)) newSet.delete(id);
    else {
        newSet.clear();
        newSet.add(id);
    }
    revealedCards.value = newSet;
};

const selectFilter = (tag) => {
    playPop();
    selectedTag.value = tag;
    searchQuery.value = "";
};

const clearSearch = () => {
    playPop();
    searchQuery.value = "";
};

const tags = computed(() => [
    "Semua",
    ...new Set(questions.value.map((q) => q.tag)),
]);

const filteredQuestions = computed(() => {
    let result = questions.value;
    if (selectedTag.value !== "Semua") {
        result = result.filter((q) => q.tag === selectedTag.value);
    }
    if (searchQuery.value.trim()) {
        const lowerQ = searchQuery.value.toLowerCase();
        result = result.filter(
            (q) =>
                q.q.toLowerCase().includes(lowerQ) ||
                q.a.toLowerCase().includes(lowerQ) ||
                q.tag.toLowerCase().includes(lowerQ),
        );
    }
    return result;
});
</script>

<template>
    <div
        class="min-h-screen bg-cozy-bg text-cozy-text transition-colors duration-500 pb-20 font-sans"
    >
        <HeaderSection />

        <main class="max-w-6xl mx-auto px-6 md:px-12 relative z-10 pt-4">
            <div
                v-if="!isLoading && questions.length > 0"
                class="sticky top-4 z-30 mb-6"
            >
                <div class="relative group shadow-sm max-w-2xl mx-auto">
                    <div
                        class="absolute inset-y-0 left-4 flex items-center pointer-events-none"
                    >
                        <Search
                            class="w-5 h-5 text-cozy-muted group-focus-within:text-cozy-primary transition-colors"
                        />
                    </div>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Mau belajar apa sekarang?"
                        class="w-full pl-12 pr-10 py-4 bg-cozy-card/90 backdrop-blur-xl border border-cozy-border rounded-2xl text-sm font-bold text-cozy-text placeholder:text-cozy-muted/60 outline-none focus:border-cozy-primary focus:ring-4 focus:ring-cozy-primary/10 transition-all"
                    />
                    <button
                        v-if="searchQuery"
                        @click="clearSearch"
                        class="absolute inset-y-0 right-3 flex items-center justify-center text-cozy-muted hover:text-red-500 transition-colors"
                    >
                        <XCircle class="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div v-if="!isLoading && questions.length > 0" class="mb-8">
                <div
                    class="flex gap-2 overflow-x-auto no-scrollbar snap-x py-1 justify-start md:justify-center px-1"
                >
                    <button
                        v-for="tag in tags"
                        :key="tag"
                        @click="selectFilter(tag)"
                        class="snap-start px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border active:scale-95 whitespace-nowrap"
                        :class="
                            selectedTag === tag
                                ? 'bg-cozy-text text-cozy-bg border-cozy-text shadow-md transform -translate-y-0.5'
                                : 'bg-transparent text-cozy-muted border-transparent hover:bg-cozy-card hover:text-cozy-text'
                        "
                    >
                        {{ tag }}
                    </button>
                </div>
            </div>

            <div
                v-if="isLoading"
                class="flex flex-col items-center justify-center py-24 min-h-[40vh]"
            >
                <div class="relative mb-6">
                    <div
                        class="w-16 h-16 bg-cozy-primary/10 rounded-full flex items-center justify-center animate-pulse"
                    >
                        <Loader2
                            class="w-8 h-8 text-cozy-primary animate-spin"
                        />
                    </div>
                </div>
                <p
                    class="text-xs text-cozy-muted font-bold tracking-widest animate-pulse"
                >
                    MENYIAPKAN MATERI...
                </p>
            </div>

            <div
                v-else-if="filteredQuestions.length > 0"
                class="grid grid-cols-1 md:grid-cols-2 gap-5 pb-12"
            >
                <transition-group name="staggered-fade">
                    <QuestionCard
                        v-for="q in filteredQuestions"
                        :key="q.id"
                        :item="q"
                        :isRevealed="revealedCards.has(q.id)"
                        @toggle="toggleCard"
                    />
                </transition-group>
            </div>

            <div
                v-else
                class="flex flex-col items-center justify-center py-24 min-h-[50vh] text-center"
            >
                <div class="mb-8 relative group cursor-default">
                    <pre
                        class="font-mono text-sm leading-[1.1] text-cozy-primary/60 animate-breathe select-none transition-colors group-hover:text-cozy-primary"
                    >
  /\_/\
 ( o.o )
  > ^ <
                    </pre>
                    <div
                        class="absolute inset-0 bg-cozy-primary/20 blur-3xl rounded-full animate-pulse -z-10 scale-150 opacity-30"
                    ></div>
                </div>
                <h3 class="font-display font-bold text-lg text-cozy-text mb-2">
                    {{ searchQuery ? "Tidak ditemukan." : "Belum ada materi." }}
                </h3>
                <p
                    class="text-xs text-cozy-muted max-w-[250px] mx-auto leading-relaxed"
                >
                    {{
                        searchQuery
                            ? `Coba kata kunci lain selain "${searchQuery}".`
                            : "Kucing penjaga sedang menunggu Admin memasukkan soal baru."
                    }}
                </p>
                <button
                    v-if="searchQuery"
                    @click="clearSearch"
                    class="mt-6 px-6 py-2 bg-cozy-card border border-cozy-border rounded-full text-xs font-bold text-cozy-text hover:border-cozy-primary transition-all"
                >
                    Hapus Pencarian
                </button>
            </div>
        </main>

        <div
            v-if="!isLoading && questions.length > 0"
            class="fixed bottom-24 left-6 z-40 group"
        >
            <router-link to="/quiz" @click="playPop" class="block">
                <div
                    class="w-14 h-14 flex items-center justify-center bg-cozy-card rounded-2xl shadow-xl shadow-cozy-shadow border border-cozy-border hover:scale-110 hover:-rotate-6 hover:border-cozy-primary transition-all duration-300 ease-spring relative overflow-hidden"
                >
                    <div
                        class="absolute inset-0 bg-cozy-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                    <Bot
                        class="w-7 h-7 text-cozy-text group-hover:text-cozy-primary group-hover:animate-wiggle transition-colors relative z-10"
                    />
                    <span
                        class="absolute top-3 right-3 w-2.5 h-2.5 bg-cozy-accent rounded-full border-2 border-cozy-card animate-pulse z-10"
                    ></span>
                </div>
                <div
                    class="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-cozy-text text-cozy-bg text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap shadow-lg pointer-events-none"
                >
                    Ujian Dadakan
                    <div
                        class="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-cozy-text"
                    ></div>
                </div>
            </router-link>
        </div>

        <FooterSection />
    </div>
</template>

<style scoped>
/* Utility Styles */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}
.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.ease-spring {
    transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes wiggle {
    0%,
    100% {
        transform: rotate(0deg);
    }
    25% {
        transform: rotate(-10deg);
    }
    75% {
        transform: rotate(10deg);
    }
}
.animate-wiggle {
    animation: wiggle 0.5s ease-in-out infinite;
}
.staggered-fade-enter-active,
.staggered-fade-leave-active {
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.staggered-fade-enter-from,
.staggered-fade-leave-to {
    opacity: 0;
    transform: translateY(20px);
}
.staggered-fade-move {
    transition: transform 0.5s ease;
}
@keyframes breathe {
    0%,
    100% {
        transform: translateY(0) scale(1);
        opacity: 0.7;
    }
    50% {
        transform: translateY(-4px) scale(1.05);
        opacity: 1;
    }
}
.animate-breathe {
    animation: breathe 3s ease-in-out infinite;
    display: inline-block;
}
</style>
