<script setup>
import { ref, nextTick, onMounted, watch } from "vue";
import { marked } from "marked";
import { playPop } from "../utils/sound.js";
// Hapus import GoogleGenerativeAI library, kita pakai fetch manual biar konsisten dengan provider lain
import {
    Settings,
    X,
    Send,
    Sparkles,
    Bot,
    User,
    Loader2,
    Heart,
    Lightbulb,
    Smile,
    ChevronRight,
    Brain,
    Stethoscope,
    GraduationCap,
    RefreshCw,
    Save,
    Trash2,
    Key,
    Sliders,
    Zap,
    Cloud,
} from "lucide-vue-next";

// --- STATE UTAMA ---
const isOpen = ref(false);
const showSettings = ref(false);
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
    provider: localStorage.getItem("user_ai_provider") || "gemini", // Default provider
    apiKey: localStorage.getItem("user_custom_key") || "",
    model: localStorage.getItem("user_ai_model") || "gemini-2.5-flash", // Default Model 2.5
    temperature: parseFloat(localStorage.getItem("user_ai_temp") || 0.7),
});

// --- PROVIDERS LIST ---
const providers = {
    gemini: {
        name: "Gemini",
        icon: Sparkles,
        models: [
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended)" },
            { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
            { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
        ],
        desc: "Multimodal & Cerdas",
    },
    groq: {
        name: "Groq",
        icon: Zap,
        models: [
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
            { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
        ],
        desc: "Super Cepat",
    },
    aiml: {
        name: "AIML (GPT)",
        icon: Cloud,
        models: [
            { id: "gpt-4o", name: "GPT-4o" },
            { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
        ],
        desc: "Premium Quality",
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
        desc: "Tanya materi apa aja.",
        basePrompt: `Anda adalah "Dosen Santuy", asisten belajar pribadi untuk mahasiswa Psikologi.
        Gaya bicara: Santai, suportif, menggunakan analogi sehari-hari, dan emoji.
        Tugas: Jelaskan konsep rumit menjadi sangat sederhana. Jawab pertanyaan user dengan ramah.`,
    },
    patient: {
        id: "patient",
        name: "Roleplay Pasien",
        icon: Stethoscope,
        color: "text-green-500",
        bg: "bg-green-50",
        desc: "Simulasi kasus custom.",
        basePrompt: null,
    },
    examiner: {
        id: "examiner",
        name: "Dosen Penguji",
        icon: Brain,
        color: "text-purple-500",
        bg: "bg-purple-50",
        desc: "Uji pemahamanmu.",
        basePrompt: `Anda adalah Dosen Penguji yang Kritis.
        Tugas: JANGAN berikan jawaban langsung. Jika user bertanya, balikkan dengan pertanyaan pancingan (Socratic Method) untuk menguji pemahaman logikanya.
        Gaya bicara: Formal, menantang, akademis.`,
    },
};

// --- HELPER API KEY ---
const getEffectiveApiKey = (provider) => {
    // 1. Cek User Custom Key
    if (apiConfig.value.apiKey && apiConfig.value.provider === provider)
        return apiConfig.value.apiKey;

    // 2. Cek ENV (Rotasi)
    let envPrefix = "";
    let maxKeys = 5;
    if (provider === "gemini") {
        envPrefix = "VITE_GEMINI_API_KEY";
        maxKeys = 10;
    } else if (provider === "groq") {
        envPrefix = "VITE_GROQ_API_KEY";
    } else if (provider === "aiml") {
        envPrefix = "VITE_AIML_API_KEY";
    }

    const keys = [];
    if (import.meta.env[envPrefix]) keys.push(import.meta.env[envPrefix]);
    for (let i = 1; i <= maxKeys; i++) {
        const k = import.meta.env[`${envPrefix}_${i}`];
        if (k) keys.push(k);
    }

    if (keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
};

// --- API CALLER (UNIVERSAL) ---
const callAiApi = async (messages) => {
    const provider = apiConfig.value.provider;
    const model = apiConfig.value.model;
    const apiKey = getEffectiveApiKey(provider);

    if (!apiKey) throw new Error(`API Key untuk ${provider} tidak ditemukan.`);

    let responseText = "";

    // 1. GEMINI (v1beta)
    if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Convert format pesan ke Gemini
        const contents = messages.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
        }));

        // Sisipkan System Instruction sebagai pesan pertama (user role) jika belum support system instruction di endpoint ini
        // Atau gunakan parameter system_instruction jika model support. Untuk aman, kita inject di awal history.
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
                contents: contents,
                generationConfig: { temperature: apiConfig.value.temperature },
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Gemini Error");
        responseText = data.candidates[0].content.parts[0].text;
    }

    // 2. GROQ (OpenAI Compatible)
    else if (provider === "groq") {
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
                    model: model,
                    messages: msgs,
                    temperature: apiConfig.value.temperature,
                }),
            },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Groq Error");
        responseText = data.choices[0].message.content;
    }

    // 3. AIML / CHATGPT (OpenAI Compatible)
    else if (provider === "aiml") {
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
                model: model,
                messages: msgs,
                temperature: apiConfig.value.temperature,
                max_tokens: 1000,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "AIML Error");
        responseText = data.choices[0].message.content;
    }

    return responseText;
};

