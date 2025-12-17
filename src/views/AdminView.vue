<script setup>
import { ref, nextTick, watch, onMounted } from "vue";
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
    Layers,
    Loader2,
    Eraser,
    Zap,
    Settings2,
    Check,
    Wand2,
    Cloud,
    BrainCircuit,
    Library,
    X,
    Calendar,
    FileQuestion,
    UploadCloud,
    FileText,
    ArrowRight,
    Workflow,
    Lock,
    Globe,
    Pencil,
    Home,
    AlertTriangle,
} from "lucide-vue-next";
import QuestionCard from "../components/QuestionCard.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useToast } from "../composables/useToast";

const router = useRouter();
const { addToast } = useToast();

const DRAFT_KEY = "aiya_admin_draft_v2";

// --- STATE UI ---
const isLoading = ref(false);
const isSaving = ref(false);
const isResetting = ref(false);
const isGeneratingMaterial = ref(false);
const showResetModal = ref(false);
const showMaterialsModal = ref(false);
const existingCourses = ref([]);
const isLoadingMaterials = ref(false);
const pdfFile = ref(null);
const pdfFileName = ref("");
const processingStage = ref("");
const previewSection = ref(null);
const isDragging = ref(false);

// --- EDIT STATE ---
const editingIndex = ref(null);
const tempEditData = ref({});

// --- AI CONFIG ---
const currentProvider = ref("gemini");
const selectedKeyIndex = ref(1);
const questionCount = ref(5);
const isAutoKey = ref(true);
const isAutoModel = ref(true);
const generationMode = ref("hard");

const providers = {
    gemini: {
        name: "Gemini 2.5",
        icon: Sparkles,
        desc: "Multimodal (Vision)",
        maxKeys: 10,
    },
    groq: {
        name: "Groq Llama 3",
        icon: Zap,
        desc: "Ultra Fast Inference",
        maxKeys: 5,
    },
    aiml: {
        name: "AIML (GPT-4o)",
        icon: Cloud,
        desc: "Premium Model",
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

// --- AUTO-SAVE & RESTORE ---
onMounted(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
        try {
            const parsed = JSON.parse(savedDraft);
            if (
                parsed.title ||
                parsed.material ||
                (parsed.questions && parsed.questions.length > 0)
            ) {
                subjectTitle.value = parsed.title || "";
                rawMaterial.value = parsed.material || "";
                generatedQuestions.value = parsed.questions || [];

                if (generatedQuestions.value.length > 0) {
                    addToast("Draft Restored! 📂", "info");
                    nextTick(() => {
                        if (previewSection.value)
                            previewSection.value.scrollIntoView({
                                behavior: "smooth",
                            });
                    });
                }
            }
        } catch (e) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }
});

watch(
    [subjectTitle, rawMaterial, generatedQuestions],
    () => {
        if (
            !subjectTitle.value &&
            !rawMaterial.value &&
            generatedQuestions.value.length === 0
        )
            return;
        const draftData = {
            title: subjectTitle.value,
            material: rawMaterial.value,
            questions: generatedQuestions.value,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    },
    { deep: true },
);

const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
};

// --- HELPER: FILE ---
const handleFileUpload = (event) => {
    processFile(event.target.files[0]);
};
const onDragOver = (e) => {
    e.preventDefault();
    isDragging.value = true;
};
const onDragLeave = (e) => {
    e.preventDefault();
    isDragging.value = false;
};
const onDrop = (e) => {
    e.preventDefault();
    isDragging.value = false;
    processFile(e.dataTransfer.files[0]);
};

const processFile = (file) => {
    if (file) {
        if (file.type !== "application/pdf") {
            addToast("PDF Only!", "error");
            return;
        }
        pdfFile.value = file;
        pdfFileName.value = file.name;
        if (!subjectTitle.value) {
            subjectTitle.value = file.name
                .replace(/\.pdf$/i, "")
                .replace(/[-_]/g, " ");
        }
        addToast("PDF Ready!", "success");
    }
};

