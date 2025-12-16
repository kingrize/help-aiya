<script setup>
import { useToast } from "../composables/useToast";
import { CheckCircle, XCircle, Info, X } from "lucide-vue-next";

const { toasts, removeToast } = useToast();

const getIcon = (type) => {
    if (type === "success") return CheckCircle;
    if (type === "error") return XCircle;
    return Info;
};

const getStyle = (type) => {
    if (type === "success")
        return "bg-white border-green-200 text-green-700 shadow-green-100";
    if (type === "error")
        return "bg-white border-red-200 text-red-700 shadow-red-100";
    return "bg-white border-blue-200 text-blue-700 shadow-blue-100";
};
</script>

<template>
    <div
        class="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-3 w-full max-w-xs pointer-events-none"
    >
        <transition-group name="toast">
            <div
                v-for="toast in toasts"
                :key="toast.id"
                class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 transform"
                :class="getStyle(toast.type)"
            >
                <component :is="getIcon(toast.type)" class="w-5 h-5 shrink-0" />
                <span class="text-xs font-bold grow">{{ toast.message }}</span>
                <button
                    @click="removeToast(toast.id)"
                    class="opacity-50 hover:opacity-100 transition-opacity"
                >
                    <X class="w-4 h-4" />
                </button>
            </div>
        </transition-group>
    </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
}
</style>