// --- LOGIC UI ---
const toggleChat = () => {
    playPop();
    isOpen.value = !isOpen.value;
    if (isOpen.value && messages.value.length === 0) setPersona("tutor");
};

const toggleSettings = () => {
    showSettings.value = !showSettings.value;
};

const saveSettings = () => {
    localStorage.setItem("user_ai_provider", apiConfig.value.provider);
    localStorage.setItem("user_custom_key", apiConfig.value.apiKey);
    localStorage.setItem("user_ai_model", apiConfig.value.model);
    localStorage.setItem("user_ai_temp", apiConfig.value.temperature);
    showSettings.value = false;
    playPop();
};

const resetSettings = () => {
    if (confirm("Reset ke default?")) {
        localStorage.removeItem("user_ai_provider");
        localStorage.removeItem("user_custom_key");
        localStorage.removeItem("user_ai_model");
        localStorage.removeItem("user_ai_temp");
        apiConfig.value = {
            provider: "gemini",
            apiKey: "",
            model: "gemini-2.5-flash",
            temperature: 0.7,
        };
    }
};

const changeProvider = () => {
    // Auto select first model when provider changes
    apiConfig.value.model = providers[apiConfig.value.provider].models[0].id;
};

// --- LOGIC PERSONA ---
const setPersona = (id) => {
    if (id === "patient") {
        showPatientForm.value = true;
        activePersona.value = id;
        return;
    }
    startSession(id, personas[id].basePrompt);
};

const startPatientRoleplay = () => {
    if (!patientData.value.complaint) return;
    const dynamicPrompt = `
        PERAN: Pasien Konseling.
        NAMA: ${patientData.value.name || "Anonim"}
        USIA: ${patientData.value.age || "-"}
        KONDISI: "${patientData.value.complaint}"
        INSTRUKSI: Jawab sebagai pasien ini. Jangan keluar karakter. Gunakan Bahasa Indonesia.
    `;
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

    let greeting = customGreeting;
    if (!greeting) {
        if (id === "tutor")
            greeting =
                "Halo Aiya! Dosen Santuy siap bantu. Mau bahas materi apa? ☕";
        if (id === "examiner") greeting = "Silakan duduk. Kita mulai ujiannya.";
    }
    messages.value.push({ role: "model", text: greeting });
};

