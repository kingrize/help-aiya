<script setup>
import { ref, nextTick, watch, computed } from "vue";
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
    Save,
    Check,
    ChevronDown,
    Layers,
    BookOpen,
    Dice5,
    Smile,
    Zap,
    Cloud,
    MessageCircle,
    Lightbulb,
    RefreshCw,
    ChevronRight,
} from "lucide-vue-next";

// --- KONFIGURASI PROVIDER ---
const availableKeys = {
    gemini: geminiKeys,
    groq: groqKeys,
    aiml: aimlKeys,
    hybrid: [],
};
const apiConfig = ref({
    provider: localStorage.getItem("user_ai_provider") || "hybrid",
    model: localStorage.getItem("user_ai_model") || "gemini-2.5-flash",
    temperature: parseFloat(localStorage.getItem("user_ai_temp") || 0.7),
    keyPrefs: JSON.parse(
        localStorage.getItem("user_ai_key_prefs") ||
            '{"gemini":"auto","groq":"auto","aiml":"auto"}',
    ),
});

const providers = {
    hybrid: {
        name: "Hybrid Auto",
        icon: Layers,
        desc: "Otomatis pilih AI terbaik & tercepat.",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
    },
    gemini: {
        name: "Google Gemini",
        icon: Sparkles,
        desc: "Seimbang antara kreatif & logis.",
        color: "text-blue-600",
        bg: "bg-blue-50",
    },
    aiml: {
        name: "GPT-4o",
        icon: Cloud,
        desc: "Kecerdasan tingkat tinggi.",
        color: "text-purple-600",
        bg: "bg-purple-50",
    },
    groq: {
        name: "Groq Llama 3",
        icon: Zap,
        desc: "Respon super instan.",
        color: "text-orange-600",
        bg: "bg-orange-50",
    },
};

// --- KONFIGURASI PERSONA (DENGAN TEMA & QUICK STARTERS) ---
const personas = {
    tutor: {
        id: "tutor",
        name: "Jiya",
        role: "Teman Belajar",
        icon: Smile,
        theme: "pink", // Base theme color
        gradient: "from-pink-500 to-rose-400",
        lightBg: "bg-pink-50",
        textColor: "text-pink-600",
        desc: "Jelasin materi susah jadi gampang pake analogi!",
        basePrompt: `PERAN: "Jiya", teman belajar ceria. GAYA: Santai, gaul, emoji 🌟. INSTRUKSI: 1. Pakai analogi sederhana. 2. Jawaban poin-poin. 3. Akhiri dengan pertanyaan pancingan.`,
        starters: [
            "Jelasin konsep Vue Reactivity dong 🌟",
            "Gimana cara styling CSS biar rapi?",
            "Apa bedanya `ref` dan `reactive`?",
            "Buatin analogi tentang API dong!",
        ],
    },
    patient: {
        id: "patient",
        name: "Pasien",
        role: "Simulasi Kasus",
        icon: Stethoscope,
        theme: "emerald",
        gradient: "from-emerald-500 to-teal-400",
        lightBg: "bg-emerald-50",
        textColor: "text-emerald-600",
        desc: "Latihan anamnesa & diagnosa kasus klinis.",
        basePrompt: null,
        starters: [
            "Mulai simulasi pasien baru dong 🏥",
            "Saya mau latihan diagnosa depresi.",
            "Generate kasus pasien cemas.",
        ],
    },
    examiner: {
        id: "examiner",
        name: "Prof. Dosen",
        role: "Ujian Lisan",
        icon: BookOpen,
        theme: "violet",
        gradient: "from-violet-600 to-purple-500",
        lightBg: "bg-violet-50",
        textColor: "text-violet-600",
        desc: "Mode serius. Siapkan mentalmu!",
        basePrompt: `Anda Dosen Penguji. Gaya: Formal, Kritis, Tajam. Gunakan Socratic Method. Jangan beri jawaban, tapi tanya balik.`,
        starters: [
            "Saya siap diuji materinya Prof! 🎓",
            "Tes pemahaman saya tentang State Management.",
            "Kritik struktur kodingan saya.",
        ],
    },
};

