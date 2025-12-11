<script setup>
import { ref, nextTick, computed } from "vue";
import { marked } from "marked";
import { contextData } from "../data/aiContext.js";
import { Settings, Key, Check } from "lucide-vue-next";

// --- STATE ---
const isOpen = ref(false);
const showSettings = ref(false);
const userInput = ref("");
const isLoading = ref(false);
const messages = ref([
    {
        role: "model",
        text: "Halo Aiya! 👋 Siap belajar materi Biopsikologi? Tanya aku ya! 🐻",
    },
]);
const chatContainer = ref(null);

// --- KONFIGURASI 10 API KEY ---
const selectedKeyIndex = ref(1); // Default Key ke-1

// Ambil 10 Key dari .env
const apiKeys = {
    1: import.meta.env.VITE_GEMINI_API_KEY || "",
    2: import.meta.env.VITE_GEMINI_API_KEY_2 || "",
    3: import.meta.env.VITE_GEMINI_API_KEY_3 || "",
    4: import.meta.env.VITE_GEMINI_API_KEY_4 || "",
    5: import.meta.env.VITE_GEMINI_API_KEY_5 || "",
    6: import.meta.env.VITE_GEMINI_API_KEY_6 || "",
    7: import.meta.env.VITE_GEMINI_API_KEY_7 || "",
    8: import.meta.env.VITE_GEMINI_API_KEY_8 || "",
    9: import.meta.env.VITE_GEMINI_API_KEY_9 || "",
    10: import.meta.env.VITE_GEMINI_API_KEY_10 || "",
};

// URL API (HARDCODED ke Gemini 2.5 Flash sesuai request)
const currentApiUrl = computed(() => {
    const activeKey = apiKeys[selectedKeyIndex.value];
    return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
});

// Fungsi Parse Markdown
const parseMarkdown = (text) => marked.parse(text);

// --- KIRIM PESAN ---
const sendMessage = async () => {
    if (!userInput.value.trim()) return;

    // Cek Ketersediaan Key
    const currentKey = apiKeys[selectedKeyIndex.value];
    if (!currentKey) {
        messages.value.push({
            role: "model",
            text: `⚠️ Waduh, **API Key ke-${selectedKeyIndex.value}** belum diisi di file .env! Cek pengaturan ⚙️ dan pilih key lain.`,
        });
        return;
    }

    const userText = userInput.value;
    messages.value.push({ role: "user", text: userText });
    userInput.value = "";
    isLoading.value = true;
    scrollToBottom();

    try {
        const promptText = `
      ${contextData}

      [SISTEM INFO]
      Model: Gemini 2.5 Flash

      History Chat: ${messages.value
          .slice(-6)
          .map((m) => `${m.role}: ${m.text}`)
          .join("\n")}
      User bertanya: ${userText}
      Instruksi: Jawablah dengan format Markdown yang rapi.
    `;

        const response = await fetch(currentApiUrl.value, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.error?.code === 429) {
                throw new Error(
                    `Kuota Key-${selectedKeyIndex.value} Habis! Ganti ke nomor lain di pengaturan ⚙️`,
                );
            }
            throw new Error(data.error?.message || "Gagal menghubungi API");
        }

        const reply = data.candidates[0].content.parts[0].text;
        messages.value.push({ role: "model", text: reply });
    } catch (error) {
        console.error(error);
        messages.value.push({
            role: "model",
            text: `Duh error nih: ${error.message} 🥺`,
        });
    } finally {
        isLoading.value = false;
        scrollToBottom();
    }
};

const scrollToBottom = async () => {
    await nextTick();
    if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
};
</script>

