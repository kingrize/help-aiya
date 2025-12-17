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
    Dice5, // Icon dadu untuk tombol Auto Generate
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
        complaint:
            "Saya merasa sangat cemas (anxiety) setiap kali harus berbicara di depan umum atau presentasi. Jantung berdebar kencang sampai blank.",
    },
    {
        name: "Siti",
        age: "19 th",
        complaint:
            "Akhir-akhir ini saya sering menangis tanpa alasan yang jelas, kehilangan selera makan, dan malas keluar kamar kos.",
    },
    {
        name: "Budi",
        age: "28 th",
        complaint:
            "Saya mengalami burnout parah di kantor. Rasanya lelah mental setiap bangun pagi, padahal baru saja tidur cukup.",
    },
    {
        name: "Rina",
        age: "35 th",
        complaint:
            "Saya merasa terjebak dalam hubungan toxic dengan pasangan, tapi saya takut sendirian jika harus putus.",
    },
    {
        name: "Deni",
        age: "17 th",
        complaint:
            "Orang tua saya menuntut nilai sempurna. Saya jadi sering sakit perut dan pusing setiap mau ujian sekolah.",
    },
    {
        name: "Maya",
        age: "24 th",
        complaint:
            "Saya sulit tidur (insomnia) hampir setiap malam karena overthinking tentang masa depan dan karir saya.",
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
const activePersona = ref("tutor");

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

// --- HELPER: TEMPERATURE LABEL ---
const tempLabel = computed(() => {
    const t = apiConfig.value.temperature;
    if (t <= 0.3)
        return {
            text: "Fokus & Tepat",
            desc: "Jawaban faktual, minim halusinasi.",
            color: "text-blue-500",
        };
    if (t <= 0.7)
        return {
            text: "Seimbang (Recommended)",
            desc: "Kombinasi fakta & gaya bahasa luwes.",
            color: "text-green-500",
        };
    return {
        text: "Kreatif & Imajinatif",
        desc: "Cocok untuk ide cerita atau brainstorming.",
        color: "text-purple-500",
    };
});

// --- PROVIDERS LIST ---
const providers = {
    hybrid: {
        name: "Hybrid AI (Auto)",
        icon: Layers,
        models: [{ id: "auto-best", name: "Auto-Select Model" }],
        tag: "Recommended",
        tagColor: "bg-emerald-100 text-emerald-700",
        desc: "Mode terpintar. Otomatis memilih AI terbaik yang tersedia & melakukan switch jika ada error.",
    },
    gemini: {
        name: "Google Gemini",
        icon: Sparkles,
        models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }],
        tag: "Balanced",
        tagColor: "bg-blue-100 text-blue-700",
        desc: "Keseimbangan bagus antara kecepatan dan kecerdasan logika.",
    },
    aiml: {
        name: "GPT-4o (via AIML)",
        icon: Cloud,
        models: [{ id: "gpt-4o", name: "GPT-4o" }],
        tag: "Smartest",
        tagColor: "bg-purple-100 text-purple-700",
        desc: "Model paling cerdas untuk penalaran kompleks, namun kadang lebih lambat.",
    },
    groq: {
        name: "Groq (Llama 3)",
        icon: Zap,
        models: [
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
            { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
        ],
        tag: "Fastest",
        tagColor: "bg-orange-100 text-orange-700",
        desc: "Respon super instan. Cocok untuk percakapan cepat tanpa mikir berat.",
    },
};

// --- PERSONAS CONFIG ---
const personas = {
    tutor: {
        id: "tutor",
        name: "Dosen Santuy",
        icon: GraduationCap,
        color: "text-blue-500",
        bg: "bg-blue-50",
        desc: "Belajar santai rasa tongkrongan.",
        basePrompt: `Anda adalah "Dosen Santuy", asisten belajar pribadi.
        Gaya bicara: Hangat, santai, suportif, gunakan emoji, dan analogi sederhana.
        Tugas: Jelaskan konsep rumit menjadi sangat sederhana.`,
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
        basePrompt: `Anda adalah Dosen Penguji yang Kritis.
        Tugas: JANGAN berikan jawaban langsung. Gunakan Socratic Method (tanya balik).
        Gaya bicara: Formal, akademis, sedikit mengintimidasi tapi sopan.`,
    },
};

// --- HELPER & LOGIC API ---
const getKeyOptionLabel = (keyStr) => {
    if (!keyStr) return "Invalid";
    return `${keyStr.substring(0, 4)}...${keyStr.substring(keyStr.length - 4)}`;
};