const fileToGenerativePart = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(",")[1];
            resolve({
                inlineData: { data: base64String, mimeType: file.type },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// --- HELPER: API CALLER ---
const callProviderApi = async (
    providerName,
    apiKey,
    prompt,
    filePart = null,
) => {
    if (providerName === "gemini") {
        const parts = [{ text: prompt }];
        if (filePart) parts.push(filePart);
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: parts }] }),
            },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Gemini Error");
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (providerName === "groq") {
        if (filePart) throw new Error("Groq doesn't support PDF.");
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
        if (filePart) throw new Error("AIML doesn't support PDF.");
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

const tryProviderWithRotation = async (
    providerName,
    prompt,
    filePart = null,
) => {
    let keysToTry = [];
    const max = providers[providerName].maxKeys;
    if (isAutoKey.value) {
        for (let i = 1; i <= max; i++)
            if (apiKeys[providerName][i])
                keysToTry.push(apiKeys[providerName][i]);
    } else {
        const selected = apiKeys[providerName][selectedKeyIndex.value];
        if (selected) keysToTry.push(selected);
        else
            for (let i = 1; i <= max; i++)
                if (apiKeys[providerName][i])
                    keysToTry.push(apiKeys[providerName][i]);
    }
    if (keysToTry.length === 0)
        throw new Error(`No API Keys for ${providerName}`);
    for (const apiKey of keysToTry) {
        try {
            const result = await callProviderApi(
                providerName,
                apiKey,
                prompt,
                filePart,
            );
            if (result) return result;
        } catch (err) {
            console.warn(`[${providerName}] Key failed, rotating...`);
        }
    }
    throw new Error(`All keys exhausted for ${providerName}.`);
};

// --- CORE LOGIC ---
const generateQuestions = async () => {
    if (!subjectTitle.value || (!rawMaterial.value && !pdfFile.value))
        return addToast("Input Data Missing!", "error");
    isLoading.value = true;
    generatedQuestions.value = [];

    try {
        let extractedText = rawMaterial.value;
        let filePart = null;

        // 1. SCAN PDF (Jika ada)
        if (pdfFile.value) {
            processingStage.value = "Gemini Vision: Analyzing PDF...";
            try {
                filePart = await fileToGenerativePart(pdfFile.value);
                if (currentProvider.value !== "gemini") {
                    // Jika pakai Groq, estafet dulu ke Gemini buat baca teksnya
                    const extractionPrompt = `TUGAS: Ekstrak seluruh teks materi kuliah dari PDF ini. OUTPUT: Hanya teks mentah.`;
                    extractedText = await tryProviderWithRotation(
                        "gemini",
                        extractionPrompt,
                        filePart,
                    );
                    addToast(
                        "PDF Extracted! Handing over to " +
                            providers[currentProvider.value].name,
                        "success",
                    );
                    filePart = null;
                }
            } catch (e) {
                throw new Error("PDF Read Failed: " + e.message);
            }
        }

        // 2. GENERATE SOAL (PROMPT BAHASA INDONESIA)
        processingStage.value = `${providers[currentProvider.value].name}: Thinking Process...`;

        // LOGIC MODE: Strict (Fokus) vs Smart (Kreatif)
        let constraint = "";
        if (generationMode.value === "hard") {
            constraint = `
            ATURAN MODE FOKUS (STRICT):
            - Pertanyaan dan Jawaban WAJIB 100% berdasarkan materi sumber yang diberikan.
            - JANGAN menambah fakta dari luar materi.
            - Pada field "source", sebutkan spesifik bagian mana di materi (contoh: "Slide Halaman 2", "Paragraf 1").
            `;
        } else {
            constraint = `
            ATURAN MODE KREATIF (SMART):
            - Gunakan materi sumber sebagai pondasi utama.
            - Anda DIHARUSKAN menggunakan pengetahuan umum Anda untuk menjelaskan konsep yang sulit agar lebih mudah dimengerti (seperti dosen menjelaskan ke mahasiswa).
            - Berikan contoh nyata atau analogi jika perlu.
            - Pada field "source", tulis "Penjelasan Tambahan AI" atau "Konteks Materi".
            `;
        }

        // PROMPT UTAMA (STRICT INDONESIA, UI PROMPT ENGLISH)
        const finalPrompt = `
            BERPERANLAH SEBAGAI: Dosen Pembimbing Akademik yang Cerdas & Peduli.
            TOPIK: "${subjectTitle.value}"

            INSTRUKSI UTAMA:
            Semua Output (Pertanyaan, Jawaban, Tag) WAJIB dalam BAHASA INDONESIA yang natural, akademis namun mudah dipahami mahasiswa.

            TUGAS 1 (SMART TAGGING):
            Analisis TOPIK. Buat "tag" yang SANGAT RINGKAS & CATCHY (Maks 3 kata).
            Contoh: "Psikologi Anak", "Sejarah RI".

            TUGAS 2 (KONTEN FLASHCARD):
            Pelajari materi yang diberikan dengan teliti.
            Buatlah ${questionCount.value} Soal Flashcard (Tanya Jawab).

            ${constraint}

            FORMAT OUTPUT (Wajib JSON Array Murni):
            [
              {
                "id": 1,
                "tag": "...",
                "icon": "Brain",
                "q": "Pertanyaan (Bahasa Indonesia)?",
                "a": "Jawaban penjelasan lengkap (Bahasa Indonesia).",
                "source": "Sumber info"
              }
            ]

            Pilihan Icon: Brain, MessageCircle, Dna, Lightbulb, Heart, Star, Zap.

            ${filePart ? "SUMBER: DOKUMEN PDF TERLAMPIR" : `SUMBER TEKS:\n"${extractedText}"`}
        `;

        let result = await tryProviderWithRotation(
            currentProvider.value,
            finalPrompt,
            filePart,
        );

        // Cleaning Response
        result = result.replace(/```json|```/g, "").trim();
        const firstBracket = result.indexOf("[");
        const lastBracket = result.lastIndexOf("]");

        if (firstBracket !== -1 && lastBracket !== -1) {
            const cleanJson = result.substring(firstBracket, lastBracket + 1);
            const parsed = JSON.parse(cleanJson);
            generatedQuestions.value = parsed.map((item, index) => ({
                ...item,
                id: Date.now() + index,
                tag: item.tag || subjectTitle.value,
            }));
            addToast(
                `Generated ${generatedQuestions.value.length} Smart Cards!`,
                "success",
            );

            await nextTick();
            if (previewSection.value)
                previewSection.value.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        } else {
            throw new Error("Invalid JSON Format.");
        }
    } catch (error) {
        console.error(error);
        addToast(error.message, "error");
    } finally {
        isLoading.value = false;
        processingStage.value = "";
    }
};

// --- ACTIONS ---
const startEdit = (i) => {
    editingIndex.value = i;
    tempEditData.value = JSON.parse(
        JSON.stringify(generatedQuestions.value[i]),
    );
};
const saveEdit = (i) => {
    generatedQuestions.value[i] = { ...tempEditData.value };
    editingIndex.value = null;
    addToast("Changes Saved!", "success");
};
const cancelEdit = () => {
    editingIndex.value = null;
    tempEditData.value = {};
};

// Generate Summary Material (Textarea Only)
const generateMaterialFromTitle = async () => {
    if (!subjectTitle.value) return addToast("Title Required!", "error");
    isGeneratingMaterial.value = true;
    const prompt = `Bertindaklah sebagai Dosen. Buatkan rangkuman kuliah padat, jelas, dan terstruktur tentang "${subjectTitle.value}". Gunakan Bahasa Indonesia.`;
    try {
        const result = await tryProviderWithRotation(
            currentProvider.value,
            prompt,
        );
        rawMaterial.value = result;
        addToast("Material Generated!", "success");
    } catch (error) {
        addToast(error.message, "error");
    } finally {
        isGeneratingMaterial.value = false;
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
        addToast("Saved to DB! 🎉", "success");
        subjectTitle.value = "";
        rawMaterial.value = "";
        generatedQuestions.value = [];
        pdfFile.value = null;
        pdfFileName.value = "";
        const fileInput = document.getElementById("pdf-upload");
        if (fileInput) fileInput.value = "";
        clearDraft();
    } catch (error) {
        addToast("Save Failed: " + error.message, "error");
    } finally {
        isSaving.value = false;
    }
};
const removeDraft = (i) => {
    generatedQuestions.value.splice(i, 1);
};
const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
};
const openResetModal = () => (showResetModal.value = true);
const confirmResetAction = async () => {
    showResetModal.value = false;
    isResetting.value = true;
    try {
        const q = await getDocs(collection(db, "courses"));
        await Promise.all(
            q.docs.map((d) => deleteDoc(doc(db, "courses", d.id))),
        );
        clearDraft();
        addToast("Database Cleaned.", "success");
    } catch (e) {
        addToast("Reset Failed.", "error");
    } finally {
        isResetting.value = false;
    }
};
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
        addToast("Fetch Error: " + e.message, "error");
    } finally {
        isLoadingMaterials.value = false;
    }
};
const deleteCourse = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
        await deleteDoc(doc(db, "courses", id));
        existingCourses.value = existingCourses.value.filter(
            (c) => c.id !== id,
        );
        addToast(`Deleted.`, "success");
    } catch (e) {
        addToast("Failed.", "error");
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
</script>

<template>
    <div
        class="min-h-screen bg-cozy-bg text-cozy-text font-sans pb-24 transition-colors duration-300"
    >
        <ConfirmModal
            :isOpen="showResetModal"
            title="Wipe All Data?"
            message="This action is permanent."
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
                                    Library
                                </h3>
                                <p class="text-xs text-cozy-muted">
                                    Manage existing content.
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
                                Fetching data...
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
                                            Items</span
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
                                title="Hapus"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                        <div
                            v-else
                            class="text-center py-12 opacity-50 text-cozy-muted"
                        >
                            <Library class="w-12 h-12 mx-auto mb-2" />
                            <p class="text-sm font-bold">Database Empty</p>
                        </div>
                    </div>
                </div>
            </div>
        </transition>

        <header
            class="bg-cozy-card border-b border-cozy-border sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-opacity-95"
        >
            <div
                class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4"
            >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div
                        class="w-10 h-10 bg-cozy-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-cozy-primary/30 shrink-0"
                    >
                        <Settings2 class="w-6 h-6 animate-spin-slow" />
                    </div>
                    <div class="truncate">
                        <h1
                            class="font-display text-lg font-bold text-cozy-text leading-tight"
                        >
                            Admin
                        </h1>
                        <p
                            class="text-xs text-cozy-muted font-medium hidden md:block"
                        >
                            System Operational
                        </p>
                    </div>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button
                        @click="openMaterialsModal"
                        class="flex items-center gap-2 px-3 py-2 md:px-4 bg-cozy-bg border border-cozy-border text-cozy-text rounded-xl text-xs font-bold hover:bg-cozy-primary hover:text-white hover:border-cozy-primary transition-all"
                        title="Perpustakaan"
                    >
                        <Library class="w-4 h-4" />
                        <span class="hidden md:inline">Library</span>
                    </button>
                    <button
                        @click="router.push('/')"
                        class="flex items-center gap-2 px-3 py-2 md:px-4 bg-cozy-bg border border-cozy-border text-cozy-text rounded-xl text-xs font-bold hover:bg-cozy-text hover:text-white transition-all"
                        title="Ke Beranda"
                    >
                        <Home class="w-4 h-4" />
                        <span class="hidden md:inline">Home</span>
                    </button>
                    <button
                        @click="handleLogout"
                        class="flex items-center gap-2 px-3 py-2 md:px-4 bg-cozy-bg border border-cozy-border text-cozy-text rounded-xl text-xs font-bold hover:bg-cozy-text hover:text-cozy-bg transition-all"
                        title="Keluar"
                    >
                        <LogOut class="w-4 h-4" />
                        <span class="hidden md:inline">Exit</span>
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
                            <component
                                :is="prov.icon"
                                class="w-5 h-5 mb-1"
                            /><span class="text-[9px] font-bold">{{
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
                                ><Zap class="w-3 h-3" /> AI Power</span
                            ><button
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

                    <div
                        v-if="pdfFile && currentProvider !== 'gemini'"
                        class="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 animate-in fade-in"
                    >
                        <div
                            class="p-2 bg-blue-100 rounded-full text-blue-600 shadow-sm"
                        >
                            <Workflow class="w-4 h-4" />
                        </div>
                        <div>
                            <p
                                class="text-[10px] font-bold text-blue-700 uppercase tracking-wide"
                            >
                                AI Pipeline Active
                            </p>
                            <p class="text-[10px] text-blue-600 leading-tight">
                                Gemini (Reader) <span class="mx-1">&rarr;</span>
                                {{ providers[currentProvider].name }} (Thinker)
                            </p>
                        </div>
                    </div>

                    <div
                        class="mt-6 pt-4 border-t border-dashed border-cozy-border"
                    >
                        <button
                            @click="openResetModal"
                            :disabled="isResetting"
                            class="w-full py-2 flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-all opacity-70 hover:opacity-100"
                        >
                            <AlertTriangle class="w-4 h-4" /> System Reset
                        </button>
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
                                >Topic / Title</label
                            >
                            <div class="flex gap-2">
                                <div class="flex-1 relative">
                                    <Layers
                                        class="w-4 h-4 text-cozy-muted absolute left-3 top-3.5"
                                    /><input
                                        v-model="subjectTitle"
                                        type="text"
                                        placeholder="Ex: Psikologi Kognitif"
                                        class="w-full pl-9 pr-4 py-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm font-bold text-cozy-text focus:border-cozy-primary outline-none transition-all"
                                    />
                                </div>
                                <button
                                    @click="generateMaterialFromTitle"
                                    :disabled="
                                        isGeneratingMaterial || !subjectTitle
                                    "
                                    class="w-12 flex items-center justify-center bg-gradient-to-br from-cozy-accent to-yellow-500 text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                                    title="AI Buat Ringkasan Materi"
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
                                >Generation Mode</label
                            >
                            <div
                                class="grid grid-cols-2 gap-2 p-1 bg-cozy-bg rounded-xl border border-cozy-border"
                            >
                                <button
                                    @click="generationMode = 'hard'"
                                    class="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
                                    :class="
                                        generationMode === 'hard'
                                            ? 'bg-white shadow-sm text-cozy-text ring-1 ring-cozy-border'
                                            : 'text-cozy-muted hover:text-cozy-text'
                                    "
                                >
                                    <Lock class="w-3 h-3" /> Strict Focus
                                </button>
                                <button
                                    @click="generationMode = 'soft'"
                                    class="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
                                    :class="
                                        generationMode === 'soft'
                                            ? 'bg-white shadow-sm text-cozy-primary ring-1 ring-cozy-border'
                                            : 'text-cozy-muted hover:text-cozy-text'
                                    "
                                >
                                    <Globe class="w-3 h-3" /> Smart Creative
                                </button>
                            </div>
                            <p
                                class="text-[9px] text-cozy-muted mt-1.5 ml-1 leading-tight"
                            >
                                {{
                                    generationMode === "hard"
                                        ? "🔒 Focus: Jawaban 100% dari materi PDF. Tanpa opini luar."
                                        : "✨ Smart: Menggunakan materi PDF + pengetahuan umum AI untuk penjelasan."
                                }}
                            </p>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between items-center px-1">
                                <label
                                    class="text-[10px] font-bold text-cozy-muted uppercase block"
                                    >Source Material</label
                                >
                                <span
                                    v-if="pdfFile"
                                    class="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in"
                                    ><Check class="w-3 h-3" /> PDF Ready</span
                                >
                            </div>

                            <div
                                class="relative group"
                                @dragover="onDragOver"
                                @dragleave="onDragLeave"
                                @drop="onDrop"
                            >
                                <input
                                    type="file"
                                    id="pdf-upload"
                                    accept="application/pdf"
                                    @change="handleFileUpload"
                                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />

                                <div
                                    class="w-full p-4 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center"
                                    :class="[
                                        isDragging
                                            ? 'border-cozy-primary bg-cozy-primary/10 scale-[1.02]'
                                            : 'border-cozy-border bg-cozy-bg',
                                        pdfFile
                                            ? 'bg-green-50/50 border-green-200'
                                            : 'group-hover:border-cozy-primary/50',
                                    ]"
                                >
                                    <div
                                        v-if="!pdfFile"
                                        class="text-cozy-muted group-hover:text-cozy-primary transition-colors flex flex-col items-center"
                                    >
                                        <UploadCloud
                                            class="w-6 h-6 mb-1"
                                            :class="{
                                                'animate-bounce': isDragging,
                                            }"
                                        />
                                        <span class="text-xs font-bold">{{
                                            isDragging
                                                ? "Drop PDF Here!"
                                                : "Upload PDF"
                                        }}</span>
                                        <span class="text-[9px] opacity-70">{{
                                            isDragging
                                                ? "Release to upload..."
                                                : "Click or drag file here"
                                        }}</span>
                                    </div>
                                    <div
                                        v-else
                                        class="text-green-700 flex flex-col items-center w-full overflow-hidden"
                                    >
                                        <FileText class="w-6 h-6 mb-1" />
                                        <span
                                            class="text-xs font-bold truncate max-w-[200px]"
                                            >{{ pdfFileName }}</span
                                        >
                                        <span
                                            class="text-[9px] opacity-70 text-green-600"
                                            >Click to change file</span
                                        >
                                    </div>
                                </div>
                            </div>

                            <div class="relative flex py-1 items-center">
                                <div
                                    class="flex-grow border-t border-cozy-border"
                                ></div>
                                <span
                                    class="flex-shrink-0 mx-2 text-[9px] text-cozy-muted font-bold uppercase"
                                    >OR PASTE TEXT</span
                                >
                                <div
                                    class="flex-grow border-t border-cozy-border"
                                ></div>
                            </div>

                            <textarea
                                v-model="rawMaterial"
                                rows="4"
                                placeholder="Or paste text material here..."
                                class="w-full p-4 bg-cozy-bg border border-cozy-border rounded-xl text-xs leading-relaxed text-cozy-text focus:border-cozy-primary outline-none resize-none transition-all"
                            ></textarea>
                        </div>

                        <div
                            class="bg-cozy-bg rounded-xl p-3 border border-cozy-border flex items-center gap-4"
                        >
                            <span
                                class="text-xs font-bold text-cozy-text whitespace-nowrap"
                                >{{ questionCount }} Items</span
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
                            :disabled="isLoading || (!rawMaterial && !pdfFile)"
                            class="w-full py-4 rounded-xl bg-cozy-primary text-white font-bold shadow-lg shadow-cozy-primary/20 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 flex justify-center gap-2 relative overflow-hidden group"
                        >
                            <div
                                class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                            ></div>
                            <span
                                v-if="isLoading"
                                class="flex items-center gap-2"
                                ><Loader2 class="w-5 h-5 animate-spin" />
                                {{ processingStage || "Processing..." }}</span
                            >
                            <span
                                v-else
                                class="flex items-center gap-2 relative z-10"
                                ><Sparkles class="w-5 h-5" /> Generate
                                Magic</span
                            >
                        </button>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-8" ref="previewSection">
                <div class="flex justify-between items-center mb-4 px-2">
                    <h3
                        class="text-sm font-bold text-cozy-muted uppercase tracking-widest flex items-center gap-2"
                    >
                        <Check class="w-4 h-4" /> Live Preview
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
                        {{ isSaving ? "Saving..." : "Save All" }}
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
                        Workspace Empty
                    </h4>
                    <p class="text-xs text-cozy-muted mt-1 max-w-xs">
                        Upload a PDF or paste text, then hit Generate.
                    </p>
                </div>

                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
                    <div
                        v-for="(card, index) in generatedQuestions"
                        :key="index"
                        class="relative group"
                    >
                        <div
                            v-if="editingIndex === index"
                            class="bg-cozy-card border-2 border-cozy-primary/50 p-4 rounded-[24px] shadow-lg flex flex-col gap-3 animate-in zoom-in-95 h-full"
                        >
                            <div class="flex justify-between items-center mb-1">
                                <span
                                    class="text-[10px] font-bold text-cozy-primary uppercase tracking-wider"
                                    >Editing Card #{{ index + 1 }}</span
                                >
                                <div class="flex gap-1">
                                    <button
                                        @click="saveEdit(index)"
                                        class="p-1.5 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                                    >
                                        <Check class="w-4 h-4" />
                                    </button>
                                    <button
                                        @click="cancelEdit"
                                        class="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                    >
                                        <X class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <input
                                v-model="tempEditData.tag"
                                type="text"
                                class="w-full p-2 bg-cozy-bg border border-cozy-border rounded-xl text-xs font-bold text-cozy-muted focus:border-cozy-primary outline-none"
                                placeholder="Tag..."
                            />
                            <input
                                v-model="tempEditData.q"
                                type="text"
                                class="w-full p-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm font-bold text-cozy-text focus:border-cozy-primary outline-none"
                                placeholder="Pertanyaan..."
                            />
                            <textarea
                                v-model="tempEditData.a"
                                rows="4"
                                class="w-full p-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm text-cozy-text focus:border-cozy-primary outline-none resize-none"
                                placeholder="Jawaban..."
                            ></textarea>
                            <input
                                v-model="tempEditData.source"
                                type="text"
                                class="w-full p-2 bg-cozy-bg border border-cozy-border rounded-xl text-xs font-bold text-cozy-muted focus:border-cozy-primary outline-none"
                                placeholder="Sumber (Opsional)..."
                            />
                        </div>

                        <div v-else class="h-full relative">
                            <div
                                class="absolute -top-2 -right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            >
                                <button
                                    @click="startEdit(index)"
                                    class="p-2 bg-white text-cozy-primary border border-cozy-border rounded-full shadow-md hover:bg-cozy-primary hover:text-white transition-all scale-75 group-hover:scale-100"
                                >
                                    <Pencil class="w-4 h-4" />
                                </button>
                                <button
                                    @click="removeDraft(index)"
                                    class="p-2 bg-white text-red-400 border border-cozy-border rounded-full shadow-md hover:bg-red-500 hover:text-white transition-all scale-75 group-hover:scale-100"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                            <QuestionCard
                                :item="card"
                                :isRevealed="true"
                                class="h-full"
                            />
                        </div>
                    </div>
                </div>

                <div
                    v-if="generatedQuestions.length > 0"
                    class="fixed bottom-28 right-6 lg:hidden z-40"
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
