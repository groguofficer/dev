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
            const text = parts.slice(1).join(',').trim().replace(/^"|"$/g, '');
            
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
 * THE DEFINITIVE PARSER: Simple, robust, and step-by-step.
 */
function expandPassage(passageStr) {
    const results = [];
    
    // Step 1: Find the first digit in the string.
    const firstDigitIndex = passageStr.search(/\d/);
    if (firstDigitIndex === -1) {
        return []; // If there are no numbers, we can't parse it.
    }

    // Step 2: The book is everything BEFORE the first digit.
    const book = passageStr.substring(0, firstDigitIndex).trim();
    
    // Step 3: The number string is everything FROM the first digit onward.
    const numberPart = passageStr.substring(firstDigitIndex).trim();
    
    // Step 4: Split the number string by commas to handle lists.
    const parts = numberPart.split(',');

    for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        // Step 5: Process each part using the book as context.
        
        // Type A: Chapter Range (e.g., "1-5" or "138-139")
        if (trimmedPart.includes('-') && !trimmedPart.includes(':')) {
            const [start, end] = trimmedPart.split('-').map(n => parseInt(n, 10));
            for (let i = start; i <= end; i++) {
                const chapterKey = `${book} ${i}`;
                const verses = chapterVerseMap.get(chapterKey) || [];
                verses.forEach(v => results.push(`${chapterKey}:${v}`));
            }
        }
        // Type B: Verse Range (e.g., "1:1-5")
        else if (trimmedPart.includes('-') && trimmedPart.includes(':')) {
            const [chapter, verseRange] = trimmedPart.split(':');
            const [start, end] = verseRange.split('-').map(n => parseInt(n, 10));
            const chapterKey = `${book} ${chapter}`;
            for (let i = start; i <= end; i++) {
                results.push(`${chapterKey}:${i}`);
            }
        }
        // Type C: Single Verse (e.g., "3:16")
        else if (trimmedPart.includes(':')) {
            const chapterKey = `${book} ${trimmedPart}`;
            results.push(chapterKey);
        }
        // Type D: Single Full Chapter (e.g., "131")
        else {
            const chapterKey = `${book} ${trimmedPart}`;
            const verses = chapterVerseMap.get(chapterKey) || [];
            verses.forEach(v => results.push(`${chapterKey}:${v}`));
        }
    }
    
    return results;
}


/**
 * FINAL VERSION: Displays the FULL TEXT of the daily reading.
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

    const passages = readingPlanString.split(';').map(p => p.trim());
    let allVersesForDay = [];
    for (const passage of passages) {
        allVersesForDay.push(...expandPassage(passage));
    }

    let htmlOutput = `<p><strong>Reading Plan:</strong> ${readingPlanString}</p><hr>`;
    
    if (allVersesForDay.length > 0) {
        for (const verseRef of allVersesForDay) {
            const text = verseLookup.get(verseRef) || `--- VERSE NOT FOUND for ${verseRef} ---`;
            htmlOutput += `<p><strong>${verseRef}:</strong> ${text}</p>`;
        }
    } else {
        htmlOutput += `<p style="color: red;"><strong>Parser Failure:</strong> The 'expandPassage' function could not generate any verse references from the plan string.</p>`;
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
