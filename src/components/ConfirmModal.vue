<script setup>
defineProps({
    isOpen: Boolean,
    title: String,
    message: String,
    confirmText: { type: String, default: "Ya, Lanjutkan" },
    cancelText: { type: String, default: "Batal" },
    isDanger: { type: Boolean, default: false },
});

defineEmits(["confirm", "close"]);
</script>

<template>
    <transition name="modal">
        <div
            v-if="isOpen"
            class="fixed inset-0 z-[99999] flex items-center justify-center px-4 font-sans text-cozy-text"
        >
            <div
                class="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                @click="$emit('close')"
            ></div>

            <div
                class="relative bg-cozy-card backdrop-blur-xl border border-cozy-border w-full max-w-[320px] rounded-[24px] shadow-2xl overflow-hidden transform transition-all animate-pop-in"
            >
                <div class="p-6 text-center">
                    <h3 class="text-lg font-bold mb-2 leading-snug">
                        {{ title }}
                    </h3>
                    <p class="text-sm text-cozy-muted leading-relaxed">
                        {{ message }}
                    </p>
                </div>

                <div
                    class="grid grid-cols-2 border-t border-cozy-border divide-x divide-cozy-border bg-cozy-bg/50"
                >
                    <button
                        @click="$emit('close')"
                        class="py-4 text-sm font-bold text-cozy-muted hover:bg-cozy-bg active:bg-cozy-border transition-colors"
                    >
                        {{ cancelText }}
                    </button>
                    <button
                        @click="$emit('confirm')"
                        class="py-4 text-sm font-bold hover:bg-cozy-bg active:bg-cozy-border transition-colors"
                        :class="isDanger ? 'text-red-500' : 'text-cozy-primary'"
                    >
                        {{ confirmText }}
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<style scoped>
@keyframes popIn {
    0% {
        opacity: 0;
        transform: scale(1.05);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}
.animate-pop-in {
    animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
</style>
