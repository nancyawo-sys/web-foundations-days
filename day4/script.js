// ---------- 1. Select the elements ----------
const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

// ---------- 2. Update both counters ----------
function updateCounts() {
  const text = textarea.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = `${chars} / 200 characters`;
  wordCount.textContent = words === 1 ? "1 word" : `${words} words`;

  charCount.classList.remove("warning", "over");
  if (chars > 200) {
    charCount.classList.add("over");
  } else if (chars > 180) {
    charCount.classList.add("warning");
  }
}

// ---------- 3. Run on every keystroke ----------
// ---------- 3. Draft: save, restore, clear ----------
const DRAFT_KEY = "quicknotes-draft";

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, textarea.value);
}

function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

// ---------- 4. Events ----------
textarea.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

clearBtn.addEventListener("click", clearAll);

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});

// ---------- 5. When the page loads: restore the draft ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  textarea.value = savedDraft;
}
updateCounts();

// ---------- 6. Theme: toggle and remember ----------
const THEME_KEY = "quicknotes-theme";

function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

// Restore the saved theme when the page loads
applyTheme(localStorage.getItem(THEME_KEY) === "dark");
