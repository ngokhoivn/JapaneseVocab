// Global variables
let vocabulary = [];
let currentIndex = 0;
let wrongWords = [];
let currentCycle = 1;
let totalCycles = 2;
let isChecking = false;
const apiCache = {};
// Khai báo API keys
const apiKeys = [
    'AIzaSyDjgTk4uZQUCpFH5Zt8ZgP2CW-jhmkLv8o',
    'AIzaSyDaROReiR48rjfavf8Lk6XvphC6QxKPZo4',
    'AIzaSyD-LQ7BMIl85o0Tq3LogG2rBmtYjkOpogU'
];

// Element references
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const vocabularyInput = document.getElementById('vocabularyInput');
const shuffleCheckbox = document.getElementById('shuffleCheckbox');
const cycleCountInput = document.getElementById('cycleCount');
const startLearningBtn = document.getElementById('startLearning');
const kanjiDisplay = document.getElementById('kanjiDisplay');
const answerInput = document.getElementById('answerInput');
const checkAnswerBtn = document.getElementById('checkAnswer');
const skipWordBtn = document.getElementById('skipWord');
const resultDisplay = document.getElementById('result');
const meaningDisplay = document.getElementById('meaning');
const progressText = document.getElementById('progressText');
const cycleText = document.getElementById('cycleText');
const progressBarFill = document.querySelector('.progress-bar-fill');
const restartLearningBtn = document.getElementById('restartLearning');
const wrongWordsTextarea = document.getElementById('wrongWords');
const copyAndRelearnBtn = document.getElementById('copyAndRelearn');

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.disabled) return;

        const tabId = tab.getAttribute('data-tab');

        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// Start learning button
