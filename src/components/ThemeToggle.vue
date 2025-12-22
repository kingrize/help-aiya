<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router"; // Wajib untuk auto-close
import {
    Palette,
    X,
    Check,
    Moon,
    Sun,
    Zap,
    Coffee,
    Plus,
} from "lucide-vue-next";
import { playPop } from "../utils/sound.js";

// --- SETUP ROUTER ---
const router = useRouter();

// --- STATE ---
const isOpen = ref(false);
const customColorInput = ref("#e68e8e");
const activeMode = ref("cozy"); // 'cozy' | 'focus'
const isDarkMode = ref(false);

const presets = [
    { id: "rose", color: "#e68e8e" },
    { id: "sage", color: "#9fb8ad" },
    { id: "sky", color: "#8eace6" },
];

// --- LOGIC: AUTO CLOSE MENU SAAT PINDAH HALAMAN ---
const unwatchRouter = router.afterEach(() => {
    isOpen.value = false;
});
onUnmounted(() => unwatchRouter());

// --- HELPER: HEX to HSL ---
const hexToHSL = (H) => {
    let r = 0,
        g = 0,
        b = 0;
    if (H.length == 4) {
        r = "0x" + H[1] + H[1];
        g = "0x" + H[2] + H[2];
        b = "0x" + H[3] + H[3];
    } else if (H.length == 7) {
        r = "0x" + H[1] + H[2];
        g = "0x" + H[3] + H[4];
        b = "0x" + H[5] + H[6];
    }
    r /= 255;
    g /= 255;
    b /= 255;
    let cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin;
    let h = 0,
        s = 0,
        l = 0;
    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return { h, s, l };
};

// --- CORE LOGIC: THEME APPLICATION ---
watch(
    [activeMode, isDarkMode, customColorInput],
    () => {
        const root = document.documentElement;
        const hexColor = customColorInput.value;

        // 1. Handle Dark Class (Global)
        if (isDarkMode.value) root.classList.add("dark");
        else root.classList.remove("dark");

        // 2. CSS Variables
        if (activeMode.value === "focus") {
            // Focus Mode (Paper Style)
            root.style.setProperty("--c-bg", `#fdfbf7`);
            root.style.setProperty("--c-card", `#ffffff`);
            root.style.setProperty("--c-text", `#111827`);
            root.style.setProperty("--c-text-muted", `#4b5563`);
            root.style.setProperty("--c-primary", `#262626`);
            root.style.setProperty("--c-border", `#e5e7eb`);
            root.style.setProperty("--c-shadow", `rgba(0, 0, 0, 0.05)`);
        } else {
            // Cozy Mode
            const { h } = hexToHSL(hexColor);
            if (isDarkMode.value) {
                root.style.setProperty("--c-bg", `#0f172a`);
                root.style.setProperty("--c-card", `rgba(30, 41, 59, 0.7)`);
                root.style.setProperty("--c-text", `#e2e8f0`);
                root.style.setProperty("--c-text-muted", `#94a3b8`);
                root.style.setProperty(
                    "--c-border",
                    `rgba(148, 163, 184, 0.15)`,
                );
                root.style.setProperty("--c-primary", `hsl(${h}, 70%, 75%)`);
                root.style.setProperty(
                    "--c-shadow",
                    `hsla(${h}, 70%, 70%, 0.15)`,
                );
            } else {
                root.style.setProperty("--c-bg", `hsl(${h}, 30%, 97%)`);
                root.style.setProperty("--c-card", `rgba(255, 255, 255, 0.85)`);
                root.style.setProperty("--c-text", `#4b5563`);
                root.style.setProperty("--c-text-muted", `#6b7280`);
                root.style.setProperty(
                    "--c-border",
                    `hsla(${h}, 30%, 80%, 0.5)`,
                );
                root.style.setProperty("--c-primary", `hsl(${h}, 60%, 75%)`);
                root.style.setProperty(
                    "--c-shadow",
                    `hsla(${h}, 60%, 75%, 0.2)`,
                );
            }
        }

        // 3. Save Preference
        localStorage.setItem("user-theme-mode", activeMode.value);
        localStorage.setItem("user-custom-color", hexColor);
        localStorage.setItem("user-dark-mode", isDarkMode.value);
    },
    { deep: true },
);

