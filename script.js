// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = []; // Array for picking a random verse
let verseLookup = new Map(); // Map for fast lookup by reference
let planLookup = new Map(); // Map for the daily reading plan

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

        // Parse KJV data
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const reference = parts[0].trim();
                const text = parts.slice(1).join(',').trim(); // Handle commas in verse text
                allVersesArray.push({ reference, text });
                verseLookup.set(reference, text);
            }
        });

        // Parse Chronological Plan data
        const planLines = planText.trim().split('\n');
        planLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const day = parts[0].trim();
                const references = parts[1].trim();
                planLookup.set(day, references);
            }
        });

    } catch (error) {
        console.error("Failed to load bible data:", error);
        document.body.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load data files. Make sure '${KJV_URL}' and '${PLAN_URL}' exist in the repository.</p>`;
    }
}

/**
 * Displays a random verse from the loaded KJV data.
 */
function displayRandomVerse() {
    if (allVersesArray.length === 0) return;

    const randomVerse = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    const container = document.getElementById('random-verse-container');
    
    container.innerHTML = `
        <p>"${randomVerse.text}"</p>
        <footer>— ${randomVerse.reference}</footer>
    `;
}

/**
 * Calculates the current day of the year (1-366).
 */
function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

/**
 * Expands a reference string (e.g., "Genesis 1:1-3") into an array of individual references.
 */
function expandReferenceRange(refString) {
    const rangeMatch = refString.match(/^(.*\s\d+:)(\d+)-(\d+)$/);
    if (rangeMatch) {
        const base = rangeMatch[1];
        const start = parseInt(rangeMatch[2], 10);
        const end = parseInt(rangeMatch[3], 10);
        let verses = [];
        for (let i = start; i <= end; i++) {
            verses.push(`${base}${i}`);
        }
        return verses;
    }
    return [refString]; // Not a range
}

/**
 * Displays the reading for the current day.
 */
function displayDailyReading() {
    const dayOfYear = getDayOfYear();
    const readingRefs = planLookup.get(dayOfYear.toString());

    const titleEl = document.getElementById('daily-reading-title');
    const textEl = document.getElementById('daily-reading-text');

    if (!readingRefs) {
        titleEl.innerText = `Day ${dayOfYear}`;
        textEl.innerHTML = `<p>No reading scheduled for today.</p>`;
        return;
    }

    titleEl.innerText = `Today's Reading (Day ${dayOfYear}): ${readingRefs}`;
    
    let htmlOutput = '';
    const passages = readingRefs.split(';').map(p => p.trim());
    
    passages.forEach(passage => {
        const individualRefs = expandReferenceRange(passage);
        individualRefs.forEach(ref => {
            const text = verseLookup.get(ref);
            if (text) {
                htmlOutput += `<p><strong>${ref}:</strong> ${text}</p>`;
            } else {
                htmlOutput += `<p><strong>${ref}:</strong> <em style="color: #999;">--- Verse not found ---</em></p>`;
            }
        });
    });

    textEl.innerHTML = htmlOutput;
}

/**
 * Main function to initialize the page.
 */
async function main() {
    await loadData();

    if (verseLookup.size > 0 && planLookup.size > 0) {
        // Set up the random verse generator
        displayRandomVerse();
        setInterval(displayRandomVerse, 3600 * 1000); // Update every hour

        // Set up the daily reading
        displayDailyReading();
    }
}

// The 'defer' attribute in the <script> tag in index.html ensures this code runs
// after the document is parsed, so we can just call main() directly.
main();
