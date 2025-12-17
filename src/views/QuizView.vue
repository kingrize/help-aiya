<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase.js";
import { playPop } from "../utils/sound.js";
import {
    ChevronLeft,
    Brain,
    Trophy,
    CheckCircle,
    XCircle,
    ArrowRight,
    Loader2,
    Zap,
} from "lucide-vue-next";

const router = useRouter();

// --- CONFIG: LOAD ALL KEYS (Client Side) ---
const apiKeys = [];
// Muat VITE_GEMINI_API_KEY utama
if (import.meta.env.VITE_GEMINI_API_KEY)
    apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY);
// Muat kunci cadangan 1-10
for (let i = 1; i <= 10; i++) {
    const key = import.meta.env[`VITE_GEMINI_API_KEY_${i}`];
    if (key) apiKeys.push(key);
}

// --- STATE ---
const gameState = ref("setup");
const topics = ref([]);
const selectedTopic = ref(null);
const quizData = ref([]);
const currentQuestionIndex = ref(0);
const score = ref(0);
const selectedAnswer = ref(null);
const showExplanation = ref(false);
const loadingMessage = ref("Sedang menyiapkan ujian...");
const errorMessage = ref("");

// --- SETUP ---
onMounted(async () => {
    try {
        const q = query(collection(db, "courses"));
        const snapshot = await getDocs(q);
        const tags = new Set();
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.questionsList) {
                data.questionsList.forEach((q) => tags.add(q.tag));
            }
        });
        topics.value = Array.from(tags);
    } catch (e) {
        console.error("Gagal load topik:", e);
    }
});

// --- SMART GENERATOR (CLIENT SIDE - GEMINI 2.5) ---
const startQuiz = async (topic) => {
    selectedTopic.value = topic;
    gameState.value = "loading";
    loadingMessage.value = "Membaca materi...";
    errorMessage.value = "";
    playPop();

    try {
        // 1. Ambil Materi dari Firebase
        const q = query(collection(db, "courses"));
        const snapshot = await getDocs(q);
        let rawContext = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.questionsList) {
                const relevant = data.questionsList.filter(
                    (item) => item.tag === topic,
                );
                relevant.forEach((item) =>
                    rawContext.push(`Q: ${item.q} | A: ${item.a}`),
                );
            }
        });

        if (rawContext.length === 0)
            throw new Error("Materi kosong untuk topik ini.");

        // Randomize & Limit Context
        const contextString = rawContext
            .sort(() => 0.5 - Math.random())
            .slice(0, 15)
            .join("\n");

        const prompt = `
            Bertindaklah sebagai Pembuat Soal Ujian.
            MATERI: ${contextString}
            TUGAS: Buat 5 Soal Pilihan Ganda (Multiple Choice) unik dari materi di atas.
            FORMAT JSON: HANYA Array JSON Valid.
            CONTOH: [{"question": "...", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "..."}]
        `;

        loadingMessage.value = "Meracik soal ujian...";

        // 2. LOGIC AUTO-SWITCH KEY (Client Side)
        let success = false;
        let finalResult = null;

        if (apiKeys.length === 0)
            throw new Error("Tidak ada API Key yang ditemukan di .env!");

        // Loop coba semua key
        for (const [index, key] of apiKeys.entries()) {
            try {
                console.log(`Mencoba Key ke-${index + 1}...`);

                // --- UPDATE: MENGGUNAKAN GEMINI 2.5 FLASH (WAJIB) ---
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                        }),
                    },
                );

                const data = await response.json();

                // Cek jika error quota/limit dari Google
                if (!response.ok) {
                    console.warn(
                        `Key ${index + 1} Error:`,
                        data.error?.message,
                    );
                    throw new Error(data.error?.message || "API Error");
                }

                let textResult = data.candidates[0].content.parts[0].text;

                // --- JSON PARSING ROBUST ---
                // 1. Bersihkan markdown block
                textResult = textResult.replace(/```json|```/g, "").trim();

                // 2. Cari kurung siku pertama '[' dan terakhir ']'
                const firstBracket = textResult.indexOf("[");
                const lastBracket = textResult.lastIndexOf("]");

                if (firstBracket !== -1 && lastBracket !== -1) {
                    const cleanJson = textResult.substring(
                        firstBracket,
                        lastBracket + 1,
                    );
                    finalResult = JSON.parse(cleanJson);
                    success = true;
                    console.log("Berhasil dengan Key ke-", index + 1);
                    break; // Berhasil! Keluar loop
                } else {
                    throw new Error("Format JSON tidak valid");
                }
            } catch (err) {
                console.warn(
                    `Key ke-${index + 1} gagal/limit. Lanjut ke key berikutnya...`,
                );
                // Lanjut loop ke key berikutnya
            }
        }

        if (!success)
            throw new Error(
                "Semua server (API Keys) sibuk atau habis kuota. Coba lagi besok!",
            );

        quizData.value = finalResult;
        gameState.value = "playing";
    } catch (error) {
        console.error(error);
        errorMessage.value = error.message;
        loadingMessage.value = "Gagal memuat soal";
        // Auto reset setelah 4 detik jika gagal
        setTimeout(() => {
            gameState.value = "setup";
        }, 4000);
    }
};

