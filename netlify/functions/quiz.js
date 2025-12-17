// File: netlify/functions/quiz.js
export const handler = async (event) => {
  // Hanya izinkan method POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    // 1. Ambil semua API Key dari Environment Variables di Netlify
    const apiKeys = [];
    if (process.env.VITE_GEMINI_API_KEY)
      apiKeys.push(process.env.VITE_GEMINI_API_KEY);
    // Cek key cadangan 1-10
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`VITE_GEMINI_API_KEY_${i}`];
      if (key) apiKeys.push(key);
    }

    if (apiKeys.length === 0) {
      throw new Error("Server Misconfiguration: No API Keys found.");
    }

    // 2. Logic Smart Retry (Rotasi Key di Server)
    let finalResult = null;
    let success = false;
    let lastError = null;

    for (const key of apiKeys) {
      try {
        console.log(`Trying API Key ending in ...${key.slice(-4)}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          // Jika error quota, lempar error agar lanjut ke key berikutnya
          throw new Error(data.error?.message || "Gemini API Error");
        }

        // Parsing hasil
        let textResult = data.candidates[0].content.parts[0].text
          .replace(/```json|```/g, "")
          .trim();

        finalResult = JSON.parse(textResult);
        success = true;
        break; // Berhasil! Keluar dari loop.
      } catch (err) {
        console.warn(`Key failed: ${err.message}`);
        lastError = err.message;
        // Lanjut ke key berikutnya...
      }
    }

    if (!success) {
      throw new Error(`All API keys exhausted. Last error: ${lastError}`);
    }

    // 3. Kirim hasil bersih ke Frontend
    return {
      statusCode: 200,
      body: JSON.stringify(finalResult),
    };
  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
