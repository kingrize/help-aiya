<script setup>
import { RouterView } from "vue-router";
import AiTutor from "./components/AiTutor.vue";
import ThemeToggle from "./components/ThemeToggle.vue"; // <--- Import ini
</script>

<template>
    <div
        class="relative min-h-screen font-sans pb-20 selection:bg-cozy-primary selection:text-white"
    >
        <RouterView />

        <ThemeToggle />

        <AiTutor />
    </div>
</template>
