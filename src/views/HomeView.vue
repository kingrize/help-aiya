<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { collection, getDocs, query } from "firebase/firestore"; // Import yang benar
import { useRouter } from "vue-router";
import { db } from "../firebase.js";
import HeaderSection from "../components/HeaderSection.vue";
import FooterSection from "../components/FooterSection.vue";
import FolderCard from "../components/FolderCard.vue"; // Pastikan component ini ada
import { playPop } from "../utils/sound.js";
import { Loader2, Bot, Search, X } from "lucide-vue-next";

const router = useRouter();

// --- STATE ---
const courses = ref([]);
const searchQuery = ref("");
const isLoading = ref(true);
const isSearchOpen = ref(false);
const searchInputRef = ref(null);

// --- LOGIC ---
onMounted(async () => {
    try {
        isLoading.value = true;

        // PERBAIKAN DI SINI:
        // Gunakan 'collection' untuk mengambil daftar semua folder/materi
        // JANGAN pakai 'doc' di sini karena kita mau list banyak, bukan satu.
        const q = query(collection(db, "courses"));

        const querySnapshot = await getDocs(q);

        const loadedCourses = [];
        querySnapshot.forEach((docItem) => {
            const data = docItem.data();
            loadedCourses.push({
                id: docItem.id,
                title: data.title || "Materi Tanpa Judul",
                description: data.description || "Tidak ada deskripsi.",
                questionCount: data.questionsList
                    ? data.questionsList.length
                    : 0,
                createdAt: data.createdAt,
            });
        });

        // Sort manual by date (opsional, jika createdAt ada)
        loadedCourses.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA; // Terbaru di atas
        });

        courses.value = loadedCourses;
    } catch (error) {
        console.error("Gagal mengambil data:", error);
    } finally {
        isLoading.value = false;
    }
});

const openCourse = (id) => {
    playPop();
    // Arahkan ke halaman detail materi
    router.push(`/course/${id}`);
};

const openSearch = () => {
    playPop();
    isSearchOpen.value = true;
    nextTick(() => {
        searchInputRef.value?.focus();
    });
};

const closeSearch = () => {
    if (!searchQuery.value) {
        isSearchOpen.value = false;
    }
};

const clearSearch = (e) => {
    e.stopPropagation();
    searchQuery.value = "";
    isSearchOpen.value = false;
};

// Filter Folders
const filteredCourses = computed(() => {
    if (!searchQuery.value.trim()) return courses.value;

    const lowerQ = searchQuery.value.toLowerCase();
    return courses.value.filter(
        (c) =>
            c.title.toLowerCase().includes(lowerQ) ||
            c.description.toLowerCase().includes(lowerQ),
    );
});
</script>

