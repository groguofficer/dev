// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = [];    // For the random verse generator
let verseLookup = new Map();      // For fast verse lookup by reference (e.g., "Genesis 1:1")
let chapterVerseMap = new Map();  // Maps a chapter (e.g., "Psalm 131") to its verse numbers [1, 2, 3...]
let planLookup = new Map();       // For the daily reading plan

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
        // This now populates all three KJV data structures.
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length < 2) return;

            const reference = parts[0].trim();
            const text = parts.slice(1).join(',').trim();
            
            // 1. For Random Verse Generator
            allVersesArray.push({ reference, text });
            
            // 2. For Fast Verse Lookup
            verseLookup.set(reference, text);

            // 3. For Chapter-to-Verse Mapping (e.g., "Psalm 131" -> [1, 2, 3])
            const chapterMatch = reference.match(/^(.*\s\d+):(\d+)$/);
            if (chapterMatch) {
                const chapterKey = chapterMatch[1]; // "Psalm 131"
                const verseNum = parseInt(chapterMatch[2], 10);
                if (!chapterVerseMap.has(chapterKey)) {
                    chapterVerseMap.set(chapterKey, []);
                }
                chapterVerseMap.get(chapterKey).push(verseNum);
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
        document.body.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load data files. Make sure '${KJV_URL}' and '${PLAN_URL}' exist in the repository.</p>`;
    }
}

/**
 * Expands complex reference strings into a list of individual verse references.
 * e.g., "Psalm 131, 138-139, 143-145" -> ["Psalm 131:1", "Psalm 131:2", ...]
 */
function expandComplexReference(refString) {
    const allVerseRefs = [];
    const bookMatch = refString.match(/^([1-3]?\s?[a-zA-Z]+)\s*(.*)/);
    if (!bookMatch) return []; // Not a valid format

    const book = bookMatch[1].trim(); // "Psalm"
    const chapterParts = bookMatch[2].split(',').map(p => p.trim()); // ["131", "138-139", "143-145"]

    for (const part of chapterParts) {
        if (part.includes('-')) {
            // It's a range like "138-139"
            const [start, end] = part.split('-').map(n => parseInt(n, 10));
            for (let i = start; i <= end; i++) {
                const chapterKey = `${book} ${i}`;
                const verses = chapterVerseMap.get(chapterKey) || [];
                for (const verse of verses) {
                    allVerseRefs.push(`${chapterKey}:${verse}`);
                }
            }
        } else {
            // It's a single chapter like "131"
            const chapterKey = `${book} ${part}`;
            const verses = chapterVerseMap.get(chapterKey) || [];
            for (const verse of verses) {
                allVerseRefs.push(`${chapterKey}:${verse}`);
            }
        }
    }
    return allVerseRefs;
}

/**
 * Displays the full text of the reading for the current day. (Right Column)
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

    // Handle multiple passages in one day, e.g., "Genesis 1-2; John 1"
    const passages = readingPlanString.split(';').map(p => p.trim());
    let allVersesForDay = [];
    for (const passage of passages) {
        allVersesForDay.push(...expandComplexReference(passage));
    }

    if (allVersesForDay.length === 0) {
        textEl.innerHTML = `<p><strong>Reading for Today:</strong> ${readingPlanString}</p><p><em>(Could not expand verses. Check format.)</em></p>`;
        return;
    }
    
    let htmlOutput = `<p><strong>Reading for Today:</strong> ${readingPlanString}</p><hr>`;
    for (const verseRef of allVersesForDay) {
        const text = verseLookup.get(verseRef) || "--- VERSE NOT FOUND ---";
        htmlOutput += `<p><strong>${verseRef}:</strong> ${text}</p>`;
    }

    textEl.innerHTML = htmlOutput;
}

// --- Other functions (unchanged) ---

function displayRandomVerse() {
    if (allVersesArray.length === 0) {
        const container = document.getElementById('random-verse-container');
        if (container) container.innerHTML = `<p>Could not load any verses. Please check that the 'kjv.csv' file is comma-separated.</p>`;
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