// --- STATE ---
const dummyPatients = [
    {
        name: "Andi",
        age: "22 th",
        complaint: "Cemas berlebih saat presentasi.",
    },
    { name: "Siti", age: "19 th", complaint: "Sering menangis tanpa sebab." },
    {
        name: "Budi",
        age: "28 th",
        complaint: "Merasa hampa padahal karir sukses.",
    },
];

const isOpen = ref(false);
const showSettings = ref(false);
const showPersonaMenu = ref(false);
const inputMessage = ref("");
const isLoading = ref(false);
const chatContainer = ref(null);
const messages = ref([]);
const activePersona = ref("tutor");
const showPatientForm = ref(false);
const patientData = ref({ name: "", age: "", complaint: "" });
const activeSystemPrompt = ref("");
const isHovered = ref(false);

// --- API LOGIC (Simplified for brevity but robust) ---
const fetchAI = async (provider, model, msgs, key, temp) => {
    // Logic fetch sama seperti sebelumnya...
    if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const contents = msgs.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
        }));
        if (activeSystemPrompt.value)
            contents.unshift({
                role: "user",
                parts: [{ text: "SYSTEM: " + activeSystemPrompt.value }],
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
    } else {
        const endpoint =
            provider === "groq"
                ? "https://api.groq.com/openai/v1/chat/completions"
                : "https://api.aimlapi.com/v1/chat/completions";
        const messages = msgs.map((m) => ({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text,
        }));
        if (activeSystemPrompt.value)
            messages.unshift({
                role: "system",
                content: activeSystemPrompt.value,
            });
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ model, messages, temperature: temp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "API Error");
        return data.choices[0].message.content;
    }
};

const callAiApi = async (msgs) => {
    // Hybrid Strategy Logic...
    const keys = availableKeys;
    const tryKey = async (p, m) => {
        let k = keys[p];
        if (!k?.length) return null;
        const key = k[Math.floor(Math.random() * k.length)];
        return await fetchAI(p, m, msgs, key, apiConfig.value.temperature);
    };

    if (apiConfig.value.provider === "hybrid") {
        for (let s of [
            { p: "gemini", m: "gemini-2.5-flash" },
            { p: "aiml", m: "gpt-4o" },
            { p: "groq", m: "llama-3.3-70b-versatile" },
        ]) {
            try {
                return await tryKey(s.p, s.m);
            } catch (e) {
                continue;
            }
        }
        throw new Error("Semua sistem AI sibuk.");
    }
    return await tryKey(apiConfig.value.provider, apiConfig.value.model);
};

// --- ACTIONS ---
const toggleChat = () => {
    playPop();
    isOpen.value = !isOpen.value;
    if (isOpen.value && !messages.value.length) setPersona("tutor");
};
const closeChat = () => (isOpen.value = false);
const sendMessage = async (text = null) => {
    const msgToSend = text || inputMessage.value;
    if (!msgToSend.trim() || isLoading.value) return;

    messages.value.push({ role: "user", text: msgToSend });
    inputMessage.value = "";
    isLoading.value = true;
    scrollToBottom();

    try {
        const response = await callAiApi(messages.value);
        messages.value.push({ role: "model", text: response });
    } catch (error) {
        messages.value.push({
            role: "model",
            text: `⚠️ **Error:** ${error.message}`,
        });
    } finally {
        isLoading.value = false;
        scrollToBottom();
    }
};
const scrollToBottom = () =>
    nextTick(
        () =>
            chatContainer.value &&
            (chatContainer.value.scrollTop = chatContainer.value.scrollHeight),
    );

