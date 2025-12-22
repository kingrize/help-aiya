<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import QuestionCard from "../components/QuestionCard.vue";
import {
    ArrowLeft,
    Loader2,
    BookOpen,
    Search,
    FolderOpen,
} from "lucide-vue-next";
import { playPop } from "../utils/sound.js";

const route = useRoute();
const router = useRouter();
const courseId = route.params.id;

const courseData = ref(null);
const questions = ref([]);
const isLoading = ref(true);
const revealedCards = ref(new Set());
const searchQuery = ref("");

onMounted(async () => {
    try {
        const docRef = doc(db, "courses", courseId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            courseData.value = docSnap.data();
            questions.value = courseData.value.questionsList || [];
        } else {
            router.push("/");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        isLoading.value = false;
    }
});

const toggleCard = (id) => {
    const newSet = new Set(revealedCards.value);
    if (newSet.has(id)) newSet.delete(id);
    else {
        newSet.clear(); // Mode fokus: tutup kartu lain saat buka satu
        newSet.add(id);
    }
    revealedCards.value = newSet;
};

const goBack = () => {
    playPop();
    router.push("/");
};

const filteredQuestions = computed(() => {
    if (!searchQuery.value) return questions.value;
    const lower = searchQuery.value.toLowerCase();
    return questions.value.filter(
        (q) =>
            q.q.toLowerCase().includes(lower) ||
            q.a.toLowerCase().includes(lower) ||
            q.tag.toLowerCase().includes(lower),
    );
});
</script>

<template>
    <div class="min-h-screen bg-cozy-bg pb-20 font-sans text-cozy-text">
        <div
            class="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-cozy-border px-4 py-3 md:px-6 md:py-4 flex items-center gap-4 transition-all"
        >
            <button
                @click="goBack"
                class="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors group"
            >
                <ArrowLeft
                    class="w-5 h-5 text-cozy-muted group-hover:text-cozy-primary"
                />
            </button>
            <div class="flex-1 min-w-0">
                <h1
                    class="font-bold text-lg text-cozy-text truncate leading-tight"
                >
                    {{ courseData?.title || "Memuat..." }}
                </h1>
                <p class="text-xs text-cozy-muted truncate" v-if="!isLoading">
                    {{ questions.length }} Kartu Pembelajaran
                </p>
            </div>
            <div class="relative w-32 md:w-48">
                <Search
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cozy-muted"
                />
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Cari..."
                    class="w-full pl-8 pr-3 py-1.5 bg-cozy-bg border border-cozy-border rounded-full text-xs font-bold focus:border-cozy-primary outline-none transition-all"
                />
            </div>
        </div>

        <main class="max-w-5xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
            <div
                v-if="isLoading"
                class="flex flex-col items-center justify-center py-20"
            >
                <Loader2 class="w-8 h-8 text-cozy-primary animate-spin mb-3" />
                <span
                    class="text-xs font-bold text-cozy-muted tracking-widest animate-pulse"
                    >MEMBUKA BUKU...</span
                >
            </div>

            <div v-else-if="questions.length > 0">
                <div
                    v-if="!searchQuery"
                    class="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[24px] border border-blue-100 flex flex-col md:flex-row items-center gap-4 text-center md:text-left"
                >
                    <div
                        class="bg-white p-3 rounded-2xl shadow-sm text-blue-500 shrink-0 rotate-3"
                    >
                        <FolderOpen class="w-8 h-8" />
                    </div>
                    <div class="flex-1">
                        <h2 class="font-bold text-blue-900 text-lg">
                            Ruang Belajar
                        </h2>
                        <p
                            class="text-sm text-blue-700/80 leading-relaxed max-w-xl"
                        >
                            Selamat belajar! Klik kartu untuk melihat jawaban.
                            Gunakan fitur "Tanya AI" jika ada penjelasan yang
                            kurang jelas.
                        </p>
                    </div>
                </div>

                <div
                    v-if="filteredQuestions.length === 0"
                    class="text-center py-12"
                >
                    <p class="text-sm text-cozy-muted">
                        Tidak ditemukan hasil untuk "{{ searchQuery }}"
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    <QuestionCard
                        v-for="q in filteredQuestions"
                        :key="q.id"
                        :item="q"
                        :isRevealed="revealedCards.has(q.id)"
                        @toggle="toggleCard"
                    />
                </div>
            </div>

            <div
                v-else
                class="text-center py-20 text-cozy-muted flex flex-col items-center"
            >
                <BookOpen class="w-12 h-12 mb-3 opacity-20" />
                <p>Materi masih kosong.</p>
            </div>
        </main>
    </div>
</template>
