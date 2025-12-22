<script setup>
import { ref, onMounted } from "vue";
import { Palette, X, Plus, BookOpen, Check, Moon, Sun } from "lucide-vue-next";

const isOpen = ref(false);
const customColorInput = ref("#e68e8e");
const activeMode = ref("cozy"); // 'cozy' or 'focus'
const isDarkMode = ref(false);

const presets = [
    { id: "rose", color: "#e68e8e", label: "Rose" },
    { id: "sage", color: "#9fb8ad", label: "Sage" },
    { id: "sky", color: "#8eace6", label: "Sky" },
];

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

const applyCozyTheme = (hexColor) => {
    activeMode.value = "cozy";
    customColorInput.value = hexColor;
    const { h } = hexToHSL(hexColor);
    const root = document.documentElement;

    if (isDarkMode.value) {
        // === MIDNIGHT PASTEL MODE ===
        root.style.setProperty("--c-bg", `#0f172a`);
        root.style.setProperty("--c-card", `rgba(30, 41, 59, 0.7)`);
        root.style.setProperty("--c-text", `#e2e8f0`);
        root.style.setProperty("--c-text-muted", `#94a3b8`);
        root.style.setProperty("--c-border", `rgba(148, 163, 184, 0.15)`);
        root.style.setProperty("--c-primary", `hsl(${h}, 70%, 75%)`);
        root.style.setProperty("--c-secondary", `hsl(${h + 40}, 50%, 65%)`);
        root.style.setProperty("--c-accent", `hsl(${h + 180}, 60%, 80%)`);
        root.style.setProperty("--c-shadow", `hsla(${h}, 70%, 70%, 0.15)`);
        root.style.setProperty("--c-user-bg", `hsl(${h}, 60%, 60%)`);
        root.style.setProperty("--c-user-text", `#ffffff`);
    } else {
        // === COZY DAY MODE ===
        root.style.setProperty("--c-bg", `hsl(${h}, 30%, 97%)`);
        root.style.setProperty("--c-card", `rgba(255, 255, 255, 0.75)`);
        root.style.setProperty("--c-text", `#4b5563`);
        root.style.setProperty("--c-text-muted", `#6b7280`);
        root.style.setProperty("--c-border", `hsla(${h}, 30%, 80%, 0.5)`);
        root.style.setProperty("--c-primary", `hsl(${h}, 60%, 75%)`);
        root.style.setProperty("--c-secondary", `hsl(${h + 40}, 50%, 70%)`);
        root.style.setProperty("--c-accent", `hsl(${h + 180}, 60%, 80%)`);
        root.style.setProperty("--c-shadow", `hsla(${h}, 60%, 75%, 0.2)`);
        root.style.setProperty("--c-user-bg", `hsl(${h}, 65%, 70%)`);
        root.style.setProperty("--c-user-text", `#ffffff`);
    }

    localStorage.setItem("user-theme-mode", "cozy");
    localStorage.setItem("user-custom-color", hexColor);
    localStorage.setItem("user-dark-mode", isDarkMode.value);
};

const applyFocusMode = () => {
    activeMode.value = "focus";
    const root = document.documentElement;
    // Focus mode always light (Paper style)
    root.style.setProperty("--c-bg", `#fdfbf7`);
    root.style.setProperty("--c-card", `#ffffff`);
    root.style.setProperty("--c-text", `#111827`);
    root.style.setProperty("--c-text-muted", `#4b5563`);
    root.style.setProperty("--c-primary", `#262626`);
    root.style.setProperty("--c-secondary", `#e5e5e5`);
    root.style.setProperty("--c-accent", `#d4d4d4`);
    root.style.setProperty("--c-shadow", `rgba(0, 0, 0, 0.05)`);
    root.style.setProperty("--c-border", `#e5e7eb`);
    root.style.setProperty("--c-user-bg", `#262626`);
    root.style.setProperty("--c-user-text", `#ffffff`);
    localStorage.setItem("user-theme-mode", "focus");
};