const fetchWithKey = async (provider, model, messages, apiKey, temp) => {
    if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const contents = messages.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
        }));
        if (activeSystemPrompt.value) {
            contents.unshift({
                role: "user",
                parts: [{ text: "SYSTEM: " + activeSystemPrompt.value }],
            });
            contents.splice(1, 0, {
                role: "model",
                parts: [{ text: "Dimengerti." }],
            });
        }
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
    } else if (provider === "groq") {
        const msgs = messages.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text,
        }));
        if (activeSystemPrompt.value)
            msgs.unshift({ role: "system", content: activeSystemPrompt.value });
        const res = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: msgs,
                    temperature: temp,
                }),
            },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Groq Error");
        return data.choices[0].message.content;
    } else if (provider === "aiml") {
        const msgs = messages.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text,
        }));
        if (activeSystemPrompt.value)
            msgs.unshift({ role: "system", content: activeSystemPrompt.value });
        const res = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: msgs,
                temperature: temp,
                max_tokens: 1000,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "AIML Error");
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
    let lastError = null;

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
            console.warn(`[${provider}] Key #${i} Failed:`, error.message);
            lastError = error;
            if (pref !== "auto") throw error;
        }
    }
    throw new Error(`Semua kunci ${provider} sibuk. (${lastError?.message})`);
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
        throw new Error("Sistem sedang sibuk. Coba lagi nanti.");
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
    if (confirm("Reset ke default?")) {
        localStorage.removeItem("user_ai_provider");
        localStorage.removeItem("user_ai_model");
        localStorage.removeItem("user_ai_temp");
        localStorage.removeItem("user_ai_key_prefs");
        apiConfig.value = {
            provider: "hybrid",
            model: "gemini-2.5-flash",
            temperature: 0.7,
            keyPrefs: { gemini: "auto", groq: "auto", aiml: "auto" },
        };
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
    const random =
        dummyPatients[Math.floor(Math.random() * dummyPatients.length)];
    patientData.value = { ...random };
};
const startPatientRoleplay = () => {
    if (!patientData.value.complaint) return;
    const dynamicPrompt = `PERAN: Pasien Konseling. NAMA: ${patientData.value.name || "Anonim"} USIA: ${patientData.value.age || "-"} KONDISI: "${patientData.value.complaint}". INSTRUKSI: Jawab sebagai pasien ini dlm Bhs Indonesia.`;
    showPatientForm.value = false;
    startSession(
        "patient",
        dynamicPrompt,
        `(Masuk ruangan) Permisi... saya ${patientData.value.name}...`,
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
            greeting = "Halo! Dosen Santuy siap bantu. Mau bahas apa? ☕";
        if (id === "examiner")
            greeting = "Silakan duduk. Kita mulai ujian lisannya.";
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
            text: `⚠️ **Maaf**: ${error.message}`,
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
            inputMessage.value = `Jelaskan "${question}" secara ringkas.`;
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
                class="mb-4 w-[90vw] md:w-[400px] bg-white/95 backdrop-blur-xl border border-cozy-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[75vh] min-h-[500px] pointer-events-auto relative transform transition-all font-sans text-cozy-text"
            >
                <div
                    class="p-4 border-b border-cozy-border flex justify-between items-center shrink-0 bg-white/60 backdrop-blur-md z-10 sticky top-0"
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
                            class="p-2 hover:bg-gray-100 rounded-full text-cozy-muted hover:text-cozy-text transition-colors"
                            title="Settings"
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

                <div
                    class="px-4 py-2 border-b border-cozy-border bg-cozy-bg/50 relative z-20"
                >
                    <button
                        @click="showPersonaMenu = !showPersonaMenu"
                        class="w-full flex items-center justify-between px-3 py-2 bg-white border border-cozy-border rounded-xl text-xs font-bold text-cozy-text shadow-sm hover:border-cozy-primary transition-all group"
                    >
                        <div class="flex items-center gap-2">
                            <component
                                :is="personas[activePersona].icon"
                                class="w-3.5 h-3.5 text-cozy-muted"
                            />
                            <span
                                >Ganti Mode:
                                {{ personas[activePersona].name }}</span
                            >
                        </div>
                        <ChevronDown
                            class="w-4 h-4 text-cozy-muted transition-transform duration-300"
                            :class="{ 'rotate-180': showPersonaMenu }"
                        />
                    </button>
                    <div
                        v-if="showPersonaMenu"
                        class="absolute top-full left-4 right-4 mt-2 bg-white border border-cozy-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2"
                    >
                        <div class="py-1">
                            <button
                                v-for="p in personas"
                                :key="p.id"
                                @click="
                                    setPersona(p.id);
                                    showPersonaMenu = false;
                                "
                                class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
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
                            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-cozy-border transition-transform group-hover:scale-105"
                            :class="
                                msg.role === 'user' ? 'bg-white' : 'bg-white'
                            "
                        >
                            <User
                                v-if="msg.role === 'user'"
                                class="w-4 h-4 text-gray-400"
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
                                    : 'bg-white text-cozy-text rounded-tl-sm border border-cozy-border'
                            "
                        >
                            <div
                                class="prose prose-sm max-w-none break-words"
                                :class="
                                    msg.role === 'user'
                                        ? 'prose-invert'
                                        : 'prose-gray'
                                "
                                v-html="marked.parse(msg.text)"
                            ></div>
                        </div>
                    </div>
                    <div v-if="isLoading" class="flex gap-3 fade-in">
                        <div
                            class="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-cozy-border"
                        >
                            <Sparkles
                                class="w-4 h-4 text-cozy-primary animate-spin-slow"
                            />
                        </div>
                        <div
                            class="bg-white/50 px-4 py-3 rounded-2xl rounded-tl-sm text-xs text-cozy-muted italic flex items-center gap-2 border border-cozy-border border-dashed"
                        >
                            <Loader2 class="w-3 h-3 animate-spin" /> Sedang
                            berpikir...
                        </div>
                    </div>
                </div>

                <div class="p-3 bg-white border-t border-cozy-border shrink-0">
                    <form @submit.prevent="sendMessage" class="relative group">
                        <input
                            v-model="inputMessage"
                            type="text"
                            placeholder="Ketik sesuatu..."
                            class="w-full pl-5 pr-12 py-3 bg-cozy-bg/50 border border-gray-200 rounded-xl text-sm focus:border-cozy-primary focus:ring-2 focus:ring-cozy-primary/20 outline-none transition-all placeholder:text-cozy-muted font-medium text-cozy-text"
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

                <div
                    v-if="showSettings"
                    class="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col p-6 animate-in fade-in slide-in-from-top-4 overflow-hidden"
                >
                    <div
                        class="flex justify-between items-center mb-6 shrink-0"
                    >
                        <h3
                            class="font-bold text-cozy-text text-lg flex items-center gap-2"
                        >
                            <Settings class="w-5 h-5 text-cozy-muted" />
                            Pengaturan AI
                        </h3>
                        <button
                            @click="showSettings = false"
                            class="p-2 hover:bg-gray-100 rounded-full"
                        >
                            <X class="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div
                        class="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar"
                    >
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-3 flex items-center gap-1 tracking-wider"
                                ><Sparkles class="w-3 h-3" /> Pilih Otak AI
                                (Provider)</label
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
                                            : 'border-gray-200 bg-white hover:bg-gray-50'
                                    "
                                >
                                    <div
                                        class="p-2 rounded-lg shrink-0 mt-1 transition-colors"
                                        :class="
                                            apiConfig.provider === key
                                                ? 'bg-white shadow-sm'
                                                : 'bg-gray-100'
                                        "
                                    >
                                        <component
                                            :is="val.icon"
                                            class="w-5 h-5"
                                            :class="
                                                apiConfig.provider === key
                                                    ? 'text-cozy-primary'
                                                    : 'text-gray-400'
                                            "
                                        />
                                    </div>

                                    <div class="flex-1">
                                        <div
                                            class="flex items-center gap-2 mb-0.5"
                                        >
                                            <span
                                                class="text-sm font-bold text-cozy-text"
                                                >{{ val.name }}</span
                                            >
                                            <span
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

                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-3 flex items-center gap-1 tracking-wider"
                                ><Sliders class="w-3 h-3" /> Tingkat
                                Kreativitas</label
                            >
                            <div
                                class="bg-white p-4 rounded-xl border border-gray-200"
                            >
                                <div
                                    class="flex justify-between items-end mb-2"
                                >
                                    <span
                                        class="text-xs font-bold transition-colors"
                                        :class="tempLabel.color"
                                        >{{ tempLabel.text }}</span
                                    >
                                    <span
                                        class="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 rounded"
                                        >{{ apiConfig.temperature }}</span
                                    >
                                </div>
                                <input
                                    type="range"
                                    v-model="apiConfig.temperature"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    class="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-cozy-primary mb-2"
                                />
                                <p
                                    class="text-[10px] text-cozy-muted italic flex gap-1.5 items-start"
                                >
                                    <Info class="w-3 h-3 shrink-0 mt-0.5" />
                                    {{ tempLabel.desc }}
                                </p>
                            </div>
                        </div>

                        <div v-if="apiConfig.provider !== 'hybrid'">
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-3 flex items-center gap-1 tracking-wider"
                                ><Key class="w-3 h-3" /> Kunci API</label
                            >
                            <div
                                class="bg-gray-50 p-1 rounded-xl border border-gray-200"
                            >
                                <select
                                    v-model="
                                        apiConfig.keyPrefs[apiConfig.provider]
                                    "
                                    class="w-full p-2.5 bg-white border-none rounded-lg text-xs outline-none focus:ring-2 focus:ring-cozy-primary/20 transition-all font-mono text-cozy-text shadow-sm"
                                >
                                    <option value="auto">
                                        ⚡ Auto-Switch (Recommended)
                                    </option>
                                    <option
                                        v-for="(k, idx) in availableKeys[
                                            apiConfig.provider
                                        ]"
                                        :key="idx"
                                        :value="idx"
                                    >
                                        Key {{ idx + 1 }} ({{
                                            getKeyOptionLabel(k)
                                        }})
                                    </option>
                                </select>
                            </div>
                            <p class="text-[9px] text-gray-400 mt-2 ml-1">
                                *Auto-Switch akan otomatis mengganti kunci jika
                                limit harian habis.
                            </p>
                        </div>
                    </div>

                    <div
                        class="mt-4 pt-4 border-t border-gray-100 shrink-0 flex flex-col gap-2"
                    >
                        <button
                            @click="saveSettings"
                            class="w-full py-3 bg-cozy-primary text-white rounded-xl font-bold text-xs shadow-lg hover:bg-cozy-accent transition-all flex items-center justify-center gap-2"
                        >
                            <Save class="w-4 h-4" /> Simpan Pengaturan
                        </button>
                        <button
                            @click="resetSettings"
                            class="w-full py-2 text-red-400 hover:text-red-600 font-bold text-[10px] flex items-center justify-center gap-1"
                        >
                            Reset ke Default
                        </button>
                    </div>
                </div>

                <div
                    v-if="showPatientForm"
                    class="absolute inset-0 z-20 bg-white flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 top-[80px]"
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
                            class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-500 text-cozy-text transition-all"
                        />
                        <input
                            v-model="patientData.age"
                            type="text"
                            placeholder="Usia"
                            class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-500 text-cozy-text transition-all"
                        />
                        <textarea
                            v-model="patientData.complaint"
                            rows="4"
                            placeholder="Keluhan utama..."
                            class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-500 resize-none text-cozy-text transition-all"
                        ></textarea>
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button
                            @click="showPatientForm = false"
                            class="flex-1 py-3 text-gray-400 text-xs font-bold hover:bg-gray-50 rounded-xl"
                        >
                            Batal
                        </button>
                        <button
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
            <transition name="rotate">
                <component
                    v-if="!isOpen"
                    :is="personas[activePersona].icon"
                    class="w-7 h-7 text-cozy-primary absolute"
                />
                <X v-else class="w-7 h-7 text-cozy-muted absolute" />
            </transition>
        </button>
    </div>
</template>

<style scoped>
/* ANIMATIONS */
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

/* CUSTOM SCROLLBAR */
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

/* MARKDOWN STYLING */
.prose {
    font-size: 0.9rem;
    line-height: 1.6;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
.prose :deep(p) {
    margin-bottom: 0.5em;
}
.prose :deep(strong) {
    font-weight: 700;
    color: inherit;
}
.prose :deep(ul),
.prose :deep(ol) {
    padding-left: 1.2em;
    margin-bottom: 0.5em;
}
.prose :deep(ul) {
    list-style-type: disc;
}
.prose :deep(ol) {
    list-style-type: decimal;
}

/* CODE BLOCK */
.prose :deep(pre) {
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 0.5rem;
    padding: 0.75rem;
    overflow-x: auto;
    font-family: monospace;
    font-size: 0.8em;
    border: 1px solid rgba(0, 0, 0, 0.1);
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    max-width: 100%;
    white-space: pre;
}
.prose-invert :deep(pre) {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
}
.prose :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.85em;
}
.prose-invert :deep(code) {
    background-color: rgba(255, 255, 255, 0.15);
}
.prose :deep(pre) :deep(code) {
    background-color: transparent;
    padding: 0;
}
</style>
