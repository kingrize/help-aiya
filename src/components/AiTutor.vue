<script setup>
import { ref, nextTick, onMounted, watch, computed } from "vue";
import { marked } from "marked";
import { playPop } from "../utils/sound.js";
import { geminiKeys, groqKeys, aimlKeys } from "../utils/aiConfig.js";
import {
    Settings,
    X,
    Send,
    Sparkles,
    Bot,
    User,
    Loader2,
    Stethoscope,
    GraduationCap,
    Save,
    Trash2,
    Key,
    Sliders,
    Zap,
    Cloud,
    Check,
    ChevronDown,
    Layers,
    BookOpen,
    Info,
    Dice5,
    Smile, // Icon baru untuk Jiya
} from "lucide-vue-next";

// --- DATA KEYS DARI ENV ---
const availableKeys = {
    gemini: geminiKeys,
    groq: groqKeys,
    aiml: aimlKeys,
    hybrid: [],
};

// --- DATA DUMMY PASIEN (AUTO GENERATE) ---
const dummyPatients = [
    {
        name: "Andi",
        age: "22 th",
        complaint: "Saya merasa sangat cemas setiap mau presentasi.",
    },
    {
        name: "Siti",
        age: "19 th",
        complaint: "Sering sedih tanpa alasan dan malas keluar kamar.",
    },
    {
        name: "Budi",
        age: "28 th",
        complaint: "Capek mental tiap bangun pagi padahal tidur cukup.",
    },
];

// --- STATE UTAMA ---
const isOpen = ref(false);
const showSettings = ref(false);
const showPersonaMenu = ref(false);
const inputMessage = ref("");
const isLoading = ref(false);
const chatContainer = ref(null);
const messages = ref([]);
const activePersona = ref("tutor"); // Default ke Jiya

// --- STATE ROLEPLAY PASIEN ---
const showPatientForm = ref(false);
const patientData = ref({ name: "", age: "", complaint: "" });
const activeSystemPrompt = ref("");

// --- SETTINGS CONFIG ---
const apiConfig = ref({
    provider: localStorage.getItem("user_ai_provider") || "hybrid",
    model: localStorage.getItem("user_ai_model") || "gemini-2.5-flash",
    temperature: parseFloat(localStorage.getItem("user_ai_temp") || 0.7),
    keyPrefs: JSON.parse(
        localStorage.getItem("user_ai_key_prefs") ||
            '{"gemini":"auto","groq":"auto","aiml":"auto"}',
    ),
});

const tempLabel = computed(() => {
    const t = apiConfig.value.temperature;
    if (t <= 0.3)
        return {
            text: "Fokus & Tepat",
            desc: "Jawaban faktual.",
            color: "text-blue-500",
        };
    if (t <= 0.7)
        return {
            text: "Seimbang",
            desc: "Kombinasi pas.",
            color: "text-green-500",
        };
    return { text: "Kreatif", desc: "Imajinatif.", color: "text-purple-500" };
});

