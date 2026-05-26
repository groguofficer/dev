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
 * NEW ROBUST PARSER: This is the core of the new logic.
 * It intelligently handles complex, comma-separated chapter lists.
 */
function parsePassage(passageStr) {
    const results = [];
    
    // Find the book name. This regex finds the longest string at the start
    // that ends with a letter, before the numbers start.
    const bookMatch = passageStr.match(/^([1-3]?\s?[a-zA-Z\s]+[a-zA-Z])/);
    if (!bookMatch) return []; // Cannot determine a book
    
    const book = bookMatch[1].trim();
    
    // Get the part of the string with the chapter/verse numbers
    const numberPart = passageStr.substring(book.length).trim();
    
    // Split the number part by commas
    const parts = numberPart.split(',');

    for (const part of parts) {
        const trimmedPart = part.trim();
        if (!trimmedPart) continue;

        // Re-attach the book name to create a standard reference
        const fullRef = `${book} ${trimmedPart}`;

        // Now we parse this standard reference (e.g., "Psalm 138-139")
        
        // Case 1: Chapter Range (e.g., "Psalm 138-139")
        const chapRangeMatch = fullRef.match(/^(.*\D)\s*(\d+)-(\d+)$/);
        if (chapRangeMatch) {
            const baseBook = chapRangeMatch[1].trim();
            const startChap = parseInt(chapRangeMatch[2], 10);
            const endChap = parseInt(chapRangeMatch[3], 10);
            for (let i = startChap; i <= endChap; i++) {
                const chapterKey = `${baseBook} ${i}`;
                const verses = chapterVerseMap.get(chapterKey) || [];
                verses.forEach(v => results.push(`${chapterKey}:${v}`));
            }
            continue; // Go to next part
        }

        // Case 2: Full Chapter (e.g., "Psalm 131")
        const verses = chapterVerseMap.get(fullRef);
        if (verses) {
            verses.forEach(v => results.push(`${fullRef}:${v}`));
            continue; // Go to next part
        }
    }
    
    return results;
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
    let failedPassages = [];

    for (const passage of passages) {
        const expanded = parsePassage(passage);
        if (expanded.length > 0) {
            allVersesForDay.push(...expanded);
        } else {
            failedPassages.push(passage);
        }
    }

    let htmlOutput = `<p><strong>Reading Plan:</strong> ${readingPlanString}</p><hr>`;
    
    if (allVersesForDay.length > 0) {
        htmlOutput += `<p><strong>Generated Verse References (${allVersesForDay.length} total):</strong></p>`;
        htmlOutput += `<pre style="white-space: pre-wrap; word-break: break-all;">${allVersesForDay.join('\n')}</pre>`;
    }
    
    if (failedPassages.length > 0) {
        htmlOutput += `<p style="color: red;"><strong>Could not parse the following parts of the plan:</strong></p>`;
        htmlOutput += `<pre style="color: red;">${failedPassages.join('\n')}</pre>`;
    }

    if (allVersesForDay.length === 0 && failedPassages.length > 0) {
        textEl.innerHTML = htmlOutput; // Show only error if nothing worked
    } else if (allVersesForDay.length === 0 && failedPassages.length === 0) {
        textEl.innerHTML = `<p><em>Could not expand references from the plan. The parser returned nothing.</em></p>`;
    } else {
        textEl.innerHTML = htmlOutput; // Show results and any errors
    }
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
