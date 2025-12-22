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
    updateDoc,
    arrayUnion,
} from "firebase/firestore";
import {
    LogOut,
    Sparkles,
    Save,
    Trash2,
    BookOpen,
    Layers,
    Loader2,
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
    Info,
} from "lucide-vue-next";
import QuestionCard from "../components/QuestionCard.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useToast } from "../composables/useToast";

// --- IMPORT PDF.JS (FIXED WORKER) ---
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const router = useRouter();
const { addToast } = useToast();
const DRAFT_KEY = "aiya_admin_draft_v14_groqfix";

// --- STATE UI ---
const isLoading = ref(false);
const isSaving = ref(false);
const isResetting = ref(false);
const isGeneratingMaterial = ref(false);
const showResetModal = ref(false);
const showMaterialsModal = ref(false);
// NEW: State untuk Modal Delete Course
const showDeleteCourseModal = ref(false);
const courseToDelete = ref(null);

const existingCourses = ref([]);
const isLoadingMaterials = ref(false);

// --- FILE STATE ---
const pdfFile = ref(null);
const pdfFileName = ref("");
const pdfFileSize = ref("");
const isUploadingPdf = ref(false);
const processingStage = ref("");
const previewSection = ref(null);
const isDragging = ref(false);

// --- STATE MODE SAVE ---
const saveMode = ref("new");
const selectedCourseId = ref("");

// --- EDIT STATE ---
const editingIndex = ref(null);
const tempEditData = ref({});

// --- AI CONFIG ---
const currentProvider = ref("gemini");
const selectedKeyIndex = ref(1);
const questionCount = ref(10);
const isAutoKey = ref(true);
const generationMode = ref("hard");

const providers = {
    gemini: {
        name: "Gemini 2.5 Flash",
        icon: Sparkles,
        tagline: "Vision Master",
        desc: "Jago baca gambar & grafik.",
        maxKeys: 10,
        modelId: "gemini-2.5-flash",
    },
    groq: {
        name: "Groq Llama 3",
        icon: Zap,
        tagline: "Speed Demon",
        desc: "Super ngebut, cocok buat teks panjang.",
        maxKeys: 5,
    },
    aiml: {
        name: "AIML (GPT-4o)",
        icon: Cloud,
        tagline: "Premium Brain",
        desc: "High quality reasoning.",
        maxKeys: 5,
    },
};

// --- LOAD API KEYS ---
const apiKeys = { gemini: {}, groq: {}, aiml: {} };
const loadKeys = (prefix, target, max) => {
    for (let i = 1; i <= max; i++) {
        target[i] =
            import.meta.env[`VITE_${prefix}_API_KEY_${i}`] ||
            import.meta.env[`VITE_${prefix}_API_KEY`] ||
            "";
    }
};
loadKeys("GEMINI", apiKeys.gemini, 10);
loadKeys("GROQ", apiKeys.groq, 5);
loadKeys("AIML", apiKeys.aiml, 5);

const subjectTitle = ref("");
const rawMaterial = ref("");
const generatedQuestions = ref([]);

// --- AUTO-SAVE & RESTORE ---
onMounted(async () => {
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
                    addToast("Draft recovered! Let's continue.", "info");
                    nextTick(() =>
                        previewSection.value?.scrollIntoView({
                            behavior: "smooth",
                        }),
                    );
                }
            }
        } catch (e) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }
    await refreshLibrary();
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
        localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({
                title: subjectTitle.value,
                material: rawMaterial.value,
                questions: generatedQuestions.value,
            }),
        );
    },
    { deep: true },
);

const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

// --- HELPER: FILE SYSTEM ---
const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024,
        sizes = ["Bytes", "KB", "MB", "GB"],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const handleFileUpload = (event) => processFile(event.target.files[0]);
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

const processFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf")
        return addToast("Only PDF allowed bro!", "error");
    if (file.size > 200 * 1024 * 1024)
        return addToast("File kegedean (Max 200MB)", "error");

    isUploadingPdf.value = true;
    await new Promise((resolve) => setTimeout(resolve, 800));

    pdfFile.value = file;
    pdfFileName.value = file.name;
    pdfFileSize.value = formatFileSize(file.size);

    if (!subjectTitle.value)
        subjectTitle.value = file.name
            .replace(/\.pdf$/i, "")
            .replace(/[-_]/g, " ");

    isUploadingPdf.value = false;
    addToast("PDF Ready! Let's cook.", "success");
};

const removeFile = () => {
    pdfFile.value = null;
    pdfFileName.value = "";
    pdfFileSize.value = "";
    const fileInput = document.getElementById("pdf-upload");
    if (fileInput) fileInput.value = "";
};