// --- COMPUTED STYLES ---
const themeColorStyle = computed(() => {
    if (activeMode.value === "focus") return "#1f2937";
    if (isDarkMode.value) return "#818cf8";
    return customColorInput.value;
});

// Force Background Putih di Light Mode
const currentButtonBg = computed(() => {
    if (isDarkMode.value)
        return "bg-slate-800 border-slate-700 shadow-xl shadow-black/30";
    return "!bg-white border-white/60 shadow-xl shadow-gray-200/50";
});

// --- ACTIONS ---
const toggleMenu = () => {
    playPop();
    isOpen.value = !isOpen.value;
};

const toggleDarkMode = () => {
    playPop();
    if (activeMode.value === "focus") activeMode.value = "cozy";
    isDarkMode.value = !isDarkMode.value;
};

const selectPreset = (color) => {
    playPop();
    activeMode.value = "cozy";
    isDarkMode.value = false; // Auto Light
    customColorInput.value = color;
};

const handleCustomColor = (e) => {
    activeMode.value = "cozy";
    isDarkMode.value = false;
    customColorInput.value = e.target.value;
};

// --- INIT ---
onMounted(() => {
    const savedMode = localStorage.getItem("user-theme-mode") || "cozy";
    const savedColor = localStorage.getItem("user-custom-color") || "#e68e8e";
    const savedDark = localStorage.getItem("user-dark-mode") === "true";
    activeMode.value = savedMode;
    customColorInput.value = savedColor;
    isDarkMode.value = savedDark;
});
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed bottom-6 left-6 z-[99999] font-sans flex flex-col-reverse items-start gap-4 pointer-events-none"
        >
            <button
                @click="toggleMenu"
                class="pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 z-50 relative overflow-hidden group shadow-lg hover:shadow-2xl active:scale-95 border"
                :class="currentButtonBg"
            >
                <div class="relative w-7 h-7 flex items-center justify-center">
                    <X
                        v-if="isOpen"
                        class="w-7 h-7 text-gray-400 absolute transition-all duration-300 rotate-0 scale-100"
                    />
                    <Palette
                        v-else
                        class="w-7 h-7 transition-all duration-300 absolute rotate-0 scale-100"
                        :style="{ color: themeColorStyle }"
                        stroke-width="2"
                    />
                </div>
            </button>

            <div
                v-if="isOpen"
                @click="isOpen = false"
                class="fixed inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-auto transition-opacity duration-300 -z-10"
            ></div>

            <transition name="spring">
                <div
                    v-if="isOpen"
                    class="pointer-events-auto mb-2 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[28px] shadow-2xl flex flex-col gap-4 w-60 origin-bottom-left"
                >
                    <div
                        class="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-[18px] relative h-10 w-full"
                    >
                        <div
                            class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-600 rounded-[14px] shadow-sm transition-all duration-300 ease-spring"
                            :class="
                                activeMode === 'cozy'
                                    ? 'left-1'
                                    : 'left-[calc(50%+0px)]'
                            "
                        ></div>

                        <button
                            @click="activeMode = 'cozy'"
                            class="flex-1 text-xs font-bold rounded-[16px] transition-colors relative z-10 flex items-center justify-center gap-1.5"
                            :style="{
                                color:
                                    activeMode === 'cozy'
                                        ? themeColorStyle
                                        : '',
                            }"
                            :class="
                                activeMode === 'cozy'
                                    ? ''
                                    : 'text-gray-400 dark:text-gray-500'
                            "
                        >
                            <Coffee class="w-3.5 h-3.5" /> Cozy
                        </button>
                        <button
                            @click="
                                activeMode = 'focus';
                                isDarkMode = false;
                            "
                            class="flex-1 text-xs font-bold rounded-[16px] transition-colors relative z-10 flex items-center justify-center gap-1.5"
                            :class="
                                activeMode === 'focus'
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-400 dark:text-gray-500'
                            "
                        >
                            <Zap class="w-3.5 h-3.5" /> Focus
                        </button>
                    </div>

                    <div
                        v-if="activeMode === 'cozy'"
                        class="space-y-4 px-1 py-1 animate-fade w-full"
                    >
                        <div class="flex justify-between items-center gap-2">
                            <button
                                v-for="preset in presets"
                                :key="preset.id"
                                @click="selectPreset(preset.color)"
                                class="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 relative shadow-sm"
                                :style="{ backgroundColor: preset.color }"
                            >
                                <div
                                    v-if="
                                        customColorInput === preset.color &&
                                        !isDarkMode
                                    "
                                    class="absolute -inset-1 rounded-full border-2"
                                    :style="{ borderColor: preset.color }"
                                ></div>
                                <Check
                                    v-if="
                                        customColorInput === preset.color &&
                                        !isDarkMode
                                    "
                                    class="w-5 h-5 text-white drop-shadow-md"
                                    stroke-width="3"
                                />
                            </button>

                            <div
                                class="relative w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shadow-sm overflow-hidden active:scale-90 transition-transform"
                            >
                                <div
                                    v-if="
                                        !presets.find(
                                            (p) => p.color === customColorInput,
                                        ) && !isDarkMode
                                    "
                                    class="absolute -inset-1 rounded-full border-2"
                                    :style="{ borderColor: customColorInput }"
                                ></div>
                                <Plus
                                    v-if="
                                        presets.find(
                                            (p) => p.color === customColorInput,
                                        )
                                    "
                                    class="w-5 h-5 text-gray-400"
                                />
                                <input
                                    type="color"
                                    class="absolute inset-0 opacity-0 cursor-pointer w-[200%] h-[200%] -top-1/2 -left-1/2"
                                    :value="customColorInput"
                                    @input="handleCustomColor"
                                />
                            </div>
                        </div>

                        <div
                            class="h-px bg-gray-100 dark:bg-white/5 w-full"
                        ></div>

                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                                <div
                                    class="p-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg"
                                >
                                    <Moon
                                        class="w-4 h-4 text-gray-400 dark:text-indigo-400"
                                    />
                                </div>
                                <span
                                    class="text-xs font-bold text-gray-600 dark:text-gray-300"
                                    >Mode Gelap</span
                                >
                            </div>

                            <button
                                @click="toggleDarkMode"
                                class="w-11 h-6 rounded-full relative transition-colors duration-300 focus:outline-none shadow-inner"
                                :style="{
                                    backgroundColor: isDarkMode
                                        ? themeColorStyle
                                        : '#e2e8f0',
                                }"
                            >
                                <div
                                    class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ease-spring"
                                    :class="
                                        isDarkMode
                                            ? 'translate-x-5'
                                            : 'translate-x-0'
                                    "
                                ></div>
                            </button>
                        </div>
                    </div>

                    <div
                        v-else
                        class="py-4 px-2 text-center bg-gray-50/50 dark:bg-white/5 rounded-2xl w-full"
                    >
                        <p
                            class="text-[10px] text-gray-400 dark:text-gray-500 font-medium leading-relaxed"
                        >
                            Focus mode aktif.
                        </p>
                    </div>
                </div>
            </transition>
        </div>
    </Teleport>
</template>

<style scoped>
.spring-enter-active,
.spring-leave-active {
    transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
}
.spring-enter-from,
.spring-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
}
.ease-spring {
    transition-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
}
.animate-fade {
    animation: fadeIn 0.4s ease-out forwards;
}
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