const providers = {
    hybrid: {
        name: "Hybrid AI",
        icon: Layers,
        models: [{ id: "auto-best", name: "Auto-Select" }],
        tag: "Rec",
        tagColor: "bg-emerald-100 text-emerald-700",
        desc: "Auto-switch terbaik.",
    },
    gemini: {
        name: "Google Gemini",
        icon: Sparkles,
        models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }],
        tag: "Bal",
        tagColor: "bg-blue-100 text-blue-700",
        desc: "Seimbang.",
    },
    aiml: {
        name: "GPT-4o",
        icon: Cloud,
        models: [{ id: "gpt-4o", name: "GPT-4o" }],
        tag: "Smt",
        tagColor: "bg-purple-100 text-purple-700",
        desc: "Cerdas.",
    },
    groq: {
        name: "Groq Llama 3",
        icon: Zap,
        models: [{ id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" }],
        tag: "Fst",
        tagColor: "bg-orange-100 text-orange-700",
        desc: "Super Cepat.",
    },
};

// --- PERSONAS CONFIG (UPDATED: JIYA) ---
const personas = {
    tutor: {
        id: "tutor",
        name: "Jiya (Teman Belajar)", // REBRANDING
        icon: Smile, // Ganti icon jadi Smile biar ramah
        color: "text-pink-500", // Warna pink ceria
        bg: "bg-pink-50",
        desc: "Jelasin materi pake bahasa santai & analogi seru!",
        // PROMPT UTAMA JIYA
        basePrompt: `
        PERAN: Kamu adalah "Jiya", asisten belajar virtual yang ceria, ramah, dan pintar.

        GAYA BICARA:
        - Santai, gaul, tidak kaku, tapi tetap sopan.
        - Gunakan emoji yang relevan 🌟✨.
        - Panggil user dengan "Kak" atau "Bestie".

        INSTRUKSI KHUSUS:
        1. Setiap menjelaskan konsep rumit, WAJIB sertakan ANALOGI SEDERHANA (bayangkan menjelaskan ke anak 10 tahun).
        2. Jangan langsung kasih jawaban panjang lebar. Pecah jadi poin-poin biar enak dibaca.
        3. Kalau materinya membosankan, coba kasih contoh lucu.
        4. Akhiri penjelasan dengan pertanyaan pancingan biar user mau nanya lagi (Contoh: "Gimana? Udah kebayang belum kak?").
        `,
    },
    patient: {
        id: "patient",
        name: "Roleplay Pasien",
        icon: Stethoscope,
        color: "text-green-500",
        bg: "bg-green-50",
        desc: "Simulasi diagnosa kasus klinis.",
        basePrompt: null,
    },
    examiner: {
        id: "examiner",
        name: "Dosen Penguji",
        icon: BookOpen,
        color: "text-purple-500",
        bg: "bg-purple-50",
        desc: "Uji pemahaman materi (mode serius).",
        basePrompt: `Anda adalah Dosen Penguji yang Kritis. Tugas: JANGAN berikan jawaban langsung. Gunakan Socratic Method (tanya balik). Gaya bicara: Formal, akademis.`,
    },
};

const getKeyOptionLabel = (k) => (k ? "Valid" : "Invalid");

// --- API FETCHERS ---
const fetchWithKey = async (provider, model, messages, apiKey, temp) => {
    if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const contents = messages.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
        }));
        if (activeSystemPrompt.value)
            contents.unshift({
                role: "user",
                parts: [{ text: "SYSTEM PROMPT: " + activeSystemPrompt.value }],
            });

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents,
                generationConfig: { temperature: temp },
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Gemini Error");
        return data.candidates[0].content.parts[0].text;
    } else if (provider === "groq" || provider === "aiml") {
        const endpoint =
            provider === "groq"
                ? "https://api.groq.com/openai/v1/chat/completions"
                : "https://api.aimlapi.com/v1/chat/completions";
        const msgs = messages.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text,
        }));
        if (activeSystemPrompt.value)
            msgs.unshift({ role: "system", content: activeSystemPrompt.value });

        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model, messages: msgs, temperature: temp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Provider Error");
        return data.choices[0].message.content;
    }
};

const executeSmartApiCall = async (provider, model, messages, temp) => {
    const keys = availableKeys[provider];
    const pref = apiConfig.value.keyPrefs[provider];
    let keysToTry =
        pref === "auto" || pref === undefined
            ? [...keys].sort(() => Math.random() - 0.5)
            : [keys[parseInt(pref)]];

    if (keysToTry.length === 0)
        throw new Error(`Tidak ada API Key untuk ${provider}`);

    for (let i = 0; i < keysToTry.length; i++) {
        try {
            return await fetchWithKey(
                provider,
                model,
                messages,
                keysToTry[i],
                temp,
            );
        } catch (error) {
            if (pref !== "auto") throw error;
        }
    }
    throw new Error(`Semua kunci ${provider} sibuk.`);
};

const callAiApi = async (messages) => {
    const currentProvider = apiConfig.value.provider;
    if (currentProvider === "hybrid") {
        const strategy = [
            { p: "gemini", m: "gemini-2.5-flash" },
            { p: "aiml", m: "gpt-4o" },
            { p: "groq", m: "llama-3.3-70b-versatile" },
        ];
        for (const strat of strategy) {
            try {
                return await executeSmartApiCall(
                    strat.p,
                    strat.m,
                    messages,
                    apiConfig.value.temperature,
                );
            } catch (e) {
                continue;
            }
        }
        throw new Error("Sistem sibuk.");
    } else {
        return await executeSmartApiCall(
            currentProvider,
            apiConfig.value.model,
            messages,
            apiConfig.value.temperature,
        );
    }
};

