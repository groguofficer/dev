// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = [];
let verseLookup = new Map();
let chapterVerseMap = new Map();
let planLookup = new Map();

/**
 * Fetches and parses the CSV files into our data stores.
 */
async function loadData() {
    try {
        const [kjvResponse, planResponse] = await Promise.all([
            fetch(KJV_URL),
            fetch(PLAN_URL)
        ]);

        if (!kjvResponse.ok || !planResponse.ok) {
            throw new Error('Network response was not ok.');
        }

        const kjvText = await kjvResponse.text();
        const planText = await planResponse.text();

        // --- Parsing logic for kjv.csv (comma-separated) ---
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length < 2) return;

            const reference = parts[0].trim();
            const text = parts.slice(1).join(',').trim().replace(/^"|"$/g, ''); // Remove surrounding quotes
            
            verseLookup.set(reference, text);
            allVersesArray.push({ reference, text });

            const chapterMatch = reference.match(/^(.*\s\d+):(\d+)$/);
            if (chapterMatch) {
                const chapterKey = chapterMatch[1];
                if (!chapterVerseMap.has(chapterKey)) {
                    chapterVerseMap.set(chapterKey, []);
                }
                chapterVerseMap.get(chapterKey).push(parseInt(chapterMatch[2], 10));
            }
        });

        // --- Parsing logic for ChronoBiblePlan.csv (space-separated) ---
        const planLines = planText.trim().split('\n');
        planLines.forEach(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^(\d+)\s*,?\s*(.*)$/);
            if (match) {
                planLookup.set(match[1], match[2].trim());
            }
        });

    } catch (error) {
        console.error("Failed to load bible data:", error);
        document.body.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load data files.</p>`;
    }
}

/**
 * WORKER FUNCTION: Expands a *simple* reference part.
 * Handles: "Genesis 1-2", "Psalm 131", "John 1:1-5", "John 3:16"
 */
function expandSimpleReference(ref) {
    const expandedRefs = [];

    // Case 1: Chapter Range (e.g., "Genesis 1-2")
    const chapRangeMatch = ref.match(/^(.*\D)\s*(\d+)-(\d+)$/);
    if (chapRangeMatch) {
        const book = chapRangeMatch[1].trim();
        const startChap = parseInt(chapRangeMatch[2], 10);
        const endChap = parseInt(chapRangeMatch[3], 10);
        for (let i = startChap; i <= endChap; i++) {
            const chapterKey = `${book} ${i}`;
            const verses = chapterVerseMap.get(chapterKey) || [];
            verses.forEach(v => expandedRefs.push(`${chapterKey}:${v}`));
        }
        return expandedRefs;
    }

    // Case 2: Verse Range (e.g., "John 1:1-5")
    const verseRangeMatch = ref.match(/^(.*\s\d+):(\d+)-(\d+)$/);
    if (verseRangeMatch) {
        const base = verseRangeMatch[1];
        const startVerse = parseInt(verseRangeMatch[2], 10);
        const endVerse = parseInt(verseRangeMatch[3], 10);
        for (let i = startVerse; i <= endVerse; i++) {
            expandedRefs.push(`${base}:${i}`);
        }
        return expandedRefs;
    }
    
    // Case 3: Full Chapter (e.g., "Psalm 131")
    const verses = chapterVerseMap.get(ref);
    if (verses) {
        verses.forEach(v => expandedRefs.push(`${ref}:${v}`));
        return expandedRefs;
    }
    
    // Case 4: Single Verse (e.g., "John 3:16")
    if (verseLookup.has(ref)) {
        return [ref];
    }
    
    return []; // Return empty if no match
}

/**
 * MANAGER FUNCTION: Breaks down a complex passage string.
 * Handles: "Psalm 131, 138-139, 143-145"
 */
function parseComplexPassage(passage) {
    const allPassageRefs = [];
    // Extract the book name, which we assume is at the start.
    const bookMatch = passage.match(/^([1-3]?\s?[a-zA-Z\s]+?)\s/);
    if (!bookMatch) return []; // Cannot find a book name

    const book = bookMatch[1].trim();
    // Get everything after the book name and split by comma.
    const parts = passage.replace(book, '').split(',').map(p => p.trim());

    for (const part of parts) {
        if (!part) continue;
        // Re-attach the book name to each part to create a simple reference.
        // e.g., if part is "138-139", this creates "Psalm 138-139"
        const simpleRef = `${book} ${part}`;
        allPassageRefs.push(...expandSimpleReference(simpleRef));
    }
    return allPassageRefs;
}


/**
 * DEBUGGING VERSION: Displays the LIST of generated verse references.
 */
function displayDailyReading() {
    const dayOfYear = getDayOfYear();
    const readingPlanString = planLookup.get(dayOfYear.toString());

    const titleEl = document.getElementById('daily-reading-title');
    const textEl = document.getElementById('daily-reading-text');

    if (!titleEl || !textEl) return;

    titleEl.innerText = `Today's Reading (Day ${dayOfYear})`;
    
    if (!readingPlanString) {
        textEl.innerHTML = `<p>No reading scheduled for today.</p>`;
        return;
    }

    // Handle multiple passages separated by semicolons
    const passages = readingPlanString.split(';').map(p => p.trim());
    let allVersesForDay = [];
    for (const passage of passages) {
        // Use our new, smart manager function
        allVersesForDay.push(...parseComplexPassage(passage));
    }

    let htmlOutput = `<p><strong>Reading Plan:</strong> ${readingPlanString}</p><hr>`;
    
    if (allVersesForDay.length > 0) {
        htmlOutput += `<p><strong>Generated Verse References (${allVersesForDay.length} total):</strong></p>`;
        // Display the list of references for debugging
        htmlOutput += `<pre style="white-space: pre-wrap; word-break: break-all;">${allVersesForDay.join('\n')}</pre>`;
    } else {
        htmlOutput += `<p><em>Could not expand references from the plan. Please check the format in ChronoBiblePlan.csv.</em></p>`;
    }

    textEl.innerHTML = htmlOutput;
}

// --- Other functions (unchanged) ---

function displayRandomVerse() {
    if (allVersesArray.length === 0) {
        const container = document.getElementById('random-verse-container');
        if (container) container.innerHTML = `<p>Could not load any verses. Please check that 'kjv.csv' is comma-separated.</p>`;
        return;
    }
    const randomVerse = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    const container = document.getElementById('random-verse-container');
    if (container) {
        container.innerHTML = `<p>"${randomVerse.text}"</p><footer>— ${randomVerse.reference}</footer>`;
    }
}

function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

async function main() {
    await loadData();
    document.querySelectorAll('.loading').forEach(el => el.style.display = 'none');
    displayRandomVerse();
    if (allVersesArray.length > 0) {
        setInterval(displayRandomVerse, 3600 * 1000);
    }
    displayDailyReading();
}

main();