const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value;
    applyCozyTheme(customColorInput.value);
};

const handleCustomColor = (event) => {
    const color = event.target.value;
    applyCozyTheme(color);
};

const toggleMenu = () => {
    isOpen.value = !isOpen.value;
};

onMounted(() => {
    const savedMode = localStorage.getItem("user-theme-mode") || "cozy";
    const savedColor = localStorage.getItem("user-custom-color") || "#e68e8e";
    const savedDark = localStorage.getItem("user-dark-mode") === "true";

    isDarkMode.value = savedDark;
    customColorInput.value = savedColor;

    if (savedMode === "focus") applyFocusMode();
    else applyCozyTheme(savedColor);
});
</script>

<template>
    <div class="fixed bottom-6 left-6 z-[9990] font-sans flex items-end gap-3">
        <button
            @click="toggleMenu"
            class="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-500 z-50 relative overflow-hidden group border-2 border-white/30 backdrop-blur-sm"
            :class="
                isOpen
                    ? 'bg-cozy-text text-cozy-bg rotate-90 scale-110'
                    : 'bg-cozy-card text-cozy-text hover:scale-110 hover:border-cozy-primary'
            "
        >
            <div
                class="absolute inset-0 bg-cozy-primary opacity-0 group-hover:opacity-20 transition-opacity duration-500"
            ></div>
            <X v-if="isOpen" class="w-6 h-6 relative z-10" />
            <Palette v-else class="w-6 h-6 relative z-10" />
        </button>

        <div
            class="flex items-center gap-3 transition-all duration-500 origin-left"
            :class="
                isOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-10 pointer-events-none'
            "
        >
            <div
                class="bg-cozy-card/95 backdrop-blur-xl border border-cozy-border p-2.5 rounded-full shadow-2xl flex items-center gap-3 ring-1 ring-black/5"
            >
                <div class="flex items-center gap-2">
                    <button
                        v-for="preset in presets"
                        :key="preset.id"
                        @click="applyCozyTheme(preset.color)"
                        class="relative w-9 h-9 rounded-full border border-white/20 hover:scale-110 transition-transform duration-300 flex items-center justify-center shadow-sm"
                        :style="{ backgroundColor: preset.color }"
                    >
                        <Check
                            v-if="
                                activeMode === 'cozy' &&
                                customColorInput === preset.color
                            "
                            class="w-5 h-5 text-white drop-shadow-md"
                            stroke-width="3"
                        />
                    </button>
                    <div class="relative group">
                        <button
                            class="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-300 via-purple-300 to-blue-300 border border-white/20 flex items-center justify-center hover:rotate-90 transition-all duration-500 shadow-sm"
                        >
                            <Plus class="w-5 h-5 text-white drop-shadow-md" />
                        </button>
                        <input
                            type="color"
                            class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            :value="customColorInput"
                            @input="handleCustomColor"
                        />
                    </div>
                </div>
                <div class="w-px h-8 bg-cozy-border mx-1"></div>
                <button
                    @click="toggleDarkMode"
                    class="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border border-transparent hover:bg-cozy-bg"
                    :class="
                        isDarkMode
                            ? 'text-yellow-400 bg-white/10'
                            : 'text-slate-600'
                    "
                    title="Toggle Midnight Mode"
                >
                    <Moon
                        v-if="!isDarkMode"
                        class="w-5 h-5 fill-current opacity-80"
                    /><Sun v-else class="w-5 h-5 fill-current" />
                </button>
                <button
                    @click="applyFocusMode"
                    class="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border border-transparent"
                    :class="
                        activeMode === 'focus'
                            ? 'bg-cozy-text text-cozy-bg shadow-inner'
                            : 'text-cozy-text/70 hover:bg-cozy-bg'
                    "
                    title="Focus Mode"
                >
                    <BookOpen class="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
</template>