startLearningBtn.addEventListener('click', () => {
    const inputText = vocabularyInput.value.trim();
    if (!inputText) {
        alert('Vui lòng nhập danh sách từ vựng!');
        return;
    }

    const lines = inputText.split('\n');
    vocabulary = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.trim().split('=');
        if (parts.length < 2) {
            alert(`Định dạng không hợp lệ: ${line}\nVui lòng sử dụng định dạng: Kanji=Hiragana=Nghĩa`);
            return;
        }

        vocabulary.push({
            kanji: parts[0].trim(),
            hiragana: parts[1].trim(),
            meaning: parts.length > 2 ? parts[2].trim() : ''
        });
    }

    if (vocabulary.length === 0) {
        alert('Không có từ vựng nào được nhập!');
        return;
    }

    // Get cycle count
    totalCycles = parseInt(cycleCountInput.value) || 2;
    if (totalCycles < 1) totalCycles = 1;

    // Shuffle if needed
    if (shuffleCheckbox.checked) {
        shuffleArray(vocabulary);
    }

    // Reset learning state
    currentIndex = 0;
    currentCycle = 1;
    wrongWords = [];
    isChecking = false;

    // Switch to learning tab
    document.querySelector('[data-tab="learning"]').disabled = false;
    document.querySelector('[data-tab="learning"]').click();

    // Update UI
    updateProgressUI();
    showCurrentWord();

    // Set focus to answer input
    answerInput.focus();

    // Enter fullscreen mode
    document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen mode: ${err.message}`);
    });
});

// Check answer button
checkAnswerBtn.addEventListener('click', checkAnswer);

// Skip word button
skipWordBtn.addEventListener('click', skipWord);

// Restart learning button
restartLearningBtn.addEventListener('click', () => {
    currentIndex = 0;
    currentCycle = 1;
    wrongWords = [];
    isChecking = false;

    updateProgressUI();
    showCurrentWord();
    resultDisplay.classList.add('hidden');
    meaningDisplay.textContent = '';
    answerInput.value = '';
    answerInput.focus();
});

// Copy and relearn button
copyAndRelearnBtn.addEventListener('click', () => {
    if (wrongWords.length === 0) return;

    const wrongWordsText = wrongWords.map(word =>
        `${word.kanji}=${word.hiragana}=${word.meaning}`
    ).join('\n');

    vocabularyInput.value = wrongWordsText;

    // Switch to input tab
    document.querySelector('[data-tab="input"]').click();

    // Focus on start button
    startLearningBtn.focus();
});

// Answer input enter key
answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        checkAnswer();
    }
});

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only process when in learning mode
    const learningTab = document.getElementById('learning');
    if (!learningTab.classList.contains('active')) return;

    if (e.key === 's' && e.ctrlKey) {
        // Ctrl+S - Skip word
        e.preventDefault();
        skipWord();
    } else if (e.key === 'Escape') {
        // ESC - Show exit dialog
        e.preventDefault();
        if (confirm('Bạn có muốn thoát chế độ học không?')) {
            document.querySelector('[data-tab="input"]').click();
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }
    } else if (e.key === 'F11') {
        // F11 - Toggle fullscreen
        e.preventDefault();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
});

// Function to check answer
async function checkAnswer() {
    if (isChecking || currentIndex >= vocabulary.length) return;

    isChecking = true;
    const currentWord = vocabulary[currentIndex];
    const userAnswer = answerInput.value.trim();

    // Thêm loading state
    resultDisplay.textContent = "Đang kiểm tra...";
    resultDisplay.className = "result";
    resultDisplay.classList.remove("hidden");

    // Gọi AI để kiểm tra
    const isCorrect = await checkWithAI(userAnswer, currentWord.hiragana);

    if (isCorrect) {
        resultDisplay.textContent = "✓ Chính xác!";
        resultDisplay.className = "result correct";
    } else {
        resultDisplay.textContent = `✗ Sai rồi! Đáp án đúng là: ${currentWord.hiragana}`;
        resultDisplay.className = "result incorrect";
        if (!wrongWords.some(word => word.kanji === currentWord.kanji)) {
            wrongWords.push(currentWord);
        }
    }

    // Hiển thị nghĩa
    if (currentWord.meaning) {
        meaningDisplay.textContent = currentWord.meaning;
    }

    // Chuyển từ sau 1.5 giây
    setTimeout(() => {
        moveToNextWord();
        isChecking = false;
    }, 1500);
}

// Hàm kiểm tra với AI được hợp nhất và cải tiến
async function checkWithAI(userInput, correctHiragana) {
    const cacheKey = `${userInput}:${correctHiragana}`;

    // Kiểm tra cache
    if (apiCache[cacheKey] !== undefined) {
        return apiCache[cacheKey];
    }

    const prompt = `
Evaluate purely by **spoken phonetics** in Japanese. Do not evaluate grammar or word order, only the correct pronunciation of the **entire sentence**. 

Rules:
1. If the input contains any kanji (漢字), return FALSE.
2. Convert both input and correct to their phonetic pronunciation (as if spoken), including all particles and conjugation.
3. Compare their syllables and morae strictly:
    - Must match exactly in sound.
    - Do NOT allow any reading variation (e.g., あき vs あけ → FALSE).
4. Accept minor character differences ONLY IF they do NOT change pronunciation:
    - は vs わ as particle = OK
    - Hiragana vs Katakana = OK IF sound matches and used only once
    - Dakuten mismatch (ば vs は) = OK ONLY IF sound is contextually identical

Compare these:
Input: ${userInput}  
Correct: ${correctHiragana}

Output only 'true' or 'false'.
`;

    try {
        // Sử dụng API key từ mảng (thay đổi khi cần)
        const currentApiKey = apiKeys[0]; // Có thể thêm logic để luân phiên sử dụng các API keys
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${currentApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        // Xử lý kết quả trả về từ API
        if (data && data.candidates && data.candidates[0].content) {
            const resultText = data.candidates[0].content.parts[0].text.trim().toLowerCase();
            const isCorrect = resultText === "true";
            apiCache[cacheKey] = isCorrect;
            return isCorrect;
        } else {
            console.error("Không nhận được phản hồi hợp lệ từ API:", data);
            return false;
        }
    } catch (error) {
        console.error("Lỗi khi gọi Gemini API:", error);
        return false;
    }
}

// Function to skip word
function skipWord() {
    if (isChecking) return;

    const currentWord = vocabulary[currentIndex];

    // Add to wrong words list
    if (!wrongWords.some(word => word.kanji === currentWord.kanji)) {
        wrongWords.push(currentWord);
    }

    moveToNextWord();
}

// Function to move to next word
function moveToNextWord() {
    currentIndex++;

    // Check if we need to move to next cycle or finish
    if (currentIndex >= vocabulary.length) {
        currentIndex = 0;
        currentCycle++;

        if (currentCycle > totalCycles) {
            // Learning completed
            finishLearning();
            return;
        }
    }

    // Reset UI for next word
    resultDisplay.classList.add('hidden');
    meaningDisplay.textContent = '';
    answerInput.value = '';

    // Update progress and show next word
    updateProgressUI();
    showCurrentWord();
    answerInput.focus();
}

// Function to show current word
function showCurrentWord() {
    if (currentIndex < vocabulary.length) {
        kanjiDisplay.textContent = vocabulary[currentIndex].kanji;
    } else {
        kanjiDisplay.textContent = '';
    }
}

// Function to update progress UI
function updateProgressUI() {
    const total = vocabulary.length;
    const current = currentIndex + 1;
    const percentage = total > 0 ? (currentIndex / total) * 100 : 0;

    progressText.textContent = `${current}/${total}`;
    cycleText.textContent = `Chu kỳ: ${currentCycle}/${totalCycles}`;
    progressBarFill.style.width = `${percentage}%`;
}

// Function to finish learning
function finishLearning() {
    if (wrongWords.length > 0) {
        // Show wrong words tab
        const wrongWordsTab = document.querySelector('[data-tab="wrong"]');
        wrongWordsTab.disabled = false;
        wrongWordsTab.click();

        // Fill wrong words textarea
        wrongWordsTextarea.value = wrongWords.map(word =>
            `${word.kanji}=${word.hiragana}=${word.meaning}`
        ).join('\n');
    } else {
        // No wrong words, show congratulations
        alert('Chúc mừng! Bạn đã học tất cả từ vựng đúng!');
        document.querySelector('[data-tab="input"]').click();
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
}

// Helper function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