<template>
    <div
        class="min-h-screen bg-cozy-bg text-cozy-text transition-colors duration-500 pb-20 font-sans"
    >
        <HeaderSection />

        <main class="max-w-6xl mx-auto px-6 md:px-12 relative z-10 pt-4">
            <div
                v-if="!isLoading && courses.length > 0"
                class="sticky top-4 z-30 mb-8 flex justify-center pointer-events-none"
            >
                <div
                    class="pointer-events-auto relative transition-all duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    :class="
                        isSearchOpen || searchQuery ? 'w-full max-w-lg' : 'w-12'
                    "
                >
                    <div
                        class="bg-cozy-card/90 backdrop-blur-xl border border-cozy-border rounded-full shadow-lg overflow-hidden flex items-center h-12 transition-all duration-300"
                        :class="
                            isSearchOpen || searchQuery
                                ? 'px-4 ring-2 ring-cozy-primary/20'
                                : 'justify-center cursor-pointer hover:scale-110 hover:border-cozy-primary'
                        "
                        @click="!isSearchOpen && openSearch()"
                    >
                        <Search
                            class="w-5 h-5 text-cozy-muted transition-colors duration-300"
                            :class="
                                isSearchOpen || searchQuery
                                    ? 'mr-3 text-cozy-primary'
                                    : ''
                            "
                        />
                        <input
                            v-if="isSearchOpen || searchQuery"
                            ref="searchInputRef"
                            v-model="searchQuery"
                            type="text"
                            placeholder="Cari materi pelajaran..."
                            class="flex-1 bg-transparent border-none outline-none text-sm font-bold text-cozy-text placeholder:text-cozy-muted/60 h-full min-w-0"
                            @blur="closeSearch"
                        />
                        <button
                            v-if="searchQuery"
                            @click="clearSearch"
                            class="ml-2 p-1 rounded-full hover:bg-red-50 text-cozy-muted hover:text-red-500 transition-all"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div
                v-if="isLoading"
                class="flex flex-col items-center justify-center py-24 min-h-[40vh]"
            >
                <div class="relative mb-6">
                    <div
                        class="w-16 h-16 bg-cozy-primary/10 rounded-full flex items-center justify-center animate-pulse"
                    >
                        <Loader2
                            class="w-8 h-8 text-cozy-primary animate-spin"
                        />
                    </div>
                </div>
                <p
                    class="text-xs text-cozy-muted font-bold tracking-widest animate-pulse"
                >
                    MEMUAT MATERI...
                </p>
            </div>

            <div
                v-else-if="filteredCourses.length > 0"
                class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 pb-12 items-stretch"
            >
                <transition-group name="staggered-fade">
                    <FolderCard
                        v-for="course in filteredCourses"
                        :key="course.id"
                        :course="course"
                        @open="openCourse"
                    />
                </transition-group>
            </div>

            <div
                v-else
                class="flex flex-col items-center justify-center py-24 min-h-[50vh] text-center"
            >
                <div class="mb-8 relative group cursor-default">
                    <pre
                        class="font-mono text-sm leading-[1.1] text-cozy-primary/60 animate-breathe select-none transition-colors group-hover:text-cozy-primary"
                    >
  /\_/\
 ( o.o )
  > ^ <
                    </pre>
                </div>
                <h3 class="font-display font-bold text-lg text-cozy-text mb-2">
                    {{
                        searchQuery
                            ? "Materi tidak ditemukan."
                            : "Belum ada materi."
                    }}
                </h3>
                <p
                    class="text-xs text-cozy-muted max-w-[250px] mx-auto leading-relaxed"
                >
                    {{
                        searchQuery
                            ? `Coba kata kunci lain selain "${searchQuery}".`
                            : "Kucing penjaga sedang menunggu Admin mengupload materi baru."
                    }}
                </p>
            </div>
        </main>

        <div
            v-if="!isLoading && courses.length > 0"
            class="fixed bottom-24 left-6 z-40 group"
        >
            <router-link to="/quiz" @click="playPop" class="block">
                <div
                    class="w-14 h-14 flex items-center justify-center bg-cozy-card rounded-2xl shadow-xl shadow-cozy-shadow border border-cozy-border hover:scale-110 hover:-rotate-6 hover:border-cozy-primary transition-all duration-300 ease-spring relative overflow-hidden"
                >
                    <div
                        class="absolute inset-0 bg-cozy-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    ></div>
                    <Bot
                        class="w-7 h-7 text-cozy-text group-hover:text-cozy-primary group-hover:animate-wiggle transition-colors relative z-10"
                    />
                </div>
            </router-link>
        </div>

        <FooterSection />
    </div>
</template>

<style scoped>
.ease-spring {
    transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes wiggle {
    0%,
    100% {
        transform: rotate(0deg);
    }
    25% {
        transform: rotate(-10deg);
    }
    75% {
        transform: rotate(10deg);
    }
}
.animate-wiggle {
    animation: wiggle 0.5s ease-in-out infinite;
}
.staggered-fade-enter-active,
.staggered-fade-leave-active {
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.staggered-fade-enter-from,
.staggered-fade-leave-to {
    opacity: 0;
    transform: translateY(20px);
}
</style>
