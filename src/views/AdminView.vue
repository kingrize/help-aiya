<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
} from "firebase/firestore";
import {
    LogOut,
    Sparkles,
    Save,
    Trash2,
    BookOpen,
    FileText,
    Layers,
    Loader2,
    Eraser,
    Zap,
    Settings2,
    Check,
    Wand2,
    BatteryCharging,
    Power,
    Cloud,
} from "lucide-vue-next";
import QuestionCard from "../components/QuestionCard.vue";
import ConfirmModal from "../components/ConfirmModal.vue";

const router = useRouter();
const isLoading = ref(false);
const isSaving = ref(false);
const isResetting = ref(false);
const isGeneratingMaterial = ref(false);
const showResetModal = ref(false);

// --- AI CONFIG ---
const currentProvider = ref("gemini");
const selectedKeyIndex = ref(1);
const questionCount = ref(5);
const isAutoKey = ref(true);

// Definisi Provider dengan Batas Key Berbeda
const providers = {
    gemini: {
        name: "Gemini 2.5",
        icon: Sparkles,
        hasMultiKey: true,
        maxKeys: 10,
    },
    groq: { name: "Groq Llama 3", icon: Zap, hasMultiKey: false, maxKeys: 0 },
    aiml: { name: "AIML (GPT-4o)", icon: Cloud, hasMultiKey: true, maxKeys: 5 }, // AIML punya 5 Key
};

// Load API Keys
const apiKeys = {
    gemini: {},
    groq: import.meta.env.VITE_GROQ_API_KEY || "",
    aiml: {},
};

// Load Gemini (1-10)
for (let i = 1; i <= 10; i++)
    apiKeys.gemini[i] =
        import.meta.env[`VITE_GEMINI_API_KEY${i === 1 ? "" : "_" + i}`] || "";
// Load AIML (1-5)
for (let i = 1; i <= 5; i++)
    apiKeys.aiml[i] = import.meta.env[`VITE_AIML_API_KEY_${i}`] || "";

const subjectTitle = ref("");
const rawMaterial = ref("");
const generatedQuestions = ref([]);

// --- AUTO SWITCHER LOGIC (GENERIC) ---
const executeWithAutoKey = async (apiCallFunction) => {
    const providerName = currentProvider.value;

    // GROQ (Single Key)
    if (!providers[providerName].hasMultiKey) {
        return await apiCallFunction(apiKeys.groq);
    }

    // MULTI KEY (GEMINI & AIML)
    let keysToTry = [];
    const max = providers[providerName].maxKeys; // Ambil batas max key (10 atau 5)
    const keysObj = apiKeys[providerName];

    if (isAutoKey.value) {
        // Auto: Coba semua slot yang ada isinya
        for (let i = 1; i <= max; i++) if (keysObj[i]) keysToTry.push(i);
    } else {
        // Manual: Coba slot terpilih saja
        if (keysObj[selectedKeyIndex.value])
            keysToTry.push(selectedKeyIndex.value);
    }

    if (keysToTry.length === 0)
        throw new Error(`Tidak ada API Key ${providerName} tersedia!`);

    let lastError = null;
    for (const index of keysToTry) {
        try {
            // Coba panggil fungsi dengan key ini
            return await apiCallFunction(keysObj[index]);
        } catch (err) {
            console.warn(
                `[${providerName}] Key slot ${index} gagal: ${err.message}`,
            );
            lastError = err;
            // Lanjut ke loop berikutnya...
        }
    }
    throw new Error(
        lastError?.message || `Semua slot energi ${providerName} habis.`,
    );
};

// --- LOGIC ---
const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
};
const openResetModal = () => (showResetModal.value = true);
const confirmResetAction = async () => {
    showResetModal.value = false;
    isResetting.value = true;
    try {
        const querySnapshot = await getDocs(collection(db, "courses"));
        await Promise.all(
            querySnapshot.docs.map((d) => deleteDoc(doc(db, "courses", d.id))),
        );
        alert("✨ Database bersih!");
    } catch (e) {
        alert("Gagal: " + e.message);
    } finally {
        isResetting.value = false;
    }
};