// --- UTILS ---
const setPersona = (id) => {
    activePersona.value = id;
    showPersonaMenu.value = false;
    if (id === "patient") {
        showPatientForm.value = true;
        return;
    }
    startSession(id, personas[id].basePrompt);
};
const startSession = (id, prompt, greeting) => {
    activeSystemPrompt.value = prompt;
    messages.value = [];
    showPatientForm.value = false;
    // Greeting otomatis dihilangkan agar lebih bersih, kecuali mode tertentu
    // Kita biarkan user memilih topik dari "Quick Starters"
};
const startPatientRoleplay = () => {
    if (!patientData.value.complaint) return;
    startSession(
        "patient",
        `PERAN: Pasien ${patientData.value.name}, ${patientData.value.age}, Sakit: ${patientData.value.complaint}`,
        `Halo Dok..`,
    );
    // Simulasi pesan pertama dari pasien
    messages.value.push({
        role: "model",
        text: `(Masuk ruangan dengan wajah murung) "Permisi dok... nama saya ${patientData.value.name}..."`,
    });
};
const generateRandomPatient = () =>
    (patientData.value = {
        ...dummyPatients[Math.floor(Math.random() * dummyPatients.length)],
    });
const saveSettings = () => {
    localStorage.setItem("user_ai_provider", apiConfig.value.provider);
    showSettings.value = false;
    playPop();
};

