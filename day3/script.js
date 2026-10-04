let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];


// 1. Search notes by word (ignores upper/lower case)
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}

// Tests
console.log(searchNotes("milk")); // expected: [ { id: 1, text: "Buy milk and bread", category: "personal" } ]
console.log(searchNotes("MILK")); // expected: same note as above (case ignored)
console.log(searchNotes("zebra")); // expected: [] (no results)

// 2. Longest note
function longestNote() {
  if (notes.length === 0) return null;
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// Tests
console.log(longestNote()); // expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const backup = notes;
notes = [];
console.log(longestNote()); // expected: null (no notes)
notes = backup;

// 3. Count notes per category
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

// Tests
console.log(countByCategory()); // expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory()); // expected: {} (empty object)
notes = backup;

// 4. Summary sentence
function getSummary() {
  const total = notes.length;
  if (total === 0) return "0 notes.";
  const counts = countByCategory();
  const parts = [];
  for (const category in counts) {
    parts.push(`${counts[category]} ${category}`);
  }
  const word = total === 1 ? "note" : "notes";
  return `${total} ${word}: ${parts.join(", ")}.`;
}

// Tests
console.log(getSummary()); // expected: "5 notes: 2 personal, 2 study, 1 work."
notes = [notes[0]];
console.log(getSummary()); // expected: "1 note: 1 personal."
notes = backup;

// 5. Duplicate check (ignores case and extra spaces)
function isDuplicate(text) {
  const cleaned = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === cleaned);
}

// Tests
console.log(isDuplicate("call mum")); // expected: true (same text, different case)
console.log(isDuplicate("  Buy milk and bread  ")); // expected: true (extra spaces ignored)
console.log(isDuplicate("Water the plants")); // expected: false

// 6. Add a note
function addNote(text, category) {
  const cleaned = text.trim();
  const allowed = ["personal", "work", "study"];

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Rejected: note must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("Rejected: this note already exists.");
    return false;
  }
  if (!allowed.includes(category)) {
    console.log("Rejected: category must be personal, work or study.");
    return false;
  }

  notes.push({ id: Date.now(), text: cleaned, category: category });
  console.log(`Added: "${cleaned}" (${category})`);
  return true;
}

// Tests
console.log(addNote("Water the plants", "personal")); // expected: Added message, then true
console.log(addNote("Water the plants", "personal")); // expected: Rejected (duplicate), then false
console.log(addNote("   ", "work")); // expected: Rejected (1-200 characters), then false
console.log(addNote("Plan the trip", "holiday")); // expected: Rejected (category), then false
console.log(getSummary()); // expected: "6 notes: 3 personal, 2 study, 1 work."
