// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const KJV_CHAPTER_URL = 'kjv_by_chapter.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = [];
let verseLookup = new Map();
let chapterLookup = new Map();
let planLookup = new Map();

/**
 * Minimal CSV row parser that handles quoted fields containing commas.
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

/**
 * Fetches and parses the CSV files into our data stores.
 */
async function loadData() {
    try {
        const [kjvResponse, kjvChapterResponse, planResponse] = await Promise.all([
            fetch(KJV_URL),
            fetch(KJV_CHAPTER_URL),
            fetch(PLAN_URL)
        ]);

        if (!kjvResponse.ok || !kjvChapterResponse.ok || !planResponse.ok) {
            throw new Error('Network response was not ok.');
        }

        const kjvText = await kjvResponse.text();
        const kjvChapterText = await kjvChapterResponse.text();
        const planText = await planResponse.text();

        // --- Parsing logic for kjv.csv (for random verse, unchanged) ---
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length < 2) return;

            const reference = parts[0].trim();
            const text = parts.slice(1).join(',').trim().replace(/^"|"$/g, '');
            
            verseLookup.set(reference, text);
            allVersesArray.push({ reference, text });
        });

        // --- Parsing logic for kjv_by_chapter.csv (for daily reading) ---
        // Format: Chapter,"All verses joined as one string"
        // First row is a header ("Chapter,Verses") — skip it.
        const kjvChapterLines = kjvChapterText.trim().split('\n');
        kjvChapterLines.forEach((line, index) => {
            if (index === 0) return; // skip header row
            const trimmed = line.trim();
            if (!trimmed) return;

            const fields = parseCSVLine(trimmed);
            if (fields.length < 2) return;

            const chapter = fields[0].trim();
            const text = fields[1].trim();
            if (chapter) chapterLookup.set(chapter, text);
        });

        // --- Parsing logic for ChronoBiblePlan.csv (unchanged) ---
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
 * Returns chapter keys (e.g. "Genesis 1") for use with chapterLookup.
 *
 * Handles book names that start with a number (e.g. "1 Chronicles", "2 Kings").
 * The book name is everything up to and including the first word after a leading
 * digit-prefix (if any). The chapter/verse numbers come after the book name.
 *
 * Strategy: a leading digit followed by a space and letters is part of the book
 * name. The chapter number starts at the LAST run of digits in the string that
 * is preceded by a space (and not itself the book prefix).
 * Simpler approach: match the book name with a regex that allows an optional
 * leading digit, then capture the rest as the number part.
 */
function expandPassage(passageStr) {
    const results = [];

    // Match: optional leading digit + letters/spaces for book name,
    // then a space + digits... for the chapter/verse part.
    // Group 1: book name (e.g. "1 Chronicles", "Genesis", "Song of Solomon")
    // Group 2: chapter/verse number string (e.g. "26-29", "3:16", "1-5")
    const bookMatch = passageStr.match(/^(\d\s+[A-Za-z][\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d[\d\S]*)$/);
    if (!bookMatch) return [];

    const book = bookMatch[1].trim();
    const numberPart = bookMatch[2].trim();
    const parts = numberPart.split(',');

    for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        // Type A: Chapter Range (e.g., "1-5")
        if (trimmedPart.includes('-') && !trimmedPart.includes(':')) {
            const [start, end] = trimmedPart.split('-').map(n => parseInt(n, 10));
            for (let i = start; i <= end; i++) {
                results.push(`${book} ${i}`);
            }
        }
        // Type B: Verse Range (e.g., "1:1-5") — return whole chapter
        else if (trimmedPart.includes('-') && trimmedPart.includes(':')) {
            const chapter = trimmedPart.split(':')[0];
            results.push(`${book} ${chapter}`);
        }
        // Type C: Single Verse (e.g., "3:16") — return whole chapter
        else if (trimmedPart.includes(':')) {
            const chapter = trimmedPart.split(':')[0];
            results.push(`${book} ${chapter}`);
        }
        // Type D: Single Full Chapter (e.g., "1")
        else {
            results.push(`${book} ${trimmedPart}`);
        }
    }

    return [...new Set(results)];
}

/**
 * Displays the full text of the daily reading using kjv_by_chapter.csv.
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
    const allChaptersForDay = [];
    for (const passage of passages) {
        allChaptersForDay.push(...expandPassage(passage));
    }

    let htmlOutput = `<p><strong>Reading Plan:</strong> ${readingPlanString}</p><hr>`;
    
    if (allChaptersForDay.length > 0) {
        for (const chapterKey of allChaptersForDay) {
            const text = chapterLookup.get(chapterKey);
            if (text) {
                htmlOutput += `<h3>${chapterKey}</h3><p>${text}</p>`;
            } else {
                htmlOutput += `<p style="color:red;">--- CHAPTER NOT FOUND: ${chapterKey} ---</p>`;
            }
        }
    } else {
        htmlOutput += `<p style="color: red;"><strong>Parser Failure:</strong> The 'expandPassage' function could not generate any chapter references from the plan string.</p>`;
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