// --- GAMEPLAY ---
const handleAnswer = (index) => {
    if (selectedAnswer.value !== null) return;
    playPop();
    selectedAnswer.value = index;
    if (index === quizData.value[currentQuestionIndex.value].answer)
        score.value += 20;
    showExplanation.value = true;
};

const nextQuestion = () => {
    playPop();
    selectedAnswer.value = null;
    showExplanation.value = false;
    if (currentQuestionIndex.value < quizData.value.length - 1)
        currentQuestionIndex.value++;
    else gameState.value = "result";
};

const retry = () => {
    playPop();
    gameState.value = "setup";
    score.value = 0;
    currentQuestionIndex.value = 0;
    selectedAnswer.value = null;
    showExplanation.value = false;
};
</script>

<template>
    <div
        class="min-h-screen bg-cozy-bg text-cozy-text p-6 flex flex-col items-center justify-center font-sans"
    >
        <div
            v-if="gameState === 'setup'"
            class="w-full max-w-md text-center space-y-8 animate-fade-in-up"
        >
            <div class="relative inline-block">
                <div
                    class="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center shadow-lg border border-cozy-border mx-auto rotate-3"
                >
                    <Brain class="w-12 h-12 text-cozy-primary" />
                </div>
                <div
                    class="absolute -top-2 -right-2 bg-cozy-accent text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce"
                >
                    Ujian!
                </div>
            </div>

            <div>
                <h1 class="font-display text-3xl font-bold text-cozy-text mb-2">
                    Quiz Dadakan
                </h1>
                <p class="text-cozy-muted">Pilih topik untuk diuji oleh AI</p>
            </div>

            <div v-if="topics.length > 0" class="grid grid-cols-2 gap-3">
                <button
                    v-for="topic in topics"
                    :key="topic"
                    @click="startQuiz(topic)"
                    class="p-4 bg-white border border-cozy-border rounded-2xl shadow-sm hover:shadow-md hover:border-cozy-primary hover:text-cozy-primary transition-all active:scale-95 font-bold text-sm"
                >
                    {{ topic }}
                </button>
            </div>
            <div
                v-else
                class="p-6 bg-red-50 text-red-400 rounded-2xl text-sm border border-red-100"
            >
                Belum ada materi. Minta Admin generate dulu!
            </div>
            <button
                @click="router.push('/')"
                class="text-sm font-bold text-cozy-muted hover:text-cozy-primary mt-8 inline-block"
            >
                Kembali ke Home
            </button>
        </div>

        <div
            v-if="gameState === 'loading'"
            class="text-center space-y-4 animate-pulse"
        >
            <Loader2 class="w-12 h-12 text-cozy-primary animate-spin mx-auto" />
            <h3 class="font-bold text-xl text-cozy-text">
                {{ loadingMessage }}
            </h3>
            <p
                v-if="errorMessage"
                class="text-red-500 text-sm font-bold bg-red-50 p-2 rounded-lg max-w-xs mx-auto"
            >
                {{ errorMessage }}
            </p>
            <div
                class="flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full w-fit mx-auto"
            >
                <Zap class="w-3 h-3" /> Auto-Switch Key Active
            </div>
        </div>

        <div v-if="gameState === 'playing'" class="w-full max-w-lg">
            <div
                class="flex justify-between items-center mb-6 text-xs font-bold text-cozy-muted uppercase tracking-widest"
            >
                <span
                    >Soal {{ currentQuestionIndex + 1 }} /
                    {{ quizData.length }}</span
                >
                <span
                    class="bg-cozy-primary/10 text-cozy-primary px-3 py-1 rounded-full"
                    >{{ selectedTopic }}</span
                >
            </div>

            <div
                class="bg-white p-6 md:p-8 rounded-[32px] shadow-lg border border-cozy-border mb-6 relative overflow-hidden"
            >
                <h2
                    class="font-display text-lg md:text-xl font-bold text-cozy-text leading-relaxed mb-6"
                >
                    {{ quizData[currentQuestionIndex].question }}
                </h2>

                <div class="space-y-3">
                    <button
                        v-for="(opt, idx) in quizData[currentQuestionIndex]
                            .options"
                        :key="idx"
                        @click="handleAnswer(idx)"
                        :disabled="selectedAnswer !== null"
                        class="w-full p-4 rounded-xl border-2 text-left text-sm font-medium transition-all relative overflow-hidden flex justify-between items-center"
                        :class="[
                            selectedAnswer === null
                                ? 'border-cozy-border hover:border-cozy-primary/50 hover:bg-cozy-bg'
                                : idx === quizData[currentQuestionIndex].answer
                                  ? 'border-green-400 bg-green-50 text-green-700'
                                  : idx === selectedAnswer
                                    ? 'border-red-400 bg-red-50 text-red-700'
                                    : 'border-gray-100 opacity-50',
                        ]"
                    >
                        <span>{{ opt }}</span>
                        <CheckCircle
                            v-if="
                                selectedAnswer !== null &&
                                idx === quizData[currentQuestionIndex].answer
                            "
                            class="w-5 h-5 text-green-500 shrink-0"
                        />
                        <XCircle
                            v-if="
                                selectedAnswer === idx &&
                                idx !== quizData[currentQuestionIndex].answer
                            "
                            class="w-5 h-5 text-red-500 shrink-0"
                        />
                    </button>
                </div>
            </div>

            <div v-if="showExplanation" class="animate-fade-up">
                <div
                    class="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-4 text-sm text-blue-900 leading-relaxed"
                >
                    <span
                        class="font-bold block mb-1 text-blue-600 uppercase text-xs"
                        >Pembahasan AI</span
                    >
                    {{ quizData[currentQuestionIndex].explanation }}
                </div>
                <button
                    @click="nextQuestion"
                    class="w-full py-4 bg-cozy-primary text-white font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                    {{
                        currentQuestionIndex < quizData.length - 1
                            ? "Soal Selanjutnya"
                            : "Lihat Hasil"
                    }}
                    <ArrowRight class="w-5 h-5" />
                </button>
            </div>
        </div>

        <div
            v-if="gameState === 'result'"
            class="text-center space-y-6 w-full max-w-sm animate-pop-up"
        >
            <div class="relative inline-block">
                <Trophy
                    class="w-24 h-24 text-yellow-400 drop-shadow-sm mx-auto"
                />
                <div
                    class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-cozy-text text-white px-4 py-1 rounded-full text-sm font-bold shadow-md whitespace-nowrap"
                >
                    Skor Kamu
                </div>
            </div>
            <div class="text-6xl font-display font-bold text-cozy-primary">
                {{ score }}
            </div>
            <p class="text-cozy-text font-medium px-4">
                {{
                    score === 100
                        ? "Sempurna! Aiya jenius banget! 脂"
                        : score >= 60
                          ? "Lumayan! Belajar dikit lagi ya 潮"
                          : "Waduh... ayo baca materi lagi! "
                }}
            </p>
            <div class="grid grid-cols-2 gap-3 pt-4">
                <button
                    @click="retry"
                    class="py-3 px-6 rounded-xl border-2 border-cozy-border font-bold text-cozy-muted hover:border-cozy-text hover:text-cozy-text transition-all"
                >
                    Menu Utama
                </button>
                <button
                    @click="startQuiz(selectedTopic)"
                    class="py-3 px-6 rounded-xl bg-cozy-primary text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                >
                    Coba Lagi
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in-up {
    animation: fadeInUp 0.5s ease-out forwards;
}
.animate-pop-up {
    animation: popUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.animate-fade-up {
    animation: fadeInUp 0.4s ease-out forwards;
}
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
@keyframes popUp {
    0% {
        opacity: 0;
        transform: scale(0.9);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
