// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const KJV_CHAPTER_URL = 'kjv_by_chapter.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';
const SPURGEON_URL = 'spurgeon_morning_and_evening.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = [];
let verseLookup = new Map();
let chapterLookup = new Map();
let planLookup = new Map();
let spurgeonDevotionals = []; // Stores objects: { date: "January 1", period: "Morning", text: "..." }

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
        const [kjvResponse, kjvChapterResponse, planResponse, spurgeonResponse] = await Promise.all([
            fetch(KJV_URL),
            fetch(KJV_CHAPTER_URL),
            fetch(PLAN_URL),
            fetch(SPURGEON_URL)
        ]);

        if (!kjvResponse.ok || !kjvChapterResponse.ok || !planResponse.ok || !spurgeonResponse.ok) {
            throw new Error('Network response was not ok.');
        }

        const kjvText = await kjvResponse.text();
        const kjvChapterText = await kjvChapterResponse.text();
        const planText = await planResponse.text();
        const spurgeonText = await spurgeonResponse.text();

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

        // --- Parsing logic for ChronoBiblePlan.csv ---
        const planLines = planText.trim().split('\n');
        planLines.forEach(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^(\d+)\s*,?\s*(.*)$/);
            if (match) {
                planLookup.set(match[1], match[2].trim());
            }
        });

        // --- Parsing logic for spurgeon_morning_and_evening.csv ---
        // Expected columns: Date, Period (Morning/Evening), Content
        const spurgeonLines = spurgeonText.trim().split('\n');
        spurgeonLines.forEach((line, index) => {
            if (index === 0) return; // Skip header row
            const trimmed = line.trim();
            if (!trimmed) return;

            const fields = parseCSVLine(trimmed);
            if (fields.length >= 3) {
                spurgeonDevotionals.push({
                    date: fields[0].trim().replace(/^"|"$/g, ''),       // e.g., "January 1"
                    period: fields[1].trim().replace(/^"|"$/g, ''),     // e.g., "Morning" or "Evening"
                    text: fields.slice(2).join(',').trim().replace(/^"|"$/g, '') // The devotional entry
                });
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

    const bookMatch = passageStr.match(/^(\d\s+[A-Za-z][\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d[\d\S]*)$/);
    if (!bookMatch) return [];

    const book = bookMatch[1].trim();
    const numberPart = bookMatch[2].trim();
    const parts = numberPart.split(',');

    for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        if (trimmedPart.includes('-') && !trimmedPart.includes(':')) {
            const [start, end] = trimmedPart.split('-').map(n => parseInt(n, 10));
            for (let i = start; i <= end; i++) {
                results.push(`${book} ${i}`);
            }
        }
        else if (trimmedPart.includes('-') && trimmedPart.includes(':')) {
            const chapter = trimmedPart.split(':')[0];
            results.push(`${book} ${chapter}`);
        }
        else if (trimmedPart.includes(':')) {
            const chapter = trimmedPart.split(':')[0];
            results.push(`${book} ${chapter}`);
        }
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

/**
 * Extracts and displays Spurgeon's Morning and Evening devotionals for today.
 * Looks for matching DOM elements 'spurgeon-morning' and 'spurgeon-evening'.
 */
function displaySpurgeonDevotional() {
    const now = new Date();
    
    // Format current date to match CSV targeting style (e.g., "January 1")
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const todayString = `${months[now.getMonth()]} ${now.getDate()}`;

    const morningEl = document.getElementById('spurgeon-morning');
    const eveningEl = document.getElementById('spurgeon-evening');

    // Find the entries in our parsed data array
    const morningDevotion = spurgeonDevotionals.find(d => d.date === todayString && d.period.toLowerCase() === 'morning');
    const eveningDevotion = spurgeonDevotionals.find(d => d.date === todayString && d.period.toLowerCase() === 'evening');

    if (morningEl) {
        morningEl.innerHTML = morningDevotion 
            ? `<h3>Morning Devotional — ${todayString}</h3><p>${morningDevotion.text}</p>`
            : `<h3>Morning Devotional</h3><p>No entry found for today.</p>`;
    }

    if (eveningEl) {
        eveningEl.innerHTML = eveningDevotion 
            ? `<h3>Evening Devotional — ${todayString}</h3><p>${eveningDevotion.text}</p>`
            : `<h3>Evening Devotional</h3><p>No entry found for today.</p>`;
    }
}

function displayRandomVerse() {
    if (allVersesArray.length === 0) {
        const container = document.getElementById('random-verse-container');
        if (container) container.innerHTML = `<p>