defineExpose({
    openWithQuestion: (q) => {
        if (!isOpen.value) toggleChat();
        setPersona("tutor");
        setTimeout(() => sendMessage(`Jelaskan: ${q}`), 500);
    },
});
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-[9990] pointer-events-none font-sans flex flex-col items-end justify-end p-4 sm:p-6"
        >
            <div
                class="pointer-events-auto relative z-50 flex flex-col items-end gap-3 mb-safe"
            >
                <button
                    @click="toggleChat"
                    @mouseenter="isHovered = true"
                    @mouseleave="isHovered = false"
                    class="group flex items-center gap-3 pl-5 pr-2 py-2.5 bg-white border border-white/20 shadow-2xl rounded-full transition-all duration-500 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xl"
                    :class="
                        isOpen
                            ? 'bg-cozy-text ring-0'
                            : 'hover:ring-4 ring-cozy-primary/20'
                    "
                >
                    <div class="flex flex-col items-start leading-none mr-1">
                        <span
                            class="text-[13px] font-bold transition-colors"
                            :class="isOpen ? 'text-white' : 'text-cozy-text'"
                            >{{ isOpen ? "Tutup Chat" : "Tanya Jiya" }}</span
                        >
                        <span
                            v-if="!isOpen"
                            class="text-[10px] text-cozy-muted font-medium mt-0.5"
                            >AI Tutor</span
                        >
                    </div>

                    <div
                        class="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 relative shadow-inner"
                        :class="
                            isOpen
                                ? 'bg-white/10 rotate-90'
                                : 'bg-gradient-to-br from-cozy-primary to-rose-400 text-white group-hover:rotate-12'
                        "
                    >
                        <X v-if="isOpen" class="w-6 h-6 text-white" />
                        <Smile v-else class="w-6 h-6" />
                    </div>
                </button>
            </div>

            <transition name="fade">
                <div
                    v-if="isOpen"
                    @click="closeChat"
                    class="fixed inset-0 bg-cozy-text/20 backdrop-blur-[4px] z-[9998] transition-opacity pointer-events-auto"
                ></div>
            </transition>

            <transition name="slide-up">
                <div
                    v-if="isOpen"
                    class="fixed z-[9999] bg-[#FDFDFD] font-sans text-cozy-text shadow-2xl overflow-hidden flex flex-col pointer-events-auto inset-x-0 bottom-0 h-[85vh] rounded-t-[32px] border-t border-white/80 ring-1 ring-black/5 md:inset-auto md:bottom-24 md:right-8 md:w-[420px] md:h-[650px] md:rounded-[28px] md:border md:border-white/60"
                >
                    <div
                        class="md:hidden w-full h-7 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing bg-white"
                        @click="closeChat"
                    >
                        <div
                            class="w-12 h-1 bg-gray-200 rounded-full mt-2"
                        ></div>
                    </div>

                    <div
                        class="px-5 py-4 border-b border-gray-100 flex justify-between items-start bg-white sticky top-0 z-20 transition-colors duration-500 relative overflow-hidden"
                    >
                        <div
                            class="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[50px] opacity-40 pointer-events-none"
                            :class="`bg-${personas[activePersona].theme}-400`"
                        ></div>

                        <div class="flex items-center gap-3 relative z-10">
                            <div
                                class="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm text-white bg-gradient-to-br"
                                :class="personas[activePersona].gradient"
                            >
                                <component
                                    :is="personas[activePersona].icon"
                                    class="w-5 h-5"
                                />
                            </div>

                            <div>
                                <div
                                    class="flex items-center gap-2 cursor-pointer group"
                                    @click="showPersonaMenu = !showPersonaMenu"
                                >
                                    <h3
                                        class="font-bold text-base leading-tight"
                                    >
                                        {{ personas[activePersona].name }}
                                    </h3>
                                    <ChevronDown
                                        class="w-3.5 h-3.5 text-gray-400 transition-transform group-hover:text-cozy-primary"
                                        :class="
                                            showPersonaMenu ? 'rotate-180' : ''
                                        "
                                    />
                                </div>
                                <p class="text-xs text-gray-400 font-medium">
                                    {{ personas[activePersona].role }}
                                </p>
                            </div>
                        </div>

                        <button
                            @click="showSettings = !showSettings"
                            class="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-cozy-text transition-colors relative z-10"
                        >
                            <Settings class="w-5 h-5" />
                        </button>
                    </div>

                    <transition name="accordion">
                        <div
                            v-if="showPersonaMenu"
                            class="bg-gray-50/80 border-b border-gray-100 backdrop-blur-sm z-10 max-h-64 overflow-y-auto"
                        >
                            <div class="p-2 space-y-1">
                                <button
                                    v-for="p in personas"
                                    :key="p.id"
                                    @click="setPersona(p.id)"
                                    class="w-full flex items-center gap-3 p-3 rounded-xl transition-all border border-transparent"
                                    :class="
                                        activePersona === p.id
                                            ? 'bg-white shadow-sm border-gray-100'
                                            : 'hover:bg-white/50'
                                    "
                                >
                                    <div
                                        class="w-8 h-8 rounded-full flex items-center justify-center"
                                        :class="p.lightBg"
                                    >
                                        <component
                                            :is="p.icon"
                                            class="w-4 h-4"
                                            :class="p.textColor"
                                        />
                                    </div>
                                    <div class="text-left flex-1">
                                        <h4
                                            class="text-sm font-bold"
                                            :class="
                                                activePersona === p.id
                                                    ? 'text-cozy-text'
                                                    : 'text-gray-500'
                                            "
                                        >
                                            {{ p.name }}
                                        </h4>
                                        <p
                                            class="text-[10px] text-gray-400 line-clamp-1"
                                        >
                                            {{ p.desc }}
                                        </p>
                                    </div>
                                    <Check
                                        v-if="activePersona === p.id"
                                        class="w-4 h-4 text-cozy-primary"
                                    />
                                </button>
                            </div>
                        </div>
                    </transition>

                    <div
                        ref="chatContainer"
                        class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 scroll-smooth bg-[#FAFAFA] relative"
                    >
                        <div
                            v-if="messages.length === 0 && !showPatientForm"
                            class="flex flex-col items-center justify-center h-full pb-10 fade-in"
                        >
                            <div
                                class="w-16 h-16 rounded-3xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-4"
                            >
                                <component
                                    :is="personas[activePersona].icon"
                                    class="w-8 h-8 opacity-80"
                                    :class="personas[activePersona].textColor"
                                />
                            </div>
                            <h3 class="font-bold text-gray-700 text-lg mb-1">
                                Hai, ada yang bisa dibantu?
                            </h3>
                            <p
                                class="text-xs text-gray-400 mb-8 text-center max-w-[200px]"
                            >
                                {{ personas[activePersona].desc }}
                            </p>

                            <div class="w-full max-w-xs space-y-2">
                                <button
                                    v-for="(q, idx) in personas[activePersona]
                                        .starters"
                                    :key="idx"
                                    @click="sendMessage(q)"
                                    class="w-full text-left p-3.5 bg-white hover:bg-white border border-gray-100 hover:border-cozy-primary/30 rounded-2xl shadow-sm hover:shadow-md transition-all group flex items-center justify-between"
                                >
                                    <span
                                        class="text-sm font-medium text-gray-600 group-hover:text-cozy-primary transition-colors"
                                        >{{ q }}</span
                                    >
                                    <ChevronRight
                                        class="w-4 h-4 text-gray-300 group-hover:text-cozy-primary"
                                    />
                                </button>
                            </div>
                        </div>

                        <div
                            v-for="(msg, i) in messages"
                            :key="i"
                            class="flex gap-3 group fade-in-up"
                            :class="
                                msg.role === 'user' ? 'flex-row-reverse' : ''
                            "
                        >
                            <div
                                class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white bg-white mt-1"
                            >
                                <User
                                    v-if="msg.role === 'user'"
                                    class="w-4 h-4 text-gray-400"
                                />
                                <component
                                    v-else
                                    :is="personas[activePersona].icon"
                                    class="w-4 h-4"
                                    :class="personas[activePersona].textColor"
                                />
                            </div>
                            <div
                                class="max-w-[85%] px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed shadow-sm break-words"
                                :class="
                                    msg.role === 'user'
                                        ? 'bg-cozy-primary text-white rounded-tr-sm'
                                        : 'bg-white text-gray-700 border border-gray-100 rounded-tl-sm'
                                "
                            >
                                <div
                                    class="prose prose-sm max-w-none"
                                    :class="
                                        msg.role === 'user'
                                            ? 'prose-invert'
                                            : ''
                                    "
                                    v-html="marked.parse(msg.text)"
                                ></div>
                            </div>
                        </div>

                        <div
                            v-if="isLoading"
                            class="flex gap-3 items-center text-gray-400 text-xs italic pl-12 fade-in"
                        >
                            <Loader2 class="w-3.5 h-3.5 animate-spin" /> Sedang
                            mengetik...
                        </div>
                    </div>

                    <div
                        class="p-3 sm:p-4 bg-white border-t border-gray-100 shrink-0 pb-safe z-30"
                    >
                        <form
                            @submit.prevent="sendMessage()"
                            class="relative flex items-end gap-2 bg-gray-50 p-1.5 rounded-[24px] border border-gray-200 focus-within:border-cozy-primary/50 focus-within:bg-white focus-within:shadow-md transition-all duration-300"
                        >
                            <textarea
                                v-model="inputMessage"
                                @keydown.enter.exact.prevent="sendMessage()"
                                placeholder="Ketik pesan..."
                                rows="1"
                                class="flex-1 bg-transparent border-none text-sm px-4 py-2.5 focus:ring-0 outline-none resize-none max-h-32 text-gray-700 placeholder:text-gray-400"
                                style="min-height: 44px"
                            ></textarea>
                            <button
                                type="submit"
                                :disabled="!inputMessage || isLoading"
                                class="p-2.5 rounded-full text-white shadow-sm transition-all duration-300 shrink-0 mb-0.5 mr-0.5"
                                :class="
                                    inputMessage
                                        ? 'bg-cozy-primary hover:scale-105 active:scale-95'
                                        : 'bg-gray-300 cursor-not-allowed'
                                "
                            >
                                <Send
                                    class="w-4 h-4"
                                    :class="inputMessage ? 'ml-0.5' : ''"
                                />
                            </button>
                        </form>
                        <p
                            class="text-[10px] text-center text-gray-300 mt-2 font-medium"
                        >
                            AI Powered by
                            <span class="capitalize">{{
                                apiConfig.provider
                            }}</span>
                        </p>
                    </div>

                    <div
                        v-if="showSettings"
                        class="absolute inset-0 z-50 bg-white/95 backdrop-blur-md p-6 flex flex-col animate-in fade-in zoom-in-95 pointer-events-auto"
                    >
                        <div class="flex justify-between items-center mb-6">
                            <h3
                                class="font-bold text-lg flex items-center gap-2"
                            >
                                <Settings class="w-5 h-5 text-gray-400" />
                                Pengaturan AI
                            </h3>
                            <button
                                @click="showSettings = false"
                                class="p-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X class="w-5 h-5" />
                            </button>
                        </div>
                        <div class="space-y-4 flex-1 overflow-y-auto pr-2">
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1"
                                    >Pilih Otak AI</label
                                >
                                <button
                                    v-for="(v, k) in providers"
                                    :key="k"
                                    @click="apiConfig.provider = k"
                                    class="w-full p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all relative group"
                                    :class="
                                        apiConfig.provider === k
                                            ? 'border-cozy-primary bg-cozy-primary/5 ring-1 ring-cozy-primary/50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    "
                                >
                                    <div
                                        class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                        :class="v.bg"
                                    >
                                        <component
                                            :is="v.icon"
                                            class="w-5 h-5"
                                            :class="v.color"
                                        />
                                    </div>
                                    <div class="flex-1">
                                        <div
                                            class="font-bold text-sm text-gray-800"
                                        >
                                            {{ v.name }}
                                        </div>
                                        <div
                                            class="text-[11px] text-gray-500 leading-tight mt-0.5"
                                        >
                                            {{ v.desc }}
                                        </div>
                                    </div>
                                    <div
                                        class="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center"
                                        :class="
                                            apiConfig.provider === k
                                                ? 'bg-cozy-primary border-transparent'
                                                : ''
                                        "
                                    >
                                        <Check
                                            v-if="apiConfig.provider === k"
                                            class="w-3 h-3 text-white"
                                        />
                                    </div>
                                </button>
                            </div>
                        </div>
                        <button
                            @click="saveSettings"
                            class="w-full py-3.5 bg-cozy-text text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all mt-4"
                        >
                            Simpan Perubahan
                        </button>
                    </div>

                    <div
                        v-if="showPatientForm"
                        class="absolute inset-0 z-40 bg-white p-6 flex flex-col animate-in slide-in-from-bottom-10 pointer-events-auto"
                    >
                        <h3
                            class="font-bold text-lg mb-6 flex gap-2 items-center text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100"
                        >
                            <Stethoscope class="w-5 h-5" /> Data Pasien Baru
                        </h3>
                        <div class="space-y-4 flex-1">
                            <div class="flex gap-3">
                                <input
                                    v-model="patientData.name"
                                    placeholder="Nama"
                                    class="flex-1 p-3.5 bg-gray-50 rounded-xl text-sm border-transparent focus:bg-white focus:border-emerald-500 border outline-none transition-all"
                                />
                                <input
                                    v-model="patientData.age"
                                    placeholder="Usia"
                                    class="w-24 p-3.5 bg-gray-50 rounded-xl text-sm border-transparent focus:bg-white focus:border-emerald-500 border outline-none transition-all"
                                />
                            </div>
                            <textarea
                                v-model="patientData.complaint"
                                placeholder="Keluhan Utama..."
                                rows="4"
                                class="w-full p-3.5 bg-gray-50 rounded-xl text-sm border-transparent focus:bg-white focus:border-emerald-500 border outline-none transition-all resize-none"
                            ></textarea>

                            <button
                                @click="generateRandomPatient"
                                class="w-full py-2.5 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-xl border border-emerald-100 border-dashed hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Dice5 class="w-4 h-4" /> Generate Kasus Acak
                            </button>
                        </div>
                        <div
                            class="flex gap-3 mt-4 pt-4 border-t border-gray-100"
                        >
                            <button
                                @click="showPatientForm = false"
                                class="flex-1 py-3 text-gray-500 font-bold text-sm hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                @click="startPatientRoleplay"
                                :disabled="!patientData.complaint"
                                class="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-600 transition-all"
                            >
                                Mulai Konsultasi
                            </button>
                        </div>
                    </div>
                </div>
            </transition>
        </div>
    </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(110%);
    opacity: 0;
}
@media (min-width: 768px) {
    .slide-up-enter-from,
    .slide-up-leave-to {
        transform: translateY(20px) scale(0.95);
        opacity: 0;
    }
}

.accordion-enter-active,
.accordion-leave-active {
    transition: all 0.3s ease;
    max-height: 300px;
    opacity: 1;
}
.accordion-enter-from,
.accordion-leave-to {
    max-height: 0;
    opacity: 0;
}

.fade-in {
    animation: fadeIn 0.5s ease-out forwards;
}
.fade-in-up {
    animation: fadeInUp 0.4s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 20px);
}
.mb-safe {
    margin-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