// --- GENERATE MATERI ---
const generateMaterialFromTitle = async () => {
    if (!subjectTitle.value) return alert("Isi Tag dulu!");
    isGeneratingMaterial.value = true;

    const prompt = `Buatkan rangkuman kuliah padat tentang "${subjectTitle.value}". Bahasa Indonesia.`;

    try {
        const resultText = await executeWithAutoKey(async (apiKey) => {
            if (currentProvider.value === "gemini") {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                        }),
                    },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message);
                return data.candidates[0].content.parts[0].text;
            } else if (currentProvider.value === "groq") {
                const res = await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [{ role: "user", content: prompt }],
                        }),
                    },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message);
                return data.choices[0].message.content;
            } else if (currentProvider.value === "aiml") {
                const res = await fetch(
                    "https://api.aimlapi.com/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: "gpt-4o",
                            messages: [{ role: "user", content: prompt }],
                            max_tokens: 1000,
                        }),
                    },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message);
                return data.choices[0].message.content;
            }
        });

        rawMaterial.value = resultText;
    } catch (error) {
        alert("Gagal: " + error.message);
    } finally {
        isGeneratingMaterial.value = false;
    }
};

// --- GENERATE SOAL ---
const generateQuestions = async () => {
    if (!rawMaterial.value || !subjectTitle.value)
        return alert("Isi lengkap dulu!");
    isLoading.value = true;
    generatedQuestions.value = [];

    const prompt = `
        Buat ${questionCount.value} Flashcard dari: "${rawMaterial.value}".
        Output JSON Murni: [{"id":1, "tag":"${subjectTitle.value}", "icon":"Brain", "q":"Tanya", "a":"Jawab"}]
        Pilihan Icon: Brain, MessageCircle, Dna, Lightbulb, Heart, Star, Zap.
    `;

    try {
        const resultText = await executeWithAutoKey(async (apiKey) => {
            if (currentProvider.value === "gemini") {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                        }),
                    },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message);
                return data.candidates[0].content.parts[0].text;
            } else if (currentProvider.value === "groq") {
                const res = await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [{ role: "user", content: prompt }],
                        }),
                    },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message);
                return data.choices[0].message.content;
            } else if (currentProvider.value === "aiml") {
                const res = await fetch(
                    "https://api.aimlapi.com/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: "gpt-4o",
                            messages: [{ role: "user", content: prompt }],
                        }),
                    },
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message);
                return data.choices[0].message.content;
            }
        });

        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        generatedQuestions.value = JSON.parse(cleanJson).map((item, index) => ({
            ...item,
            id: Date.now() + index,
        }));
    } catch (error) {
        alert("Gagal: " + error.message);
    } finally {
        isLoading.value = false;
    }
};

const saveToDatabase = async () => {
    if (generatedQuestions.value.length === 0) return;
    isSaving.value = true;
    try {
        await addDoc(collection(db, "courses"), {
            title: subjectTitle.value,
            createdAt: new Date(),
            questionsList: generatedQuestions.value,
        });
        alert("Berhasil disimpan! 🎉");
        subjectTitle.value = "";
        rawMaterial.value = "";
        generatedQuestions.value = [];
    } catch (error) {
        alert("Gagal menyimpan: " + error.message);
    } finally {
        isSaving.value = false;
    }
};
const removeDraft = (index) => {
    generatedQuestions.value.splice(index, 1);
};
</script>