// --- LOGIC 1: UPLOAD FILE KE GEMINI (<10MB) ---
const uploadFileToGemini = async (file, apiKey) => {
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "X-Goog-Upload-Protocol": "raw",
            "X-Goog-Upload-File-Name": file.name,
            "Content-Type": file.type,
        },
        body: file,
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Upload Failed");
    }

    const data = await response.json();
    const fileUri = data.file.uri;
    const fileName = data.file.name;

    // Polling
    let state = data.file.state;
    let attempts = 0;
    while (state === "PROCESSING") {
        attempts++;
        if (attempts > 60) throw new Error("Timeout: Kelamaan processingnya.");
        processingStage.value = `AI is reading your file (${attempts}s)...`;
        await new Promise((r) => setTimeout(r, 1500));

        const pollRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
        );
        const pollData = await pollRes.json();
        state = pollData.state;
        if (state === "FAILED") throw new Error("Google gagal baca PDF.");
    }
    return fileUri;
};

// --- LOGIC 2: EXTRACT TEXT (>10MB) ---
const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;

    let fullText = "";
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        processingStage.value = `Extracting Text Page ${i}/${totalPages}...`;
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += `\n--- Page ${i} ---\n${pageText}`;
    }
    return fullText;
};

// --- HELPER: API CALLER ---
const callProviderApi = async (
    providerName,
    apiKey,
    prompt,
    filePayload = null,
) => {
    // GEMINI HANDLER
    if (providerName === "gemini") {
        const contents = { parts: [{ text: prompt }] };
        const generationConfig = { responseMimeType: "application/json" };

        if (filePayload && filePayload.fileUri) {
            contents.parts.push({
                fileData: {
                    mimeType: "application/pdf",
                    fileUri: filePayload.fileUri,
                },
            });
        }

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${providers.gemini.modelId}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [contents],
                    generationConfig,
                }),
            },
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Gemini Error");

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("AI Empty Response.");
        return text;

        // GROQ & AIML HANDLER
    } else {
        const res = await fetch(
            providerName === "groq"
                ? "https://api.groq.com/openai/v1/chat/completions"
                : "https://api.aimlapi.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model:
                        providerName === "groq"
                            ? "llama-3.3-70b-versatile"
                            : "gpt-4o",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 4000,
                }),
            },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Provider Error");
        return data.choices?.[0]?.message?.content;
    }
};

const tryProviderWithRotation = async (
    providerName,
    prompt,
    filePayload = null,
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
        throw new Error(`No API Key for ${providerName}`);

    for (const apiKey of keysToTry) {
        try {
            let finalPayload = filePayload;
            if (
                providerName === "gemini" &&
                filePayload &&
                filePayload instanceof File
            ) {
                processingStage.value = "Uploading to AI Brain (<10MB)...";
                const uri = await uploadFileToGemini(filePayload, apiKey);
                finalPayload = { fileUri: uri };
            }
            const result = await callProviderApi(
                providerName,
                apiKey,
                prompt,
                finalPayload,
            );
            if (result) return result;
        } catch (err) {
            console.warn(`[${providerName}] Retry... Error: ${err.message}`);
        }
    }
    throw new Error(`All keys exhausted. Please check your API quota.`);
};

