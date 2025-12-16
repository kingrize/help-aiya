// File: src/composables/useToast.js
import { ref } from "vue";

const toasts = ref([]);

export function useToast() {
  const addToast = (message, type = "info") => {
    const id = Date.now();
    toasts.value.push({ id, message, type });

    // Hilang otomatis setelah 3 detik
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  return { toasts, addToast, removeToast };
}
