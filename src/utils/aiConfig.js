// Fungsi Helper untuk mengambil semua key dengan prefix tertentu
const getApiKeys = (prefix) => {
  const keys = [];
  let i = 1;
  // Loop cari VITE_PREFIX_1, VITE_PREFIX_2, dst sampai habis
  while (import.meta.env[`VITE_${prefix}_API_KEY_${i}`]) {
    keys.push(import.meta.env[`VITE_${prefix}_API_KEY_${i}`]);
    i++;
  }
  return keys;
};

// Load semua key ke dalam array
export const geminiKeys = getApiKeys("GEMINI");
export const groqKeys = getApiKeys("GROQ");
export const aimlKeys = getApiKeys("AIML");

// Contoh cara pakai: Ambil key secara acak atau berurutan
export const getRandomKey = (keys) =>
  keys[Math.floor(Math.random() * keys.length)];