// --- CORE LOGIC (HYBRID) ---
const generateQuestions = async () => {
    const titleToUse =
        saveMode.value === "new"
            ? subjectTitle.value
            : existingCourses.value.find((c) => c.id === selectedCourseId.value)
                  ?.title || "Course Material";

    if (!titleToUse || (!rawMaterial.value && !pdfFile.value))
        return addToast("Judul & Materi wajib diisi bos!", "error");

    isLoading.value = true;
    generatedQuestions.value = [];

    try {
        let extractedText = rawMaterial.value;
        let filePayload = null;

        if (pdfFile.value) {
            const fileSizeMB = pdfFile.value.size / (1024 * 1024);

            // HYBRID SWITCHER
            if (fileSizeMB > 10) {
                processingStage.value = "Big File Detected: Extracting Text...";
                addToast(
                    "File > 10MB. Menggunakan mode Text Extraction (Hemat Resource).",
                    "info",
                );
                const pdfText = await extractTextFromPdf(pdfFile.value);
                extractedText =
                    (extractedText ? extractedText + "\n\n" : "") + pdfText;
                filePayload = null;
            } else {
                processingStage.value = "Smart Vision Mode Activated...";
                filePayload = pdfFile.value;
                if (currentProvider.value !== "gemini") {
                    processingStage.value = "Extracting Text for Non-Gemini...";
                    const pdfText = await extractTextFromPdf(pdfFile.value);
                    extractedText =
                        (extractedText ? extractedText + "\n\n" : "") + pdfText;
                    filePayload = null;
                }
            }
        }

        // PROMPT
        processingStage.value = `AI is crafting ${questionCount.value} questions...`;

        const constraint =
            generationMode.value === "hard"
                ? `STRICT MODE: Jawaban WAJIB 100% dari source material. Dilarang berhalusinasi atau menambah info luar.`
                : `SMART MODE: Gunakan materi sebagai dasar, tapi boleh tambahkan pengetahuan umum agar lebih mudah dimengerti.`;

        const finalPrompt = `
            ROLE: Super Teacher & Academic Expert.
            TOPIC: "${titleToUse}"
            TASK: Create ${questionCount.value} high-quality Flashcards (Q&A).
            LANGUAGE: Indonesian (Casual but educative).
            MODE: ${constraint}

            JSON STRUCTURE (Return ONLY this JSON array, no other text):
            [{"id": 1, "tag": "Sub-Bab", "icon": "Brain", "q": "Pertanyaan?", "a": "Jawaban lengkap & jelas.", "source": "Halaman/Konteks"}]

            ${filePayload ? "SOURCE: PDF ATTACHED (Analyze images & text)." : `SOURCE TEXT:\n"${extractedText.substring(0, 900000)}"`}
        `;

        let result = await tryProviderWithRotation(
            currentProvider.value,
            finalPrompt,
            filePayload,
        );

        // --- FIX: GROQ/AI JSON CLEANER ---
        // Mencari [ pertama dan ] terakhir untuk mengambil JSON murni
        // Ini mengatasi error "AI Output Malformed" jika AI bawel
        const firstBracket = result.indexOf("[");
        const lastBracket = result.lastIndexOf("]");

        if (firstBracket !== -1 && lastBracket !== -1) {
            result = result.substring(firstBracket, lastBracket + 1);
        } else {
            throw new Error("AI tidak memberikan JSON Array yang valid.");
        }

        try {
            const parsed = JSON.parse(result);
            generatedQuestions.value = parsed.map((item, index) => ({
                ...item,
                id: Date.now() + index,
                tag: item.tag || titleToUse,
                icon: item.icon || "Brain",
            }));
            addToast(
                `Boom! ${generatedQuestions.value.length} Cards Generated.`,
                "success",
            );
            nextTick(() =>
                previewSection.value?.scrollIntoView({ behavior: "smooth" }),
            );
        } catch (jsonErr) {
            console.error("Failed JSON:", result);
            throw new Error("AI Output Malformed (JSON Error).");
        }
    } catch (error) {
        console.error(error);
        addToast(error.message, "error");
    } finally {
        isLoading.value = false;
        processingStage.value = "";
    }
};

// --- ACTIONS & CRUD ---
const startEdit = (i) => {
    editingIndex.value = i;
    tempEditData.value = JSON.parse(
        JSON.stringify(generatedQuestions.value[i]),
    );
};
const saveEdit = (i) => {
    generatedQuestions.value[i] = { ...tempEditData.value };
    editingIndex.value = null;
    addToast("Saved!", "success");
};
const cancelEdit = () => {
    editingIndex.value = null;
    tempEditData.value = {};
};
const removeDraft = (i) => generatedQuestions.value.splice(i, 1);

const generateMaterialFromTitle = async () => {
    if (!subjectTitle.value) return addToast("Isi judul dulu bos!", "error");
    isGeneratingMaterial.value = true;
    try {
        const result = await tryProviderWithRotation(
            currentProvider.value,
            `Buatkan rangkuman kuliah padat tentang "${subjectTitle.value}". Bahasa Indonesia.`,
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
        if (saveMode.value === "new") {
            if (!subjectTitle.value)
                throw new Error("Judul folder wajib diisi!");
            await addDoc(collection(db, "courses"), {
                title: subjectTitle.value,
                createdAt: new Date(),
                questionsList: generatedQuestions.value,
            });
            addToast("New Folder Created!", "success");
        } else {
            if (!selectedCourseId.value)
                throw new Error("Pilih folder tujuan!");
            await updateDoc(doc(db, "courses", selectedCourseId.value), {
                questionsList: arrayUnion(...generatedQuestions.value),
            });
            addToast("Content Added to Folder!", "success");
        }
        resetForm();
    } catch (error) {
        addToast("Failed: " + error.message, "error");
    } finally {
        isSaving.value = false;
    }
};

const resetForm = async () => {
    subjectTitle.value = "";
    rawMaterial.value = "";
    generatedQuestions.value = [];
    removeFile();
    selectedCourseId.value = "";
    clearDraft();
    await refreshLibrary();
};

const refreshLibrary = async () => {
    try {
        const q = query(
            collection(db, "courses"),
            orderBy("createdAt", "desc"),
        );
        const s = await getDocs(q);
        existingCourses.value = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {}
};

const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
};

// --- MODAL CONTROLLERS ---
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
        addToast("Database Wiped Clean.", "success");
    } catch (e) {
        addToast("Reset Failed.", "error");
    } finally {
        isResetting.value = false;
    }
};