// --- LOGIC SEND ---
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
        console.error(error);
        messages.value.push({ role: "model", text: `Error: ${error.message}` });
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
            inputMessage.value = `Jelaskan "${question}" singkat saja.`;
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
                class="mb-4 w-[90vw] md:w-[400px] bg-white/95 backdrop-blur-xl border border-cozy-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[75vh] min-h-[500px] pointer-events-auto relative transform transition-all"
            >
                <div
                    class="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-white z-10"
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
                                class="font-bold text-cozy-text text-sm leading-tight"
                            >
                                {{ personas[activePersona].name }}
                            </h3>
                            <div class="flex items-center gap-1">
                                <span
                                    class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
                                ></span>
                                <p class="text-[10px] text-cozy-muted">
                                    {{ apiConfig.provider }} •
                                    {{
                                        apiConfig.model
                                            .replace("gemini-", "")
                                            .replace("llama-", "")
                                            .replace("gpt-", "")
                                    }}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button
                            @click="toggleSettings"
                            class="p-2 hover:bg-gray-100 rounded-full text-cozy-muted transition-colors"
                            title="Pengaturan"
                        >
                            <Settings class="w-5 h-5" />
                        </button>
                        <button
                            @click="toggleChat"
                            class="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors text-cozy-muted"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div
                    class="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 shrink-0 bg-gray-50/50"
                >
                    <button
                        v-for="p in personas"
                        :key="p.id"
                        @click="setPersona(p.id)"
                        class="px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5"
                        :class="
                            activePersona === p.id
                                ? 'bg-white border-cozy-primary text-cozy-primary shadow-sm'
                                : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
                        "
                    >
                        <component :is="p.icon" class="w-3 h-3" />
                        {{ p.name }}
                    </button>
                </div>

                <div
                    v-if="showPatientForm"
                    class="absolute inset-0 z-20 bg-white flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 top-[120px]"
                >
                    <h3
                        class="font-bold text-cozy-text text-lg mb-1 flex items-center gap-2"
                    >
                        <Stethoscope class="w-5 h-5 text-green-500" /> Pasien
                        Baru
                    </h3>
                    <p class="text-xs text-cozy-muted mb-4">
                        Setting karakter pasien untuk latihan.
                    </p>
                    <div class="space-y-3 flex-1 overflow-y-auto pr-1">
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase"
                                >Nama</label
                            >
                            <input
                                v-model="patientData.name"
                                type="text"
                                placeholder="Misal: Budi"
                                class="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-green-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase"
                                >Usia</label
                            >
                            <input
                                v-model="patientData.age"
                                type="text"
                                placeholder="Misal: 25 th"
                                class="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-green-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase"
                                >Keluhan</label
                            >
                            <textarea
                                v-model="patientData.complaint"
                                rows="4"
                                placeholder="Ceritakan kondisinya..."
                                class="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-green-500 outline-none resize-none transition-all"
                            ></textarea>
                        </div>
                    </div>
                    <div class="mt-4 flex gap-2 pt-2 border-t border-gray-100">
                        <button
                            @click="showPatientForm = false"
                            class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-bold text-xs hover:bg-gray-50"
                        >
                            Batal
                        </button>
                        <button
                            @click="startPatientRoleplay"
                            :disabled="!patientData.complaint"
                            class="flex-[2] py-2.5 rounded-xl bg-green-500 text-white font-bold text-xs shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            Mulai <ChevronRight class="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div
                    v-if="showSettings"
                    class="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col p-6 animate-in fade-in slide-in-from-top-4"
                >
                    <div class="flex justify-between items-center mb-6">
                        <h3
                            class="font-bold text-cozy-text text-lg flex items-center gap-2"
                        >
                            <Settings class="w-5 h-5" /> Pengaturan AI
                        </h3>
                        <button
                            @click="showSettings = false"
                            class="p-2 hover:bg-gray-100 rounded-full"
                        >
                            <X class="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                    <div class="space-y-5 flex-1 overflow-y-auto">
                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-1 flex items-center gap-1"
                                ><Brain class="w-3 h-3" /> AI Provider</label
                            >
                            <div class="grid grid-cols-3 gap-2">
                                <button
                                    v-for="(val, key) in providers"
                                    :key="key"
                                    @click="
                                        apiConfig.provider = key;
                                        changeProvider();
                                    "
                                    class="p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all"
                                    :class="
                                        apiConfig.provider === key
                                            ? 'border-cozy-primary bg-cozy-primary/5 text-cozy-primary'
                                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                    "
                                >
                                    <component :is="val.icon" class="w-4 h-4" />
                                    <span class="text-[10px] font-bold">{{
                                        val.name
                                    }}</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-1 flex items-center gap-1"
                                ><Bot class="w-3 h-3" /> Model</label
                            >
                            <select
                                v-model="apiConfig.model"
                                class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-cozy-primary outline-none"
                            >
                                <option
                                    v-for="m in providers[apiConfig.provider]
                                        .models"
                                    :key="m.id"
                                    :value="m.id"
                                >
                                    {{ m.name }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-1 flex items-center gap-1"
                                ><Key class="w-3 h-3" /> Custom API Key
                                (Optional)</label
                            >
                            <input
                                v-model="apiConfig.apiKey"
                                type="password"
                                placeholder="Paste API Key..."
                                class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-cozy-primary outline-none font-mono text-gray-600"
                            />
                            <p class="text-[9px] text-gray-400 mt-1">
                                *Kosongkan untuk pakai kuota gratis.
                            </p>
                        </div>

                        <div>
                            <label
                                class="text-[10px] font-bold text-cozy-muted uppercase mb-1 flex items-center gap-1"
                                ><Sliders class="w-3 h-3" /> Kreativitas:
                                {{ apiConfig.temperature }}</label
                            >
                            <input
                                type="range"
                                v-model="apiConfig.temperature"
                                min="0"
                                max="1"
                                step="0.1"
                                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cozy-primary"
                            />
                        </div>
                    </div>
                    <div class="mt-6 flex flex-col gap-2">
                        <button
                            @click="saveSettings"
                            class="w-full py-3 bg-cozy-primary text-white rounded-xl font-bold text-xs shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                        >
                            <Save class="w-4 h-4" /> Simpan
                        </button>
                        <button
                            @click="resetSettings"
                            class="w-full py-3 text-red-400 hover:text-red-600 font-bold text-xs flex items-center justify-center gap-2"
                        >
                            <Trash2 class="w-4 h-4" /> Reset
                        </button>
                    </div>
                </div>

                <div
                    ref="chatContainer"
                    class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30"
                >
                    <div
                        v-for="(msg, index) in messages"
                        :key="index"
                        class="flex gap-3"
                        :class="msg.role === 'user' ? 'flex-row-reverse' : ''"
                    >
                        <div
                            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border transition-colors"
                            :class="
                                msg.role === 'user'
                                    ? 'bg-white border-gray-100'
                                    : 'bg-white ' +
                                      (personas[activePersona]?.color ||
                                          'text-gray-500')
                            "
                        >
                            <User
                                v-if="msg.role === 'user'"
                                class="w-4 h-4 text-gray-600"
                            />
                            <component
                                v-else
                                :is="personas[activePersona]?.icon || Bot"
                                class="w-4 h-4"
                            />
                        </div>
                        <div
                            class="max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm prose-content"
                            :class="
                                msg.role === 'user'
                                    ? 'bg-white text-gray-700 rounded-tr-none border border-gray-100'
                                    : 'bg-cozy-card text-cozy-text rounded-tl-none border border-cozy-border'
                            "
                            v-html="marked.parse(msg.text)"
                        ></div>
                    </div>
                    <div v-if="isLoading" class="flex gap-3">
                        <div
                            class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center animate-pulse"
                        >
                            <Sparkles class="w-4 h-4 text-gray-400" />
                        </div>
                        <div
                            class="bg-gray-100/50 p-3 rounded-2xl rounded-tl-none text-xs text-gray-500 italic flex items-center gap-2"
                        >
                            <Loader2 class="w-3 h-3 animate-spin" /> Mengetik...
                        </div>
                    </div>
                </div>

                <div class="p-3 bg-white border-t border-gray-100 shrink-0">
                    <form @submit.prevent="sendMessage" class="relative">
                        <input
                            v-model="inputMessage"
                            type="text"
                            placeholder="Ketik pesan..."
                            class="w-full pl-4 pr-12 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-cozy-primary/20 outline-none transition-all placeholder:text-gray-400 font-medium"
                        />
                        <button
                            type="submit"
                            :disabled="!inputMessage || isLoading"
                            class="absolute right-2 top-2 p-1.5 bg-cozy-primary text-white rounded-lg hover:bg-cozy-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            <Send class="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>
        </transition>

        <button
            @click="toggleChat"
            class="group relative w-14 h-14 bg-cozy-card border border-cozy-border rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-all duration-300 pointer-events-auto"
        >
            <div
                class="absolute inset-0 bg-cozy-primary/10 rounded-full animate-ping opacity-20 group-hover:opacity-0"
            ></div>
            <transition name="rotate">
                <component
                    v-if="!isOpen"
                    :is="personas[activePersona].icon"
                    class="w-6 h-6 text-cozy-primary absolute"
                />
                <X v-else class="w-6 h-6 text-cozy-muted absolute" />
            </transition>
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
.no-scrollbar::-webkit-scrollbar {
    display: none;
}
.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.prose-content :deep(p) {
    margin-bottom: 0.5em;
}
.prose-content :deep(strong) {
    font-weight: 700;
    color: inherit;
}
.prose-content :deep(ul) {
    list-style: disc;
    padding-left: 1.2em;
}
.prose-content :deep(ol) {
    list-style: decimal;
    padding-left: 1.2em;
}
</style>
