<script setup>
import { ref, onMounted } from "vue";
import { Moon, Sun, BookOpen } from "lucide-vue-next";

const currentTheme = ref("cozy");

const setTheme = (theme) => {
    currentTheme.value = theme;
    document.documentElement.setAttribute("data-theme", theme); // INI KUNCINYA
    localStorage.setItem("user-theme", theme);
};

onMounted(() => {
    const savedTheme = localStorage.getItem("user-theme") || "cozy";
    setTheme(savedTheme);
});

const themes = [
    { id: "cozy", icon: Sun, label: "Cozy" },
    { id: "dark", icon: Moon, label: "Night" },
    { id: "focus", icon: BookOpen, label: "Focus" },
];
</script>

<template>
    <div class="fixed bottom-6 left-6 z-[9990] flex flex-col gap-2 font-sans">
        <div
            class="bg-cozy-card border border-cozy-border p-1.5 rounded-full shadow-lg flex gap-1 transition-all duration-300"
        >
            <button
                v-for="t in themes"
                :key="t.id"
                @click="setTheme(t.id)"
                class="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group"
                :class="
                    currentTheme === t.id
                        ? 'bg-cozy-primary text-white shadow-md'
                        : 'text-cozy-secondary hover:bg-cozy-bg'
                "
                :title="t.label"
            >
                <component :is="t.icon" class="w-5 h-5" />
            </button>
        </div>
    </div>
</template>
