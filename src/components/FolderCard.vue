<script setup>
import { Folder, FileText, ChevronRight, Clock } from "lucide-vue-next";

defineProps({ course: Object });
defineEmits(["open"]);

const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp.seconds * 1000).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
    });
};
</script>

<template>
    <div
        class="group relative bg-white rounded-[24px] p-6 border border-cozy-border hover:border-cozy-primary hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col h-full active:scale-95"
        @click="$emit('open', course.id)"
    >
        <div class="mb-4 flex justify-between items-start">
            <div
                class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-cozy-primary group-hover:text-white transition-colors duration-300 shadow-sm group-hover:shadow-cozy-primary/30"
            >
                <Folder class="w-6 h-6" />
            </div>
            <div class="flex flex-col items-end gap-1">
                <div
                    class="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"
                >
                    <FileText class="w-3 h-3" /> {{ course.questionCount }}
                </div>
            </div>
        </div>

        <div class="flex-1">
            <h3
                class="font-display font-bold text-lg text-cozy-text leading-tight mb-2 group-hover:text-cozy-primary transition-colors line-clamp-2"
            >
                {{ course.title }}
            </h3>
            <p class="text-xs text-cozy-muted line-clamp-2 leading-relaxed">
                {{ course.description }}
            </p>
        </div>

        <div
            class="mt-4 pt-4 border-t border-dashed border-gray-100 flex items-center justify-between"
        >
            <span class="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock class="w-3 h-3" /> {{ formatDate(course.createdAt) }}
            </span>
            <div
                class="flex items-center text-xs font-bold text-cozy-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
            >
                Buka <ChevronRight class="w-4 h-4 ml-1" />
            </div>
        </div>
    </div>
</template>
