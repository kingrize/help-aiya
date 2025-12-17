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
    query,
    orderBy,
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
    BrainCircuit,
    Library,
    X,
    Calendar,
    FileQuestion,
} from "lucide-vue-next";
import QuestionCard from "../components/QuestionCard.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useToast } from "../composables/useToast";

const router = useRouter();
const { addToast } = useToast();

// --- STATE UI ---
const isLoading = ref(false);
const isSaving = ref(false);
const isResetting = ref(false);
const isGeneratingMaterial = ref(false);
const showResetModal = ref(false);

const showMaterialsModal = ref(false);
const existingCourses = ref([]);
const isLoadingMaterials = ref(false);

// --- AI CONFIG ---
const currentProvider = ref("gemini");
const selectedKeyIndex = ref(1);
const questionCount = ref(5);
const isAutoKey = ref(true);
const isAutoModel = ref(true);

const providers = {
    gemini: {
        name: "Gemini 2.5",
        icon: Sparkles,
        desc: "Cerdas & Gratis",
        maxKeys: 10,
    },
    groq: { name: "Groq Llama 3", icon: Zap, desc: "Super Cepat", maxKeys: 5 },
    aiml: {
        name: "AIML (GPT-4o)",
        icon: Cloud,
        desc: "Model Premium",
        maxKeys: 5,
    },
};

// --- LOAD API KEYS ---
const apiKeys = { gemini: {}, groq: {}, aiml: {} };
for (let i = 1; i <= 10; i++)
    apiKeys.gemini[i] =
        import.meta.env[`VITE_GEMINI_API_KEY_${i}`] ||
        import.meta.env[`VITE_GEMINI_API_KEY`] ||
        "";
for (let i = 1; i <= 5; i++)
    apiKeys.groq[i] =
        import.meta.env[`VITE_GROQ_API_KEY_${i}`] ||
        import.meta.env[`VITE_GROQ_API_KEY`] ||
        "";
for (let i = 1; i <= 5; i++)
    apiKeys.aiml[i] = import.meta.env[`VITE_AIML_API_KEY_${i}`] || "";

const subjectTitle = ref("");
const rawMaterial = ref("");
const generatedQuestions = ref([]);

// --- HELPER: API CALLER ---
const callProviderApi = async (providerName, apiKey, prompt) => {
    if (providerName === "gemini") {
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
        if (!res.ok) throw new Error(data.error?.message || "Gemini Error");
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === "groq") {
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
        if (!res.ok) throw new Error(data.error?.message || "Groq Error");
        return data.choices?.[0]?.message?.content;
    } else if (providerName === "aiml") {
        const res = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 2000,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "AIML Error");
        return data.choices?.[0]?.message?.content;
    }
};

// --- LOGIC: HYBRID SYSTEM ---
const executeHybridRequest = async (prompt) => {
    let finalResult = null;
    let success = false;
    let providerOrder = [currentProvider.value];
    if (isAutoModel.value) {
        const others = Object.keys(providers).filter(
            (k) => k !== currentProvider.value,
        );
        providerOrder = [...providerOrder, ...others];
    }

    for (const providerName of providerOrder) {
        try {
            let keysToTry = [];
            const max = providers[providerName].maxKeys;

            if (isAutoKey.value) {
                for (let i = 1; i <= max; i++)
                    if (apiKeys[providerName][i])
                        keysToTry.push(apiKeys[providerName][i]);
            } else {
                const selected = apiKeys[providerName][selectedKeyIndex.value];
                if (selected && providerName === currentProvider.value)
                    keysToTry.push(selected);
                else
                    for (let i = 1; i <= max; i++)
                        if (apiKeys[providerName][i])
                            keysToTry.push(apiKeys[providerName][i]);
            }

            if (keysToTry.length === 0) continue;

            for (const apiKey of keysToTry) {
                try {
                    finalResult = await callProviderApi(
                        providerName,
                        apiKey,
                        prompt,
                    );
                    if (finalResult) {
                        success = true;
                        if (providerName !== currentProvider.value)
                            addToast(
                                `⚠️ ${providers[currentProvider.value].name} sibuk, beralih ke ${providers[providerName].name}`,
                                "info",
                            );
                        break;
                    }
                } catch (keyErr) {
                    console.warn(`Key failed`);
                }
            }
            if (success) break;
        } catch (provErr) {
            console.warn(`Provider failed`);
        }
    }
    if (!success) throw new Error("Semua AI sedang sibuk/limit.");
    return finalResult;
};