// Modal Library
const openMaterialsModal = async () => {
    showMaterialsModal.value = true;
    isLoadingMaterials.value = true;
    await refreshLibrary();
    isLoadingMaterials.value = false;
};

// NEW: Delete Course Flow
const confirmDeleteCourse = (id, title) => {
    courseToDelete.value = { id, title };
    showDeleteCourseModal.value = true;
};

const executeDeleteCourse = async () => {
    if (!courseToDelete.value) return;
    showDeleteCourseModal.value = false;
    try {
        await deleteDoc(doc(db, "courses", courseToDelete.value.id));
        existingCourses.value = existingCourses.value.filter(
            (c) => c.id !== courseToDelete.value.id,
        );
        addToast(`Folder "${courseToDelete.value.title}" deleted.`, "success");
    } catch (e) {
        addToast("Delete Failed.", "error");
    }
};

const formatDate = (ts) =>
    !ts
        ? "-"
        : new Date(ts.seconds * 1000).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
          });
</script>

<template>
    <div
        class="min-h-screen bg-cozy-bg text-cozy-text font-sans pb-32 transition-colors duration-300"
    >
        <ConfirmModal
            :isOpen="showResetModal"
            title="Wipe Everything?"
            message="Ini bakal hapus SEMUA data permanen. Yakin bos?"
            confirmText="Ya, Hapus Semua"
            @close="showResetModal = false"
            @confirm="confirmResetAction"
            :isDanger="true"
        />

        <ConfirmModal
            :isOpen="showDeleteCourseModal"
            title="Hapus Folder?"
            :message="`Yakin mau hapus folder '${courseToDelete?.title}'?`"
            confirmText="Hapus Folder"
            @close="showDeleteCourseModal = false"
            @confirm="executeDeleteCourse"
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
                                class="p-3 bg-cozy-primary/10 rounded-2xl text-cozy-primary"
                            >
                                <Library class="w-6 h-6" />
                            </div>
                            <div>
                                <h3 class="font-bold text-xl text-cozy-text">
                                    Library Collection
                                </h3>
                                <p class="text-xs text-cozy-muted">
                                    Manage all your courses here.
                                </p>
                            </div>
                        </div>
                        <button
                            @click="showMaterialsModal = false"
                            class="p-2 rounded-full text-cozy-muted hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                            <X class="w-6 h-6" />
                        </button>
                    </div>
                    <div
                        class="flex-1 overflow-y-auto p-6 space-y-3 bg-cozy-bg"
                    >
                        <div
                            v-if="isLoadingMaterials"
                            class="flex justify-center py-12"
                        >
                            <Loader2
                                class="w-8 h-8 text-cozy-primary animate-spin"
                            />
                        </div>
                        <div
                            v-else-if="existingCourses.length > 0"
                            v-for="course in existingCourses"
                            :key="course.id"
                            class="flex items-center justify-between p-5 bg-cozy-card border border-cozy-border rounded-2xl shadow-sm hover:shadow-md transition-all"
                        >
                            <div class="flex items-center gap-4">
                                <div
                                    class="w-12 h-12 rounded-full bg-cozy-primary/10 flex items-center justify-center text-cozy-primary font-bold text-lg uppercase"
                                >
                                    {{ course.title.charAt(0) }}
                                </div>
                                <div>
                                    <h4
                                        class="font-bold text-cozy-text text-base"
                                    >
                                        {{ course.title }}
                                    </h4>
                                    <div class="flex items-center gap-3 mt-1">
                                        <span
                                            class="text-xs text-cozy-muted flex items-center gap-1"
                                            ><FileQuestion class="w-3 h-3" />
                                            {{
                                                course.questionsList?.length ||
                                                0
                                            }}
                                            Items</span
                                        >
                                    </div>
                                </div>
                            </div>
                            <button
                                @click="
                                    confirmDeleteCourse(course.id, course.title)
                                "
                                class="p-3 text-cozy-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <Trash2 class="w-5 h-5" />
                            </button>
                        </div>
                        <div v-else class="text-center py-16 opacity-50">
                            <Library
                                class="w-16 h-16 mx-auto mb-4 text-cozy-muted"
                            />
                            <p class="text-base font-bold text-cozy-muted">
                                Belum ada materi, bikin dulu gih!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </transition>

        <header
            class="bg-cozy-card border-b border-cozy-border sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-opacity-95"
        >
            <div
                class="max-w-7xl mx-auto px-6 md:px-8 py-5 flex items-center justify-between gap-6"
            >
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div
                        class="w-12 h-12 bg-cozy-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cozy-primary/30 shrink-0"
                    >
                        <Settings2 class="w-7 h-7 animate-spin-slow" />
                    </div>
                    <div class="truncate">
                        <h1
                            class="font-display text-xl md:text-2xl font-bold text-cozy-text leading-tight"
                        >
                            Admin Command Center
                        </h1>
                        <p
                            class="text-sm text-cozy-muted font-medium hidden md:block"
                        >
                            Manage your AI Learning content.
                        </p>
                    </div>
                </div>
                <div class="flex gap-3 shrink-0">
                    <button @click="openMaterialsModal" class="btn-header">
                        <Library class="w-5 h-5" /><span
                            class="hidden md:inline"
                            >Library</span
                        >
                    </button>
                    <button @click="router.push('/')" class="btn-header">
                        <Home class="w-5 h-5" /><span class="hidden md:inline"
                            >Home</span
                        >
                    </button>
                    <button
                        @click="handleLogout"
                        class="btn-header text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                        <LogOut class="w-5 h-5" /><span class="hidden md:inline"
                            >Exit</span
                        >
                    </button>
                </div>
            </div>
        </header>

        <main
            class="max-w-7xl mx-auto px-6 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10"
        >
            <div class="lg:col-span-4 space-y-8">
                <div
                    class="bg-cozy-card border border-cozy-border rounded-[32px] p-8 shadow-sm relative overflow-hidden"
                >
                    <div
                        class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cozy-primary to-cozy-accent"
                    ></div>
                    <h3
                        class="text-base font-bold text-cozy-text flex items-center gap-2.5 mb-6"
                    >
                        <BrainCircuit class="w-5 h-5 text-cozy-primary" /> AI
                        Engine Status
                    </h3>

                    <div class="grid grid-cols-1 gap-3 mb-6">
                        <button
                            v-for="(prov, key) in providers"
                            :key="key"
                            @click="currentProvider = key"
                            class="flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-95 relative text-left group"
                            :class="
                                currentProvider === key
                                    ? 'bg-cozy-primary/5 border-cozy-primary ring-1 ring-cozy-primary'
                                    : 'bg-cozy-bg border-cozy-border hover:border-cozy-primary/50'
                            "
                        >
                            <div
                                class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                                :class="
                                    currentProvider === key
                                        ? 'bg-cozy-primary text-white'
                                        : 'bg-white text-cozy-muted group-hover:text-cozy-primary'
                                "
                            >
                                <component :is="prov.icon" class="w-5 h-5" />
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between items-center">
                                    <span
                                        class="font-bold text-sm text-cozy-text"
                                        >{{ prov.name }}</span
                                    >
                                    <span
                                        class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        :class="
                                            currentProvider === key
                                                ? 'bg-cozy-primary text-white'
                                                : 'bg-gray-100 text-gray-500'
                                        "
                                        >{{ prov.tagline }}</span
                                    >
                                </div>
                                <p class="text-xs text-cozy-muted mt-0.5">
                                    {{ prov.desc }}
                                </p>
                            </div>
                        </button>
                    </div>

                    <div
                        class="mt-6 pt-5 border-t border-dashed border-cozy-border"
                    >
                        <button
                            @click="openResetModal"
                            :disabled="isResetting"
                            class="w-full py-3 flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-sm font-bold transition-all opacity-80 hover:opacity-100"
                        >
                            <AlertTriangle class="w-4 h-4" /> Emergency Reset
                        </button>
                    </div>
                </div>

                <div
                    class="bg-cozy-card border border-cozy-border rounded-[32px] p-8 shadow-sm sticky top-28"
                >
                    <h3
                        class="text-base font-bold text-cozy-text flex items-center gap-2.5 mb-6"
                    >
                        <BookOpen class="w-5 h-5 text-cozy-accent" /> Content
                        Creator Hub
                    </h3>

                    <div class="space-y-6">
                        <div
                            class="p-1.5 bg-cozy-bg border border-cozy-border rounded-2xl flex gap-1"
                        >
                            <button
                                @click="saveMode = 'new'"
                                class="flex-1 py-3 text-xs font-bold rounded-xl transition-all"
                                :class="
                                    saveMode === 'new'
                                        ? 'bg-white shadow-sm text-cozy-primary ring-1 ring-cozy-border'
                                        : 'text-cozy-muted hover:text-cozy-text'
                                "
                            >
                                + New Course
                            </button>
                            <button
                                @click="saveMode = 'append'"
                                class="flex-1 py-3 text-xs font-bold rounded-xl transition-all"
                                :class="
                                    saveMode === 'append'
                                        ? 'bg-white shadow-sm text-cozy-primary ring-1 ring-cozy-border'
                                        : 'text-cozy-muted hover:text-cozy-text'
                                "
                            >
                                + Existing
                            </button>
                        </div>

                        <div>
                            <label
                                class="text-xs font-bold text-cozy-muted uppercase mb-2 block ml-1 tracking-wider"
                                >{{
                                    saveMode === "new"
                                        ? "Subject Name"
                                        : "Select Target"
                                }}</label
                            >
                            <div v-if="saveMode === 'new'" class="flex gap-2">
                                <div class="flex-1 relative">
                                    <Layers
                                        class="w-5 h-5 text-cozy-muted absolute left-4 top-3.5"
                                    />
                                    <input
                                        v-model="subjectTitle"
                                        type="text"
                                        placeholder="Ex: Biologi Sel"
                                        class="w-full pl-12 pr-4 py-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm font-bold text-cozy-text focus:border-cozy-primary outline-none transition-all"
                                    />
                                </div>
                                <button
                                    @click="generateMaterialFromTitle"
                                    :disabled="
                                        isGeneratingMaterial || !subjectTitle
                                    "
                                    class="w-12 flex items-center justify-center bg-gradient-to-br from-cozy-accent to-yellow-500 text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                                    title="Auto-Summarize Title"
                                >
                                    <Loader2
                                        v-if="isGeneratingMaterial"
                                        class="w-5 h-5 animate-spin"
                                    /><Wand2 v-else class="w-5 h-5" />
                                </button>
                            </div>
                            <div v-else class="relative">
                                <Layers
                                    class="w-5 h-5 text-cozy-muted absolute left-4 top-3.5 z-10"
                                />
                                <select
                                    v-model="selectedCourseId"
                                    class="w-full pl-12 pr-10 py-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm font-bold text-cozy-text focus:border-cozy-primary outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>
                                        -- Pilih Folder --
                                    </option>
                                    <option
                                        v-for="course in existingCourses"
                                        :key="course.id"
                                        :value="course.id"
                                    >
                                        {{ course.title }}
                                    </option>
                                </select>
                                <div
                                    class="absolute right-4 top-3.5 pointer-events-none"
                                >
                                    <ArrowRight
                                        class="w-5 h-5 text-cozy-muted rotate-90"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label
                                class="text-xs font-bold text-cozy-muted uppercase mb-2 block ml-1 tracking-wider"
                                >AI Behavior</label
                            >
                            <div class="grid grid-cols-2 gap-3">
                                <button
                                    @click="generationMode = 'hard'"
                                    class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all"
                                    :class="
                                        generationMode === 'hard'
                                            ? 'bg-white shadow-sm border-cozy-text text-cozy-text ring-1 ring-cozy-border'
                                            : 'bg-cozy-bg border-cozy-border text-cozy-muted hover:border-cozy-text/50'
                                    "
                                >
                                    <div class="flex items-center gap-2 mb-1">
                                        <Lock class="w-4 h-4" /><span
                                            class="text-xs font-bold"
                                            >Strict Mode</span
                                        >
                                    </div>
                                    <p class="text-[10px] opacity-70">
                                        100% dari Sumber
                                    </p>
                                </button>
                                <button
                                    @click="generationMode = 'soft'"
                                    class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all"
                                    :class="
                                        generationMode === 'soft'
                                            ? 'bg-white shadow-sm border-cozy-primary text-cozy-primary ring-1 ring-cozy-primary'
                                            : 'bg-cozy-bg border-cozy-border text-cozy-muted hover:border-cozy-primary/50'
                                    "
                                >
                                    <div class="flex items-center gap-2 mb-1">
                                        <Globe class="w-4 h-4" /><span
                                            class="text-xs font-bold"
                                            >Smart Mode</span
                                        >
                                    </div>
                                    <p class="text-[10px] opacity-70">
                                        Context Rich
                                    </p>
                                </button>
                            </div>
                            <div
                                class="mt-2 flex items-start gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100"
                            >
                                <Info
                                    class="w-4 h-4 text-blue-500 shrink-0 mt-0.5"
                                />
                                <p
                                    class="text-[10px] text-blue-700 leading-tight"
                                >
                                    <span class="font-bold">Strict:</span>
                                    Anti-halusinasi, cocok untuk definisi
                                    pasti.<br />
                                    <span class="font-bold">Smart:</span>
                                    Menambah contoh nyata agar mudah dipahami.
                                </p>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div class="flex justify-between items-center px-1">
                                <label
                                    class="text-xs font-bold text-cozy-muted uppercase block tracking-wider"
                                    >Knowledge Source</label
                                >
                                <span
                                    v-if="pdfFile"
                                    class="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1 animate-in fade-in"
                                    ><Check class="w-3 h-3" /> Ready to
                                    Cook</span
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
                                    :disabled="isUploadingPdf"
                                />

                                <div
                                    class="w-full p-6 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 text-center min-h-[140px]"
                                    :class="[
                                        isDragging
                                            ? 'border-cozy-primary bg-cozy-primary/10 scale-[1.01]'
                                            : 'border-cozy-border bg-cozy-bg',
                                        pdfFile
                                            ? 'bg-green-50/50 border-green-200'
                                            : 'group-hover:border-cozy-primary/50 group-hover:bg-white',
                                    ]"
                                >
                                    <div
                                        v-if="isUploadingPdf"
                                        class="flex flex-col items-center animate-pulse"
                                    >
                                        <Loader2
                                            class="w-8 h-8 text-cozy-primary animate-spin mb-2"
                                        />
                                        <span
                                            class="text-sm font-bold text-cozy-primary"
                                            >Scanning Document...</span
                                        >
                                    </div>

                                    <div
                                        v-else-if="pdfFile"
                                        class="relative w-full z-20"
                                    >
                                        <div
                                            class="flex items-center gap-4 bg-white p-4 rounded-xl border border-green-100 shadow-sm text-left"
                                        >
                                            <div
                                                class="p-3 bg-green-100 text-green-600 rounded-xl"
                                            >
                                                <FileText class="w-6 h-6" />
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p
                                                    class="text-sm font-bold text-cozy-text truncate"
                                                >
                                                    {{ pdfFileName }}
                                                </p>
                                                <p
                                                    class="text-xs text-green-600 font-medium"
                                                >
                                                    {{ pdfFileSize }}
                                                </p>
                                            </div>
                                            <button
                                                @click.prevent="removeFile"
                                                class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <X class="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div
                                        v-else
                                        class="text-cozy-muted group-hover:text-cozy-primary transition-colors flex flex-col items-center"
                                    >
                                        <div
                                            class="p-3 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform"
                                        >
                                            <UploadCloud
                                                class="w-6 h-6"
                                                :class="{
                                                    'animate-bounce':
                                                        isDragging,
                                                }"
                                            />
                                        </div>
                                        <span class="text-sm font-bold"
                                            >Drop your knowledge base here</span
                                        >
                                        <span class="text-xs opacity-70 mt-1"
                                            >PDF Files Only (Max 200MB)</span
                                        >
                                    </div>
                                </div>
                            </div>

                            <div class="relative flex py-2 items-center">
                                <div
                                    class="flex-grow border-t border-cozy-border"
                                ></div>
                                <span
                                    class="flex-shrink-0 mx-3 text-[10px] text-cozy-muted font-bold uppercase tracking-widest"
                                    >OR PASTE TEXT</span
                                >
                                <div
                                    class="flex-grow border-t border-cozy-border"
                                ></div>
                            </div>

                            <textarea
                                v-model="rawMaterial"
                                rows="3"
                                placeholder="Paste manual text material here if you don't have a PDF..."
                                class="w-full p-4 bg-cozy-bg border border-cozy-border rounded-xl text-sm leading-relaxed text-cozy-text focus:border-cozy-primary outline-none resize-none transition-all placeholder:text-gray-400"
                            ></textarea>
                        </div>

                        <div
                            class="bg-cozy-bg rounded-xl p-4 border border-cozy-border flex items-center gap-4"
                        >
                            <span
                                class="text-sm font-bold text-cozy-text whitespace-nowrap w-20"
                                >{{ questionCount }} Items</span
                            >
                            <input
                                type="range"
                                min="1"
                                max="50"
                                step="1"
                                v-model="questionCount"
                                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cozy-primary"
                            />
                        </div>

                        <button
                            @click="generateQuestions"
                            :disabled="isLoading || (!rawMaterial && !pdfFile)"
                            class="w-full py-4 rounded-xl bg-cozy-primary text-white font-bold text-base shadow-lg shadow-cozy-primary/30 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center gap-3 relative overflow-hidden group"
                        >
                            <div
                                class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
                            ></div>
                            <span
                                v-if="isLoading"
                                class="flex items-center gap-2 relative z-10 animate-pulse"
                                ><Loader2 class="w-5 h-5 animate-spin" />
                                {{ processingStage || "Cooking..." }}</span
                            >
                            <span
                                v-else
                                class="flex items-center gap-2 relative z-10"
                                ><Sparkles class="w-5 h-5" /> Craft Magic</span
                            >
                        </button>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-8" ref="previewSection">
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3
                        class="text-base font-bold text-cozy-muted uppercase tracking-widest flex items-center gap-2"
                    >
                        <Check class="w-5 h-5" /> Live Preview
                        <span
                            class="bg-cozy-bg border border-cozy-border px-3 py-0.5 rounded-lg text-cozy-text text-xs"
                            >{{ generatedQuestions.length }} Cards</span
                        >
                    </h3>
                    <button
                        v-if="generatedQuestions.length"
                        @click="saveToDatabase"
                        :disabled="isSaving"
                        class="text-sm font-bold text-cozy-primary bg-white border border-cozy-border hover:border-cozy-primary hover:bg-cozy-primary/5 px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
                    >
                        <Save class="w-4 h-4" />
                        {{ isSaving ? "Saving..." : "Save Everything" }}
                    </button>
                </div>

                <div
                    v-if="generatedQuestions.length === 0"
                    class="h-[600px] flex flex-col items-center justify-center text-center border-2 border-dashed border-cozy-border rounded-[32px] bg-cozy-bg/30"
                >
                    <div
                        class="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm"
                    >
                        <Sparkles class="w-10 h-10 text-cozy-muted" />
                    </div>
                    <h4 class="font-bold text-cozy-text text-xl mb-2">
                        Workspace Empty
                    </h4>
                    <p class="text-sm text-cozy-muted max-w-xs leading-relaxed">
                        Upload your material on the left panel, pick your mode,
                        and hit the magic button.
                    </p>
                </div>

                <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                    <div
                        v-for="(card, index) in generatedQuestions"
                        :key="index"
                        class="relative group"
                    >
                        <div
                            v-if="editingIndex === index"
                            class="bg-cozy-card border-2 border-cozy-primary/50 p-6 rounded-[24px] shadow-lg flex flex-col gap-4 animate-in zoom-in-95 h-full"
                        >
                            <div class="flex justify-between items-center mb-2">
                                <span
                                    class="text-xs font-bold text-cozy-primary uppercase tracking-wider"
                                    >Editing Card #{{ index + 1 }}</span
                                >
                                <div class="flex gap-2">
                                    <button
                                        @click="saveEdit(index)"
                                        class="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                                    >
                                        <Check class="w-4 h-4" />
                                    </button>
                                    <button
                                        @click="cancelEdit"
                                        class="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                    >
                                        <X class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <input
                                v-model="tempEditData.tag"
                                type="text"
                                class="w-full p-3 bg-cozy-bg border border-cozy-border rounded-xl text-xs font-bold text-cozy-muted focus:border-cozy-primary outline-none"
                                placeholder="Tag..."
                            />
                            <input
                                v-model="tempEditData.q"
                                type="text"
                                class="w-full p-4 bg-cozy-bg border border-cozy-border rounded-xl text-sm font-bold text-cozy-text focus:border-cozy-primary outline-none"
                                placeholder="Question..."
                            />
                            <textarea
                                v-model="tempEditData.a"
                                rows="5"
                                class="w-full p-4 bg-cozy-bg border border-cozy-border rounded-xl text-sm text-cozy-text focus:border-cozy-primary outline-none resize-none leading-relaxed"
                                placeholder="Answer..."
                            ></textarea>
                        </div>

                        <div v-else class="h-full relative">
                            <div
                                class="absolute -top-3 -right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            >
                                <button
                                    @click="startEdit(index)"
                                    class="p-2.5 bg-white text-cozy-primary border border-cozy-border rounded-full shadow-md hover:bg-cozy-primary hover:text-white transition-all scale-90 group-hover:scale-100"
                                >
                                    <Pencil class="w-4 h-4" />
                                </button>
                                <button
                                    @click="removeDraft(index)"
                                    class="p-2.5 bg-white text-red-400 border border-cozy-border rounded-full shadow-md hover:bg-red-500 hover:text-white transition-all scale-90 group-hover:scale-100"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                            <QuestionCard
                                :item="card"
                                :isRevealed="true"
                                class="h-full shadow-sm hover:shadow-md transition-shadow"
                            />
                        </div>
                    </div>
                </div>

                <div
                    v-if="generatedQuestions.length > 0"
                    class="fixed bottom-32 right-8 lg:hidden z-40"
                >
                    <button
                        @click="saveToDatabase"
                        :disabled="isSaving"
                        class="w-16 h-16 bg-cozy-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all border-4 border-white"
                    >
                        <Loader2
                            v-if="isSaving"
                            class="w-7 h-7 animate-spin"
                        /><Save v-else class="w-7 h-7" />
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
.btn-header {
    @apply flex items-center gap-2 px-4 py-2.5 bg-white border border-cozy-border text-cozy-text rounded-xl text-xs font-bold hover:bg-cozy-text hover:text-white transition-all shadow-sm;
}
</style>