// --- UI LOGIC ---
const toggleChat = () => {
    playPop();
    isOpen.value = !isOpen.value;
    if (isOpen.value && messages.value.length === 0) setPersona("tutor");
};
const toggleSettings = () => {
    showSettings.value = !showSettings.value;
    showPersonaMenu.value = false;
};
const saveSettings = () => {
    localStorage.setItem("user_ai_provider", apiConfig.value.provider);
    localStorage.setItem("user_ai_model", apiConfig.value.model);
    localStorage.setItem("user_ai_temp", apiConfig.value.temperature);
    localStorage.setItem(
        "user_ai_key_prefs",
        JSON.stringify(apiConfig.value.keyPrefs),
    );
    showSettings.value = false;
    playPop();
};
const resetSettings = () => {
    if (confirm("Reset?")) {
        localStorage.clear();
        location.reload();
    }
};
const changeProvider = () => {
    if (apiConfig.value.provider !== "hybrid")
        apiConfig.value.model =
            providers[apiConfig.value.provider].models[0].id;
};
const setPersona = (id) => {
    if (id === "patient") {
        showPatientForm.value = true;
        activePersona.value = id;
        return;
    }
    startSession(id, personas[id].basePrompt);
};
const generateRandomPatient = () => {
    playPop();
    patientData.value = {
        ...dummyPatients[Math.floor(Math.random() * dummyPatients.length)],
    };
};
const startPatientRoleplay = () => {
    if (!patientData.value.complaint) return;
    const dynamicPrompt = `PERAN: Pasien. NAMA: ${patientData.value.name} USIA: ${patientData.value.age} KONDISI: "${patientData.value.complaint}". Jawab sbg pasien.`;
    showPatientForm.value = false;
    startSession(
        "patient",
        dynamicPrompt,
        `Permisi... saya ${patientData.value.name}...`,
    );
};
const startSession = (id, prompt, customGreeting = null) => {
    activePersona.value = id;
    activeSystemPrompt.value = prompt;
    messages.value = [];
    showPatientForm.value = false;
    showSettings.value = false;
    showPersonaMenu.value = false;
    let greeting = customGreeting;
    if (!greeting) {
        if (id === "tutor")
            greeting =
                "Halo Kak! Jiya disini 👋. Ada materi yang bikin pusing? Yuk curhat sini, Jiya bantuin jelasin pake bahasa manusia bumi! 🌍✨";
        if (id === "examiner")
            greeting = "Silakan duduk. Kita mulai ujian lisannya sekarang.";
    }
    messages.value.push({ role: "model", text: greeting });
};
const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value) return;
    const userText = inputMessage.value;
    messages.value.push({ role: "user", text: userText });
    inputMessage.value = "";
    isLoading.value = true;
    scrollToBottom();
    try {
        const response = await callAiApi(messages.value);
        messages.value.push({ role: "model", text: response });
    } catch (error) {
        messages.value.push({
            role: "model",
            text: `⚠️ Ups, Jiya pusing: ${error.message}`,
        });
    } finally {
        isLoading.value = false;
        scrollToBottom();
    }
};
const scrollToBottom = () => {
    nextTick(() => {
        if (chatContainer.value)
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    });
};

defineExpose({
    openWithQuestion: (question) => {
        if (!isOpen.value) toggleChat();
        setPersona("tutor");
        setTimeout(() => {
            inputMessage.value = `Jiya, tolong jelasin "${question}" dong. Pake analogi ya!`;
            sendMessage();
        }, 500);
    },
});
</script>