// --- ACTIONS ---
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
        addToast("Database berhasil dikosongkan!", "success");
    } catch (e) {
        addToast("Gagal reset: " + e.message, "error");
    } finally {
        isResetting.value = false;
    }
};

// --- FEATURE: MANAGE MATERIALS (FIXED UI) ---
const openMaterialsModal = async () => {
    showMaterialsModal.value = true;
    isLoadingMaterials.value = true;
    existingCourses.value = [];
    try {
        const q = query(
            collection(db, "courses"),
            orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        existingCourses.value = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (e) {
        addToast("Gagal ambil data: " + e.message, "error");
    } finally {
        isLoadingMaterials.value = false;
    }
};

const deleteCourse = async (id, title) => {
    if (!confirm(`Yakin hapus "${title}"?`)) return; // Bisa diganti ConfirmModal nanti
    try {
        await deleteDoc(doc(db, "courses", id));
        existingCourses.value = existingCourses.value.filter(
            (c) => c.id !== id,
        );
        addToast(`Materi dihapus.`, "success");
    } catch (e) {
        addToast("Gagal hapus: " + e.message, "error");
    }
};

const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

// --- GENERATORS ---
const generateMaterialFromTitle = async () => {
    if (!subjectTitle.value) return addToast("Isi Tag dulu!", "error");
    isGeneratingMaterial.value = true;
    const prompt = `Buatkan rangkuman kuliah padat tentang "${subjectTitle.value}". Bahasa Indonesia.`;
    try {
        const result = await executeHybridRequest(prompt);
        rawMaterial.value = result;
        addToast("Materi berhasil dibuat!", "success");
    } catch (error) {
        addToast(error.message, "error");
    } finally {
        isGeneratingMaterial.value = false;
    }
};

const generateQuestions = async () => {
    if (!rawMaterial.value || !subjectTitle.value)
        return addToast("Isi lengkap dulu!", "error");
    isLoading.value = true;
    generatedQuestions.value = [];
    const prompt = `
        Bertindaklah sebagai Dosen.
        TUGAS: Buat ${questionCount.value} Flashcard dari: "${rawMaterial.value}".
        OUTPUT JSON MURNI: [{"id":1, "tag":"${subjectTitle.value}", "icon":"Brain", "q":"?", "a":"."}]
        Pilihan Icon: Brain, MessageCircle, Dna, Lightbulb, Heart, Star, Zap.
    `;
    try {
        let result = await executeHybridRequest(prompt);
        result = result.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(result);
        generatedQuestions.value = parsed.map((item, index) => ({
            ...item,
            id: Date.now() + index,
        }));
        addToast(
            `Berhasil membuat ${generatedQuestions.value.length} soal!`,
            "success",
        );
    } catch (error) {
        addToast(error.message, "error");
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
        addToast("Tersimpan ke Database! 🎉", "success");
        subjectTitle.value = "";
        rawMaterial.value = "";
        generatedQuestions.value = [];
    } catch (error) {
        addToast("Gagal menyimpan: " + error.message, "error");
    } finally {
        isSaving.value = false;
    }
};
const removeDraft = (index) => {
    generatedQuestions.value.splice(index, 1);
};
</script>

<template>
    <div
        class="min-h-screen bg-cozy-bg text-cozy-text font-sans pb-24 transition-colors duration-300"
    >
        <ConfirmModal
            :isOpen="showResetModal"
            title="Hapus Semua?"
            message="Aksi ini permanen."
            @close="showResetModal = false"
            @confirm="confirmResetAction"
            :isDanger="true"
        />

        <transition name="fade">
            <div
                v-if="showMaterialsModal"
                class="fixed inset-0 z-[100] flex items-center justify-center p-4"
            >
                <div
                    class="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                    @click="showMaterialsModal = false"
                ></div>

                <div
                    class="bg-cozy-card w-full max-w-2xl max-h-[80vh] rounded-[32px] shadow-2xl border border-cozy-border flex flex-col relative z-10 overflow-hidden animate-in zoom-in-95 duration-200"
                >
                    <div
                        class="p-6 border-b border-cozy-border flex justify-between items-center bg-cozy-bg/50 backdrop-blur-md"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="p-2 bg-cozy-primary/10 rounded-xl text-cozy-primary"
                            >
                                <Library class="w-5 h-5" />
                            </div>
                            <div>
                                <h3 class="font-bold text-lg text-cozy-text">
                                    Materi Tersedia
                                </h3>
                                <p class="text-xs text-cozy-muted">
                                    Kelola data yang ada di website.
                                </p>
                            </div>
                        </div>
                        <button
                            @click="showMaterialsModal = false"
                            class="p-2 rounded-full text-cozy-muted hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <div
                        class="flex-1 overflow-y-auto p-6 space-y-3 bg-cozy-bg"
                    >
                        <div
                            v-if="isLoadingMaterials"
                            class="flex flex-col items-center justify-center py-12"
                        >
                            <Loader2
                                class="w-8 h-8 text-cozy-primary animate-spin mb-2"
                            />
                            <p class="text-xs text-cozy-muted">
                                Mengambil data...
                            </p>
                        </div>

                        <div
                            v-else-if="existingCourses.length > 0"
                            v-for="course in existingCourses"
                            :key="course.id"
                            class="flex items-center justify-between p-4 bg-cozy-card border border-cozy-border rounded-2xl shadow-sm hover:shadow-md transition-all group"
                        >
                            <div class="flex items-center gap-4">
                                <div
                                    class="w-10 h-10 rounded-full bg-cozy-primary/10 flex items-center justify-center text-cozy-primary font-bold text-lg uppercase"
                                >
                                    {{ course.title.charAt(0) }}
                                </div>
                                <div>
                                    <h4
                                        class="font-bold text-cozy-text text-sm"
                                    >
                                        {{ course.title }}
                                    </h4>
                                    <div class="flex items-center gap-3 mt-1">
                                        <span
                                            class="text-[10px] text-cozy-muted flex items-center gap-1"
                                            ><FileQuestion class="w-3 h-3" />
                                            {{
                                                course.questionsList?.length ||
                                                0
                                            }}
                                            Soal</span
                                        >
                                        <span
                                            class="text-[10px] text-cozy-muted flex items-center gap-1"
                                            ><Calendar class="w-3 h-3" />
                                            {{
                                                formatDate(course.createdAt)
                                            }}</span
                                        >
                                    </div>
                                </div>
                            </div>
                            <button
                                @click="deleteCourse(course.id, course.title)"
                                class="p-2 text-cozy-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Hapus materi ini"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>

                        <div
                            v-else
                            class="text-center py-12 opacity-50 text-cozy-muted"
                        >
                            <Library class="w-12 h-12 mx-auto mb-2" />
                            <p class="text-sm font-bold">Database Kosong</p>
                        </div>
                    </div>
                </div>
            </div>
        </transition>

        <header
            class="bg-cozy-card border-b border-cozy-border sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-opacity-95"
        >
            <div
                class="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 bg-cozy-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-cozy-primary/30"
                    >
                        <Settings2 class="w-6 h-6 animate-spin-slow" />
                    </div>
                    <div>
                        <h1
                            class="font-display text-lg font-bold text-cozy-text leading-tight"
                        >
                            Admin Console
                        </h1>
                        <div class="flex items-center gap-2">
                            <span
                                class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                            ></span>
                            <p class="text-xs text-cozy-muted font-medium">
                                System Operational
                            </p>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button
                        @click="openMaterialsModal"
                        class="flex items-center gap-2 px-4 py-2 bg-cozy-bg border border-cozy-border text-cozy-text rounded-xl text-xs font-bold hover:bg-cozy-primary hover:text-white hover:border-cozy-primary transition-all"
                    >
                        <Library class="w-4 h-4" /> Materi Tersedia
                    </button>

                    <button
                        @click="openResetModal"
                        :disabled="isResetting"
                        class="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                    >
                        <Eraser class="w-4 h-4" /> Reset DB
                    </button>

                    <button
                        @click="handleLogout"
                        class="flex items-center gap-2 px-4 py-2 bg-cozy-bg border border-cozy-border text-cozy-text rounded-xl text-xs font-bold hover:bg-cozy-text hover:text-cozy-bg transition-all"
                    >
                        <LogOut class="w-4 h-4" /> Keluar
                    </button>
                </div>
            </div>
        </header>

        <main
            class="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
            <div class="lg:col-span-4 space-y-6">
                <div
                    class="bg-cozy-card border border-cozy-border rounded-[24px] p-6 shadow-sm overflow-hidden relative"
                >
                    <div
                        class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cozy-primary to-cozy-accent"
                    ></div>

                    <div class="flex justify-between items-center mb-6">
                        <h3
                            class="text-sm font-bold text-cozy-text flex items-center gap-2"
                        >
                            <BrainCircuit class="w-4 h-4 text-cozy-primary" />
                            AI Core
                        </h3>
                        <button
                            @click="isAutoModel = !isAutoModel"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all"
                            :class="
                                isAutoModel
                                    ? 'bg-green-100 text-green-700 border-green-200'
                                    : 'bg-cozy-bg text-cozy-muted border-cozy-border'
                            "
                        >
                            <span
                                class="w-1.5 h-1.5 rounded-full"
                                :class="
                                    isAutoModel
                                        ? 'bg-green-500 animate-ping'
                                        : 'bg-gray-400'
                                "
                            ></span>
                            {{ isAutoModel ? "Hybrid ON" : "Hybrid OFF" }}
                        </button>
                    </div>

                    <div class="grid grid-cols-3 gap-2 mb-6">
                        <button
                            v-for="(prov, key) in providers"
                            :key="key"
                            @click="currentProvider = key"
                            class="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 relative"
                            :class="
                                currentProvider === key
                                    ? 'bg-cozy-primary/10 border-cozy-primary text-cozy-primary ring-1 ring-cozy-primary'
                                    : 'bg-cozy-bg border-cozy-border text-cozy-muted hover:border-cozy-primary/50'
                            "
                        >
                            <component :is="prov.icon" class="w-5 h-5 mb-1" />
                            <span class="text-[9px] font-bold">{{
                                prov.name
                            }}</span>
                            <div
                                v-if="currentProvider === key"
                                class="absolute -top-1 -right-1 w-4 h-4 bg-cozy-primary rounded-full flex items-center justify-center border-2 border-white"
                            >
                                <Check class="w-2 h-2 text-white" />
                            </div>
                        </button>
                    </div>

                    <div
                        class="bg-cozy-bg/50 rounded-2xl p-4 border border-cozy-border"
                    >
                        <div class="flex justify-between items-center mb-3">
                            <span
                                class="text-[10px] font-bold text-cozy-muted uppercase flex items-center gap-1"
                                ><Zap class="w-3 h-3" /> Energy Cells</span
                            >
                            <button
                                @click="isAutoKey = !isAutoKey"
                                class="text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
                                :class="
                                    isAutoKey
                                        ? 'bg-cozy-accent/10 text-cozy-accent border-cozy-accent/30'
                                        : 'bg-white text-gray-400 border-gray-200'
                                "
                            >
                                {{ isAutoKey ? "Auto" : "Manual" }}
                            </button>
                        </div>
                        <div
                            class="grid grid-cols-5 gap-2"
                            :class="{
                                'opacity-50 pointer-events-none': isAutoKey,
                            }"
                        >
                            <button
                                v-for="i in providers[currentProvider].maxKeys"
                                :key="i"
                                @click="selectedKeyIndex = i"
                                :disabled="!apiKeys[currentProvider][i]"
                                class="h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all relative overflow-hidden"
                                :class="[
                                    apiKeys[currentProvider][i]
                                        ? selectedKeyIndex === i
                                            ? 'bg-cozy-primary text-white border-cozy-primary'
                                            : 'bg-white border-cozy-border text-cozy-text hover:border-cozy-primary'
                                        : 'bg-gray-100 border-dashed text-gray-300 cursor-not-allowed',
                                ]"
                            >
                                {{ i }}
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    class="bg-cozy-card border border-cozy-border rounded-[24px] p-6 shadow-sm sticky top-24"
                >
                    <h3
                        class="text-sm font-bold text-cozy-text flex items-center gap-2 mb-6"
                    >
                        <BookOpen class="w-4 h-4 text-cozy-accent" /> Content
                        Studio
                    </h3>
                    <div class="space-y-4">
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-1 block ml-1"
                                >Topik / Judul</label
                            >
                            <div class="flex gap-2">
                                <div class="flex-1 relative">
                                    <Layers
                                        class="w-4 h-4 text-cozy-muted absolute left-3 top-3.5"
                                    /><input
                                        v-model="subjectTitle"
                                        type="text"
                                        placeholder="Misal: Psikologi Kognitif"
                                        class="w-full pl-9 pr-4 py-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm font-bold text-cozy-text focus:border-cozy-primary outline-none transition-all"
                                    />
                                </div>
                                <button
                                    @click="generateMaterialFromTitle"
                                    :disabled="
                                        isGeneratingMaterial || !subjectTitle
                                    "
                                    class="w-12 flex items-center justify-center bg-gradient-to-br from-cozy-accent to-yellow-500 text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                                >
                                    <Loader2
                                        v-if="isGeneratingMaterial"
                                        class="w-5 h-5 animate-spin"
                                    /><Wand2 v-else class="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-1 block ml-1"
                                >Materi Sumber</label
                            >
                            <textarea
                                v-model="rawMaterial"
                                rows="10"
                                placeholder="Paste materi kuliah disini..."
                                class="w-full p-4 bg-cozy-bg border border-cozy-border rounded-xl text-xs leading-relaxed text-cozy-text focus:border-cozy-primary outline-none resize-none transition-all"
                            ></textarea>
                        </div>
                        <div
                            class="bg-cozy-bg rounded-xl p-3 border border-cozy-border flex items-center gap-4"
                        >
                            <span
                                class="text-xs font-bold text-cozy-text whitespace-nowrap"
                                >{{ questionCount }} Soal</span
                            >
                            <input
                                type="range"
                                min="1"
                                max="10"
                                v-model="questionCount"
                                class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cozy-primary"
                            />
                        </div>
                        <button
                            @click="generateQuestions"
                            :disabled="isLoading || !rawMaterial"
                            class="w-full py-4 rounded-xl bg-cozy-primary text-white font-bold shadow-lg shadow-cozy-primary/20 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 flex justify-center gap-2 relative overflow-hidden group"
                        >
                            <div
                                class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                            ></div>
                            <span
                                v-if="isLoading"
                                class="flex items-center gap-2"
                                ><Loader2 class="w-5 h-5 animate-spin" /> Sedang
                                Berpikir...</span
                            >
                            <span
                                v-else
                                class="flex items-center gap-2 relative z-10"
                                ><Sparkles class="w-5 h-5" /> Buat Soal
                                Sekarang</span
                            >
                        </button>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-8">
                <div class="flex justify-between items-center mb-4 px-2">
                    <h3
                        class="text-sm font-bold text-cozy-muted uppercase tracking-widest flex items-center gap-2"
                    >
                        <Check class="w-4 h-4" /> Preview Hasil
                        <span
                            class="bg-cozy-bg border border-cozy-border px-2 py-0.5 rounded-md text-cozy-text"
                            >{{ generatedQuestions.length }}</span
                        >
                    </h3>
                    <button
                        v-if="generatedQuestions.length"
                        @click="saveToDatabase"
                        :disabled="isSaving"
                        class="text-xs font-bold text-cozy-primary hover:bg-cozy-primary/10 px-3 py-1.5 rounded-lg transition-all"
                    >
                        {{ isSaving ? "Menyimpan..." : "Simpan Semua" }}
                    </button>
                </div>
                <div
                    v-if="generatedQuestions.length === 0"
                    class="h-[600px] flex flex-col items-center justify-center text-center border-2 border-dashed border-cozy-border rounded-[32px] bg-cozy-bg/30"
                >
                    <div
                        class="w-20 h-20 bg-cozy-card rounded-full flex items-center justify-center mb-4 shadow-sm"
                    >
                        <Sparkles class="w-8 h-8 text-cozy-muted" />
                    </div>
                    <h4 class="font-bold text-cozy-text text-lg">
                        Area Kerja Kosong
                    </h4>
                    <p class="text-xs text-cozy-muted mt-1 max-w-xs">
                        Pilih konfigurasi di sebelah kiri, masukkan materi, lalu
                        klik tombol Generate.
                    </p>
                </div>
                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
                    <div
                        v-for="(card, index) in generatedQuestions"
                        :key="index"
                        class="relative group"
                    >
                        <button
                            @click="removeDraft(index)"
                            class="absolute -top-2 -right-2 z-10 p-2 bg-white text-red-400 rounded-full shadow-md hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300"
                        >
                            <Trash2 class="w-4 h-4" />
                        </button>
                        <QuestionCard
                            :item="card"
                            :isRevealed="true"
                            class="h-full"
                        />
                    </div>
                </div>
                <div
                    v-if="generatedQuestions.length > 0"
                    class="fixed bottom-6 right-6 lg:hidden z-40"
                >
                    <button
                        @click="saveToDatabase"
                        :disabled="isSaving"
                        class="w-14 h-14 bg-cozy-primary text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all"
                    >
                        <Loader2
                            v-if="isSaving"
                            class="w-6 h-6 animate-spin"
                        /><Save v-else class="w-6 h-6" />
                    </button>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.animate-spin-slow {
    animation: spin 4s linear infinite;
}
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
