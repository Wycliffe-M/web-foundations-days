// ---------- 1. Select the elements ----------
const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const MAX_CHARS = 200;
const WARNING_AT = 180;
const DRAFT_KEY = "quicknotes-draft";

// ---------- 2. Update both counters and the warning classes ----------
function updateCounts() {
    const text = textarea.value;
    const chars = text.length;
    const trimmed = text.trim();
    const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

    charCount.textContent = `${chars} / ${MAX_CHARS} characters`;
    wordCount.textContent = `${words} words`;

    charCount.classList.toggle("warning", chars > WARNING_AT && chars <= MAX_CHARS);
    charCount.classList.toggle("over", chars > MAX_CHARS);
}

// ---------- 3. Listen for typing ----------
// ---------- 3. Save and restore the draft ----------
function saveDraft() {
    localStorage.setItem(DRAFT_KEY, textarea.value);
}

function loadDraft() {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved !== null) {
        textarea.value = saved;
    }
}

// ---------- 4. Listen for typing ----------
textarea.addEventListener("input", () => {
    updateCounts();
    saveDraft();
});

// ---------- Clear everything ----------
function clearAll() {
    textarea.value = "";
    localStorage.removeItem(DRAFT_KEY);
    updateCounts();
    textarea.focus();
}

clearBtn.addEventListener("click", clearAll);

textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        clearAll();
    }
});

// ---------- Theme toggle ----------
const THEME_KEY = "quicknotes-theme";

function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

themeToggle.addEventListener("click", () => {
    const newTheme = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
});

// ---------- 5. Page load ----------
applyTheme(localStorage.getItem(THEME_KEY));
loadDraft();
updateCounts();