<template>
    <div
        class="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans pointer-events-none"
    >
        <transition name="scale-up">
            <div
                v-if="isOpen"
                class="mb-4 w-[90vw] md:w-[400px] bg-cozy-card backdrop-blur-xl border border-cozy-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[75vh] min-h-[500px] pointer-events-auto relative transform transition-all font-sans text-cozy-text"
            >
                <!-- HEADER -->
                <div
                    class="p-4 border-b border-cozy-border flex justify-between items-center shrink-0 bg-cozy-card/80 backdrop-blur-md z-10 sticky top-0"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="p-2 rounded-xl shadow-sm transition-colors duration-300"
                            :class="
                                personas[activePersona].bg +
                                ' ' +
                                personas[activePersona].color
                            "
                        >
                            <component
                                :is="personas[activePersona].icon"
                                class="w-5 h-5"
                            />
                        </div>
                        <div>
                            <h3
                                class="font-bold text-cozy-text text-sm leading-tight tracking-wide"
                            >
                                {{ personas[activePersona].name }}
                            </h3>
                            <div class="flex items-center gap-1.5">
                                <span
                                    class="w-2 h-2 rounded-full bg-green-400 animate-pulse"
                                ></span>
                                <p
                                    class="text-[10px] text-cozy-muted font-bold uppercase tracking-wider"
                                >
                                    {{ providers[apiConfig.provider]?.name }}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button
                            @click="toggleSettings"
                            class="p-2 hover:bg-cozy-bg rounded-full text-cozy-muted hover:text-cozy-text transition-colors"
                        >
                            <Settings class="w-5 h-5" />
                        </button>
                        <button
                            @click="toggleChat"
                            class="p-2 hover:bg-red-50 hover:text-red-400 rounded-full transition-colors text-cozy-muted"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <!-- SUB-HEADER (Persona Switcher) -->
                <div
                    class="px-4 py-2 border-b border-cozy-border bg-cozy-bg/50 relative z-20"
                >
                    <button
                        @click="showPersonaMenu = !showPersonaMenu"
                        class="w-full flex items-center justify-between px-3 py-2 bg-cozy-card border border-cozy-border rounded-xl text-xs font-bold text-cozy-text shadow-sm hover:border-cozy-primary transition-all group"
                    >
                        <div class="flex items-center gap-2">
                            <component
                                :is="personas[activePersona].icon"
                                class="w-3.5 h-3.5 text-cozy-muted"
                            /><span
                                >Mode: {{ personas[activePersona].name }}</span
                            >
                        </div>
                        <ChevronDown
                            class="w-4 h-4 text-cozy-muted transition-transform duration-300"
                            :class="{ 'rotate-180': showPersonaMenu }"
                        />
                    </button>
                    <div
                        v-if="showPersonaMenu"
                        class="absolute top-full left-4 right-4 mt-2 bg-cozy-card border border-cozy-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50"
                    >
                        <div class="py-1">
                            <button
                                v-for="p in personas"
                                :key="p.id"
                                @click="
                                    setPersona(p.id);
                                    showPersonaMenu = false;
                                "
                                class="w-full px-4 py-3 flex items-center gap-3 hover:bg-cozy-bg transition-colors text-left border-b border-cozy-border last:border-0"
                                :class="
                                    activePersona === p.id
                                        ? 'bg-cozy-primary/5'
                                        : ''
                                "
                            >
                                <div
                                    class="p-2 rounded-lg shrink-0"
                                    :class="p.bg + ' ' + p.color"
                                >
                                    <component :is="p.icon" class="w-4 h-4" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs font-bold text-cozy-text">
                                        {{ p.name }}
                                    </p>
                                    <p
                                        class="text-[10px] text-cozy-muted leading-tight"
                                    >
                                        {{ p.desc }}
                                    </p>
                                </div>
                                <Check
                                    v-if="activePersona === p.id"
                                    class="w-4 h-4 text-cozy-primary shrink-0"
                                />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- CHAT AREA -->
                <div
                    ref="chatContainer"
                    class="flex-1 overflow-y-auto p-4 space-y-4 bg-cozy-bg/30"
                >
                    <div
                        v-for="(msg, index) in messages"
                        :key="index"
                        class="flex gap-3 group"
                        :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
                    >
                        <div
                            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-cozy-border transition-transform group-hover:scale-105 bg-cozy-card"
                        >
                            <User
                                v-if="msg.role === 'user'"
                                class="w-4 h-4 text-cozy-muted"
                            />
                            <component
                                v-else
                                :is="personas[activePersona]?.icon || Bot"
                                class="w-4 h-4"
                                :class="personas[activePersona]?.color"
                            />
                        </div>
                        <div
                            class="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words overflow-hidden"
                            :class="
                                msg.role === 'user'
                                    ? 'bg-cozy-primary text-white rounded-tr-sm'
                                    : 'bg-cozy-card text-cozy-text rounded-tl-sm border border-cozy-border'
                            "
                        >
                            <div
                                class="prose prose-sm max-w-none break-words"
                                :class="
                                    msg.role === 'user'
                                        ? 'prose-invert'
                                        : 'prose-cozy'
                                "
                                v-html="marked.parse(msg.text)"
                            ></div>
                        </div>
                    </div>
                    <div v-if="isLoading" class="flex gap-3 fade-in">
                        <div
                            class="w-8 h-8 bg-cozy-card rounded-full flex items-center justify-center border border-cozy-border"
                        >
                            <Sparkles
                                class="w-4 h-4 text-cozy-primary animate-spin-slow"
                            />
                        </div>
                        <div
                            class="bg-cozy-card/50 px-4 py-3 rounded-2xl rounded-tl-sm text-xs text-cozy-muted italic flex items-center gap-2 border border-cozy-border border-dashed"
                        >
                            <Loader2 class="w-3 h-3 animate-spin" /> Jiya lagi
                            mikir...
                        </div>
                    </div>
                </div>

                <!-- INPUT AREA -->
                <div
                    class="p-3 bg-cozy-card border-t border-cozy-border shrink-0"
                >
                    <form @submit.prevent="sendMessage" class="relative group">
                        <input
                            v-model="inputMessage"
                            type="text"
                            placeholder="Tanya Jiya..."
                            class="w-full pl-5 pr-12 py-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm focus:border-cozy-primary focus:ring-2 focus:ring-cozy-primary/20 outline-none transition-all placeholder:text-cozy-muted font-medium text-cozy-text"
                        />
                        <button
                            type="submit"
                            :disabled="!inputMessage || isLoading"
                            class="absolute right-2 top-2 p-1.5 bg-cozy-primary text-white rounded-lg hover:bg-cozy-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
                        >
                            <Send class="w-4 h-4" />
                        </button>
                    </form>
                </div>

                <!-- SETTINGS MODAL -->
                <div
                    v-if="showSettings"
                    class="absolute inset-0 z-30 bg-cozy-card/95 backdrop-blur-sm flex flex-col p-6 animate-in fade-in slide-in-from-top-4 overflow-hidden text-cozy-text"
                >
                    <div
                        class="flex justify-between items-center mb-6 shrink-0"
                    >
                        <h3 class="font-bold text-lg flex items-center gap-2">
                            <Settings class="w-5 h-5 text-cozy-muted" />
                            Pengaturan AI
                        </h3>
                        <button
                            @click="showSettings = false"
                            class="p-2 hover:bg-cozy-bg rounded-full"
                        >
                            <X class="w-5 h-5 text-cozy-muted" />
                        </button>
                    </div>
                    <div
                        class="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar"
                    >
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-3 flex items-center gap-1 tracking-wider"
                                ><Sparkles class="w-3 h-3" /> Pilih Otak
                                AI</label
                            >
                            <div class="space-y-3">
                                <button
                                    v-for="(val, key) in providers"
                                    :key="key"
                                    @click="
                                        apiConfig.provider = key;
                                        changeProvider();
                                    "
                                    class="w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all hover:shadow-md relative overflow-hidden group"
                                    :class="
                                        apiConfig.provider === key
                                            ? 'border-cozy-primary bg-cozy-primary/5 ring-1 ring-cozy-primary'
                                            : 'border-cozy-border bg-cozy-card hover:bg-cozy-bg'
                                    "
                                >
                                    <div
                                        class="p-2 rounded-lg shrink-0 mt-1 transition-colors"
                                        :class="
                                            apiConfig.provider === key
                                                ? 'bg-cozy-card shadow-sm'
                                                : 'bg-cozy-bg'
                                        "
                                    >
                                        <component
                                            :is="val.icon"
                                            class="w-5 h-5"
                                            :class="
                                                apiConfig.provider === key
                                                    ? 'text-cozy-primary'
                                                    : 'text-cozy-muted'
                                            "
                                        />
                                    </div>
                                    <div class="flex-1">
                                        <div
                                            class="flex items-center gap-2 mb-0.5"
                                        >
                                            <span class="text-sm font-bold">{{
                                                val.name
                                            }}</span
                                            ><span
                                                class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                                :class="val.tagColor"
                                                >{{ val.tag }}</span
                                            >
                                        </div>
                                        <p
                                            class="text-[10px] text-cozy-muted leading-relaxed pr-2"
                                        >
                                            {{ val.desc }}
                                        </p>
                                    </div>
                                    <div
                                        v-if="apiConfig.provider === key"
                                        class="absolute top-2 right-2"
                                    >
                                        <Check
                                            class="w-4 h-4 text-cozy-primary"
                                        />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div
                        class="mt-4 pt-4 border-t border-cozy-border shrink-0 flex flex-col gap-2"
                    >
                        <button
                            @click="saveSettings"
                            class="w-full py-3 bg-cozy-primary text-white rounded-xl font-bold text-xs shadow-lg hover:bg-cozy-accent transition-all flex items-center justify-center gap-2"
                        >
                            <Save class="w-4 h-4" /> Simpan Pengaturan
                        </button>
                    </div>
                </div>

                <!-- PATIENT FORM -->
                <div
                    v-if="showPatientForm"
                    class="absolute inset-0 z-20 bg-cozy-card flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 top-[80px]"
                >
                    <div class="flex justify-between items-center mb-4">
                        <h3
                            class="font-bold text-cozy-text text-lg flex items-center gap-2"
                        >
                            <Stethoscope class="w-5 h-5 text-green-500" /> Data
                            Pasien
                        </h3>
                        <button
                            @click="generateRandomPatient"
                            class="text-[10px] font-bold text-cozy-primary bg-cozy-primary/10 px-3 py-1.5 rounded-lg hover:bg-cozy-primary/20 transition-all flex items-center gap-1.5 animate-pulse"
                        >
                            <Dice5 class="w-3.5 h-3.5" /> Auto Isi
                        </button>
                    </div>
                    <div class="space-y-4 flex-1">
                        <input
                            v-model="patientData.name"
                            type="text"
                            placeholder="Nama Pasien"
                            class="w-full p-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm outline-none focus:border-green-500 text-cozy-text transition-all"
                        />
                        <input
                            v-model="patientData.age"
                            type="text"
                            placeholder="Usia"
                            class="w-full p-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm outline-none focus:border-green-500 text-cozy-text transition-all"
                        />
                        <textarea
                            v-model="patientData.complaint"
                            rows="4"
                            placeholder="Keluhan utama..."
                            class="w-full p-3 bg-cozy-bg border border-cozy-border rounded-xl text-sm outline-none focus:border-green-500 resize-none text-cozy-text transition-all"
                        ></textarea>
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button
                            @click="showPatientForm = false"
                            class="flex-1 py-3 text-cozy-muted text-xs font-bold hover:bg-cozy-bg rounded-xl"
                        >
                            Batal</button
                        ><button
                            @click="startPatientRoleplay"
                            :disabled="!patientData.complaint"
                            class="flex-[2] py-3 bg-green-500 text-white text-xs font-bold rounded-xl shadow-lg hover:bg-green-600 transition-all"
                        >
                            Mulai Sesi
                        </button>
                    </div>
                </div>
            </div>
        </transition>

        <button
            @click="toggleChat"
            class="group relative w-16 h-16 bg-cozy-card border border-cozy-border rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-all duration-300 pointer-events-auto hover:border-cozy-primary"
        >
            <span
                class="absolute inset-0 rounded-full bg-cozy-primary/10 animate-ping opacity-20 group-hover:opacity-0"
            ></span>
            <transition name="rotate"
                ><component
                    v-if="!isOpen"
                    :is="personas[activePersona].icon"
                    class="w-7 h-7 text-cozy-primary absolute" /><X
                    v-else
                    class="w-7 h-7 text-cozy-muted absolute"
            /></transition>
        </button>
    </div>
</template>

<style scoped>
.scale-up-enter-active,
.scale-up-leave-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.scale-up-enter-from,
.scale-up-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
}
.rotate-enter-active,
.rotate-leave-active {
    transition: all 0.3s ease;
}
.rotate-enter-from,
.rotate-leave-to {
    opacity: 0;
    transform: rotate(90deg) scale(0.5);
}
.animate-spin-slow {
    animation: spin 3s linear infinite;
}
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
}
.prose-cozy {
    color: var(--c-text);
}
.prose-cozy :deep(strong) {
    color: var(--c-text);
    font-weight: 800;
}
.prose-cozy :deep(a) {
    color: var(--c-primary);
}
</style>
