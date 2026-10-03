let notes = [
    { id: 1, text: "Buy milk and bread", category: "personal" },
    { id: 2, text: "Finish the Day 3 assignment", category: "study" },
    { id: 3, text: "Email the project report to Grace", category: "work" },
    { id: 4, text: "Revise JavaScript arrays", category: "study" },
    { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
    const search = word.toLowerCase();
    return notes.filter((note) => note.text.toLowerCase().includes(search));
}

function longestNote() {
    if (notes.length === 0) {
        return null;
    }
    let longest = notes[0];
    for (const note of notes) {
        if (note.text.length > longest.text.length) {
            longest = note;
        }
    }
    return longest;
}

function countByCategory() {
    const counts = {};
    for (const note of notes) {
        if (counts[note.category]) {
            counts[note.category] += 1;
        } else {
            counts[note.category] = 1;
        }
    }
    return counts;
}

function getSummary() {
    const counts = countByCategory();
    const total = notes.length;
    const noun = total === 1 ? "note" : "notes";
    const order = ["personal", "work", "study"];
    const parts = [];
    for (const category of order) {
        parts.push(`${counts[category] || 0} ${category}`);
    }
    return `${total} ${noun}: ${parts.join(", ")}.`;
}

function isDuplicate(text) {
    const cleaned = text.trim().toLowerCase();
    return notes.some((note) => note.text.trim().toLowerCase() === cleaned);
}

function addNote(text, category) {
    const cleaned = text.trim();
    const validCategories = ["personal", "work", "study"];

    if (cleaned.length < 1 || cleaned.length > 200) {
        console.log("Rejected: text must be 1-200 characters.");
        return false;
    }
    if (isDuplicate(cleaned)) {
        console.log(`Rejected: "${cleaned}" already exists.`);
        return false;
    }
    if (!validCategories.includes(category)) {
        console.log(`Rejected: "${category}" is not a valid category.`);
        return false;
    }

    const newNote = {
        id: notes.length + 1,
        text: cleaned,
        category: category,
    };
    notes.push(newNote);
    console.log(`Added: "${cleaned}" (${category})`);
    return true;
}

// ---------- Tests ----------

// searchNotes
console.log(searchNotes("day").length); // 1
console.log(searchNotes("JAVASCRIPT")); // [{ id: 4, text: "Revise JavaScript arrays", category: "study" }]
console.log(searchNotes("zebra")); // []

// longestNote
console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }

// countByCategory
console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }

// getSummary
console.log(getSummary()); // 5 notes: 2 personal, 1 work, 2 study.

// isDuplicate
console.log(isDuplicate("call mum")); // true
console.log(isDuplicate("   BUY MILK AND BREAD  ")); // true
console.log(isDuplicate("Call mum tomorrow")); // false
console.log(isDuplicate("")); // false

// Edge cases: empty list and one-note list
const backup = notes;
notes = [];
console.log(longestNote()); // null
console.log(countByCategory()); // {}
console.log(getSummary()); // 0 notes: 0 personal, 0 work, 0 study.
notes = [backup[0]];
console.log(getSummary()); // 1 note: 1 personal, 0 work, 0 study.
notes = backup;

// addNote (these change the data, so they come last)
console.log(addNote("Pay rent", "personal")); // logs Added: "Pay rent" (personal), then true
console.log(addNote("   ", "work")); // logs Rejected: text must be 1-200 characters., then false
console.log(addNote("a".repeat(201), "work")); // logs Rejected: text must be 1-200 characters., then false
console.log(addNote("CALL MUM", "personal")); // logs Rejected: "CALL MUM" already exists., then false
console.log(addNote("Plan the sprint", "hobby")); // logs Rejected: "hobby" is not a valid category., then false
console.log(notes.length); // 6
console.log(getSummary()); // 6 notes: 3 personal, 1 work, 2 study.