<template>
    <div class="min-h-screen bg-cozy-bg text-cozy-text p-6 pb-24 font-sans">
        <ConfirmModal
            :isOpen="showResetModal"
            title="Hapus Semua?"
            message="Aksi ini permanen."
            @close="showResetModal = false"
            @confirm="confirmResetAction"
            :isDanger="true"
        />

        <header
            class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 pt-4 gap-4"
        >
            <div>
                <h1 class="font-display text-2xl font-bold">Admin Dashboard</h1>
                <p class="text-sm text-cozy-muted">AI Content Generator</p>
            </div>
            <div class="flex gap-3">
                <button
                    @click="openResetModal"
                    :disabled="isResetting"
                    class="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                >
                    <span v-if="isResetting"
                        ><Loader2 class="w-4 h-4 animate-spin" /></span
                    ><span v-else class="flex items-center gap-2"
                        ><Eraser class="w-4 h-4" /> Reset DB</span
                    >
                </button>
                <button
                    @click="handleLogout"
                    class="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-cozy-border text-xs font-bold text-cozy-muted hover:bg-cozy-card transition-all shadow-sm"
                >
                    <LogOut class="w-4 h-4" /> Keluar
                </button>
            </div>
        </header>

        <main class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section class="space-y-6">
                <div
                    class="bg-cozy-card p-6 rounded-[32px] shadow-sm border border-cozy-border"
                >
                    <div
                        class="flex items-center gap-2 mb-4 text-cozy-primary font-bold text-xs uppercase tracking-widest"
                    >
                        <Settings2 class="w-4 h-4" /> Config AI
                    </div>

                    <div class="grid grid-cols-3 gap-2 mb-4">
                        <button
                            v-for="(prov, key) in providers"
                            :key="key"
                            @click="currentProvider = key"
                            class="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border transition-all active:scale-95 h-20"
                            :class="
                                currentProvider === key
                                    ? 'bg-cozy-primary/10 border-cozy-primary text-cozy-primary ring-1 ring-cozy-primary'
                                    : 'bg-cozy-bg border-cozy-border text-cozy-muted hover:border-cozy-primary/50'
                            "
                        >
                            <component :is="prov.icon" class="w-5 h-5" />
                            <span
                                class="text-[9px] font-bold text-center leading-tight"
                                >{{ prov.name }}</span
                            >
                        </button>
                    </div>

                    <div v-if="providers[currentProvider].hasMultiKey">
                        <div class="flex justify-between items-center mb-2">
                            <span
                                class="text-[10px] font-bold text-cozy-muted uppercase"
                                >Slot Energi</span
                            >
                            <button
                                @click="isAutoKey = !isAutoKey"
                                class="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border"
                                :class="
                                    isAutoKey
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : 'bg-cozy-bg text-cozy-muted'
                                "
                            >
                                <component
                                    :is="isAutoKey ? BatteryCharging : Power"
                                    class="w-3 h-3"
                                />
                                {{ isAutoKey ? "Otomatis" : "Manual" }}
                            </button>
                        </div>

                        <div
                            class="grid grid-cols-5 gap-2"
                            :class="{
                                'opacity-50 pointer-events-none grayscale':
                                    isAutoKey,
                            }"
                        >
                            <button
                                v-for="i in providers[currentProvider].maxKeys"
                                :key="i"
                                @click="selectedKeyIndex = i"
                                class="h-9 rounded-lg flex items-center justify-center text-xs font-bold border transition-all relative overflow-hidden"
                                :class="[
                                    apiKeys[currentProvider][i]
                                        ? selectedKeyIndex === i
                                            ? 'bg-cozy-primary text-white border-cozy-primary'
                                            : 'bg-cozy-bg border-cozy-border text-cozy-text'
                                        : 'bg-cozy-bg/50 border-dashed border-cozy-border text-cozy-muted/30 cursor-not-allowed',
                                ]"
                            >
                                {{ i }}
                            </button>
                        </div>
                        <p
                            v-if="isAutoKey"
                            class="text-[10px] text-green-600 mt-2 text-center font-medium bg-green-50 py-1 rounded-lg"
                        >
                            ⚡ Mode Pintar: Auto-switch Key
                            {{ currentProvider.toUpperCase() }}.
                        </p>
                    </div>
                </div>

                <div
                    class="bg-cozy-card p-6 rounded-[32px] shadow-sm border border-cozy-border sticky top-6"
                >
                    <div
                        class="flex items-center gap-2 mb-4 text-cozy-primary font-bold text-xs uppercase tracking-widest"
                    >
                        <BookOpen class="w-4 h-4" /> Input Materi
                    </div>
                    <div class="mb-4">
                        <label class="text-xs font-bold text-cozy-muted ml-2"
                            >Tag / Kategori</label
                        >
                        <div class="flex gap-2">
                            <div
                                class="flex-1 flex items-center gap-3 px-4 py-3 bg-cozy-bg rounded-2xl border border-cozy-border"
                            >
                                <Layers class="w-5 h-5 text-cozy-muted" /><input
                                    v-model="subjectTitle"
                                    type="text"
                                    placeholder="Contoh: Sejarah"
                                    class="flex-1 bg-transparent outline-none text-sm font-bold text-cozy-text"
                                />
                            </div>
                            <button
                                @click="generateMaterialFromTitle"
                                :disabled="
                                    isGeneratingMaterial || !subjectTitle
                                "
                                class="w-14 flex items-center justify-center bg-cozy-accent text-white rounded-2xl shadow-md hover:bg-yellow-400 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Wand2
                                    v-if="!isGeneratingMaterial"
                                    class="w-6 h-6"
                                /><Loader2
                                    v-else
                                    class="w-6 h-6 animate-spin"
                                />
                            </button>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="text-xs font-bold text-cozy-muted ml-2"
                            >Materi Mentah</label
                        >
                        <textarea
                            v-model="rawMaterial"
                            rows="8"
                            placeholder="Isi materi..."
                            class="w-full p-4 bg-cozy-bg rounded-2xl border border-cozy-border outline-none text-sm leading-relaxed resize-none"
                        ></textarea>
                    </div>
                    <div class="flex items-center justify-between mb-4">
                        <span
                            class="text-xs font-bold text-cozy-muted uppercase"
                            >Jumlah Soal: {{ questionCount }}</span
                        >
                        <input
                            type="range"
                            min="1"
                            max="10"
                            v-model="questionCount"
                            class="w-1/2 h-2 bg-cozy-bg rounded-lg appearance-none cursor-pointer accent-cozy-primary"
                        />
                    </div>
                    <button
                        @click="generateQuestions"
                        :disabled="isLoading || !rawMaterial"
                        class="w-full py-4 rounded-2xl bg-cozy-primary text-white font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex justify-center gap-2"
                    >
                        <span v-if="isLoading" class="flex gap-2"
                            ><Loader2 class="w-5 h-5 animate-spin" />
                            Proses...</span
                        ><span v-else class="flex gap-2"
                            ><Sparkles class="w-5 h-5" /> Buat Soal</span
                        >
                    </button>
                </div>
            </section>

            <section class="space-y-6">
                <div class="flex justify-between px-2">
                    <span
                        class="text-xs font-bold text-cozy-secondary uppercase"
                        >Preview ({{ generatedQuestions.length }})</span
                    >
                    <button
                        v-if="generatedQuestions.length"
                        @click="saveToDatabase"
                        :disabled="isSaving"
                        class="text-xs font-bold text-cozy-primary hover:underline"
                    >
                        {{ isSaving ? "Menyimpan..." : "Simpan Semua" }}
                    </button>
                </div>
                <div v-if="generatedQuestions.length" class="space-y-4 pb-12">
                    <div
                        v-for="(card, index) in generatedQuestions"
                        :key="index"
                        class="relative group"
                    >
                        <button
                            @click="removeDraft(index)"
                            class="absolute -top-2 -right-2 z-10 p-2 bg-white text-red-400 rounded-full shadow-md hover:bg-red-50 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all"
                        >
                            <Trash2 class="w-4 h-4" />
                        </button>
                        <QuestionCard :item="card" :isRevealed="true" />
                    </div>
                    <button
                        @click="saveToDatabase"
                        :disabled="isSaving"
                        class="w-full py-4 rounded-2xl bg-white border-2 border-cozy-border text-cozy-text font-bold hover:border-green-400 hover:text-green-500 transition-all flex justify-center gap-2"
                    >
                        <Save class="w-5 h-5" /> Simpan Database
                    </button>
                </div>
                <div
                    v-else
                    class="h-[400px] flex flex-col items-center justify-center text-center border-2 border-dashed border-cozy-border rounded-[32px] p-8 opacity-50"
                >
                    <Sparkles class="w-12 h-12 text-cozy-muted mb-4" />
                    <p class="text-sm">Siap Membuat Soal</p>
                </div>
            </section>
        </main>
    </div>
</template>