<template>
    <div class="fixed bottom-6 right-6 z-[9999] font-sans">
        <button
            @click="isOpen = !isOpen"
            class="relative group bg-cozy-card p-1.5 rounded-full shadow-soft hover:shadow-lg transition-all hover:-translate-y-1 active:scale-95 border border-cozy-border"
        >
            <div
                class="bg-gradient-to-br from-cozy-primary to-rose-400 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-inner border-2 border-white/20"
            >
                <span v-if="!isOpen" class="text-2xl animate-bounce">🤖</span>
                <span v-else class="text-xl font-bold">✕</span>
            </div>
        </button>

        <div
            v-if="isOpen"
            class="absolute bottom-20 right-0 w-[90vw] md:w-[400px] bg-cozy-card rounded-3xl shadow-2xl border border-cozy-border overflow-hidden flex flex-col h-[600px] origin-bottom-right animate-scale-up ring-1 ring-black/5"
        >
            <div
                class="bg-cozy-primary p-4 flex items-center justify-between shadow-sm relative z-10"
            >
                <div class="flex items-center gap-3">
                    <div class="bg-white/20 backdrop-blur-md p-2 rounded-full">
                        🤖
                    </div>
                    <div>
                        <h3
                            class="text-white font-bold text-sm tracking-wide font-display"
                        >
                            Tutor Aiya
                        </h3>
                        <p
                            class="text-white/80 text-[10px] font-medium flex items-center gap-1"
                        >
                            <span
                                class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"
                            ></span>
                            Gemini 2.5 Flash (Key-{{ selectedKeyIndex }})
                        </p>
                    </div>
                </div>

                <button
                    @click="showSettings = !showSettings"
                    class="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-all"
                    :class="{ 'bg-white/30 rotate-90': showSettings }"
                    title="Pengaturan API Key"
                >
                    <Settings class="w-5 h-5" />
                </button>
            </div>

            <div
                v-if="showSettings"
                class="absolute top-[70px] left-0 w-full bg-cozy-card/95 backdrop-blur-xl border-b border-cozy-border p-5 z-20 shadow-lg animate-slide-down"
            >
                <h4
                    class="text-xs font-bold text-cozy-muted uppercase mb-4 tracking-wider"
                >
                    Ganti "Nyawa" (API Key)
                </h4>

                <div>
                    <label
                        class="flex items-center gap-2 text-sm font-bold text-cozy-text mb-3"
                    >
                        <Key class="w-4 h-4 text-cozy-primary" /> Pilih Slot
                        Kunci:
                    </label>

                    <div class="grid grid-cols-5 gap-2">
                        <button
                            v-for="i in 10"
                            :key="i"
                            @click="selectedKeyIndex = i"
                            class="aspect-square flex items-center justify-center rounded-lg text-xs font-bold border transition-all relative overflow-hidden"
                            :class="
                                selectedKeyIndex === i
                                    ? 'bg-cozy-primary text-white border-cozy-primary shadow-md'
                                    : 'border-cozy-border text-cozy-text hover:bg-cozy-bg'
                            "
                            :title="
                                apiKeys[i]
                                    ? 'Siap digunakan'
                                    : 'Kosong (Isi di .env)'
                            "
                        >
                            {{ i }}
                            <span
                                v-if="!apiKeys[i]"
                                class="absolute bottom-0 left-0 w-full h-1 bg-red-400/50"
                            ></span>
                            <Check
                                v-if="selectedKeyIndex === i"
                                class="absolute top-0.5 right-0.5 w-2 h-2 text-white/80"
                            />
                        </button>
                    </div>

                    <p class="text-[10px] text-cozy-muted mt-3 text-center">
                        *Merah = Kunci belum diisi di .env
                    </p>
                </div>
            </div>

            <div
                ref="chatContainer"
                class="flex-1 overflow-y-auto p-4 space-y-4 bg-cozy-bg scroll-smooth relative"
            >
                <div
                    v-if="showSettings"
                    @click="showSettings = false"
                    class="absolute inset-0 bg-cozy-bg/50 z-10 backdrop-blur-[1px]"
                ></div>

                <div
                    v-for="(msg, index) in messages"
                    :key="index"
                    class="flex"
                    :class="
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                    "
                >
                    <div
                        class="max-w-[85%] px-4 py-3 text-sm shadow-sm transition-colors duration-300"
                        :class="
                            msg.role === 'user'
                                ? 'bg-cozy-primary text-white rounded-2xl rounded-tr-none'
                                : 'bg-cozy-card text-cozy-text border border-cozy-border rounded-2xl rounded-tl-none'
                        "
                    >
                        <div
                            v-if="msg.role === 'model'"
                            class="prose-content"
                            v-html="parseMarkdown(msg.text)"
                        ></div>
                        <div v-else>
                            {{ msg.text }}
                        </div>
                    </div>
                </div>

                <div v-if="isLoading" class="flex justify-start">
                    <div
                        class="bg-cozy-card border border-cozy-border px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center transition-colors duration-300"
                    >
                        <div
                            class="w-1.5 h-1.5 bg-cozy-secondary rounded-full animate-bounce"
                        ></div>
                        <div
                            class="w-1.5 h-1.5 bg-cozy-secondary rounded-full animate-bounce delay-75"
                        ></div>
                        <div
                            class="w-1.5 h-1.5 bg-cozy-secondary rounded-full animate-bounce delay-150"
                        ></div>
                    </div>
                </div>
            </div>

            <div
                class="p-3 bg-cozy-card border-t border-cozy-border transition-colors duration-300 relative z-20"
            >
                <form
                    @submit.prevent="sendMessage"
                    class="flex items-center gap-2 bg-cozy-bg p-1.5 rounded-full border border-cozy-border focus-within:border-cozy-primary/50 transition-colors duration-300"
                >
                    <input
                        v-model="userInput"
                        type="text"
                        placeholder="Tanya materi..."
                        class="flex-1 bg-transparent text-cozy-text text-sm px-3 py-2 outline-none placeholder:text-cozy-muted font-sans"
                    />
                    <button
                        type="submit"
                        :disabled="isLoading || !userInput"
                        class="bg-cozy-primary text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-cozy-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        ➤
                    </button>
                </form>
            </div>
        </div>
    </div>
</template>

<style>
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.animate-slide-down {
    animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.prose-content {
    line-height: 1.6;
}
.prose-content strong {
    font-weight: 700;
    color: var(--c-primary);
}
.prose-content h1,
.prose-content h2,
.prose-content h3 {
    font-weight: 700;
    margin-top: 12px;
    margin-bottom: 8px;
    color: var(--c-text);
}
.prose-content ul,
.prose-content ol {
    margin-left: 10px;
    margin-bottom: 10px;
    list-style-type: disc;
    padding-left: 1.2em;
}
.prose-content li {
    margin-bottom: 4px;
}
.prose-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 0.9em;
    background-color: var(--c-card);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}
.prose-content th {
    background-color: var(--c-primary);
    color: white;
    text-align: left;
    padding: 8px 12px;
    font-weight: 600;
}
.prose-content td {
    border-bottom: 1px solid var(--c-border);
    padding: 8px 12px;
    color: var(--c-text);
}
.prose-content tr:last-child td {
    border-bottom: none;
}
.prose-content p {
    margin-bottom: 10px;
}
.prose-content p:last-child {
    margin-bottom: 0;
}
@keyframes scaleUp {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
.animate-scale-up {
    animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
