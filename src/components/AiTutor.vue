<script setup>
import { ref, nextTick } from "vue";
import { marked } from "marked";
import { contextData } from "../data/aiContext.js";

// State
const isOpen = ref(false);
const userInput = ref("");
const isLoading = ref(false);
const messages = ref([
    {
        role: "model",
        text: "Halo Aiya! 👋 Ada materi Biopsikologi yang masih bingung? Tanya aku ya! 🐻",
    },
]);
const chatContainer = ref(null);

// API Config
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

// Fungsi Parse Markdown
const parseMarkdown = (text) => {
    return marked.parse(text);
};

// Logic Kirim Pesan
const sendMessage = async () => {
    if (!userInput.value.trim()) return;

    if (!apiKey) {
        messages.value.push({
            role: "model",
            text: "⚠️ Sayang, API Key-nya belum kebaca. Cek file .env ya!",
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
      History Chat: ${messages.value
          .slice(-6)
          .map((m) => `${m.role}: ${m.text}`)
          .join("\n")}
      User bertanya: ${userText}
      Instruksi: Jawablah dengan format Markdown yang rapi. Gunakan bold untuk poin penting. Jika perlu tabel, buat tabel markdown.
    `;

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
            }),
        });

        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error?.message || "Gagal menghubungi API");

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
            <div class="bg-cozy-primary p-4 flex items-center gap-3 shadow-sm">
                <div class="bg-white/20 backdrop-blur-md p-2 rounded-full">
                    🤖
                </div>
                <div>
                    <h3
                        class="text-white font-bold text-sm tracking-wide font-display"
                    >
                        Jiya Ai
                    </h3>
                    <p class="text-white/80 text-[10px] font-medium">
                        Powered by Gemini 2.5 flash
                    </p>
                </div>
            </div>

            <div
                ref="chatContainer"
                class="flex-1 overflow-y-auto p-4 space-y-4 bg-cozy-bg scroll-smooth"
            >
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
                class="p-3 bg-cozy-card border-t border-cozy-border transition-colors duration-300"
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
/* CSS Markdown yang Mengikuti Tema (Pakai Var CSS) */
.prose-content {
    line-height: 1.6;
}

/* Bold Text */
.prose-content strong {
    font-weight: 700;
    color: var(--c-primary); /* Mengikuti warna primary tema */
}

/* Headings (###) */
.prose-content h1,
.prose-content h2,
.prose-content h3 {
    font-weight: 700;
    margin-top: 12px;
    margin-bottom: 8px;
    color: var(--c-text); /* Mengikuti warna teks tema */
}

/* Lists (Bullet points) */
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

/* Tables */
.prose-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 0.9em;
    background-color: var(--c-card); /* Mengikuti background kartu */
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

/* Paragraphs */
.prose-content p {
    margin-bottom: 10px;
}
.prose-content p:last-child {
    margin-bottom: 0;
}

/* Animation */
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
