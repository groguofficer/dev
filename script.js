// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = []; // For the random verse generator
let planLookup = new Map(); // For the daily reading plan

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

        // --- ORIGINAL METHOD: Parsing logic for kjv.csv (comma-separated) ---
        // This is the simplest, most standard way to parse a CSV file.
        // It assumes the reference and text are separated by a comma.
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const reference = parts[0].trim();
                // This correctly handles cases where the verse text itself contains commas
                const text = parts.slice(1).join(',').trim();
                allVersesArray.push({ reference, text });
            }
        });

        // --- CORRECT: Parsing logic for ChronoBiblePlan.csv (space-separated) ---
        // This logic correctly handles the space-separated plan file and ignores stray commas.
        const planLines = planText.trim().split('\n');
        planLines.forEach(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^(\d+)\s*,?\s*(.*)$/);

            if (match) {
                const day = match[1];
                const references = match[2].trim();
                planLookup.set(day, references);
            }
        });

    } catch (error) {
        console.error("Failed to load bible data:", error);
        document.body.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load data files. Make sure '${KJV_URL}' and '${PLAN_URL}' exist in the repository.</p>`;
    }
}

/**
 * Displays a random verse from the loaded KJV data. (Left Column)
 */
function displayRandomVerse() {
    if (allVersesArray.length === 0) {
        const container = document.getElementById('random-verse-container');
        if (container) container.innerHTML = `<p>Could not load any verses. Please check that the 'kjv.csv' file is comma-separated.</p>`;
        return;
    }

    const randomVerse = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    const container = document.getElementById('random-verse-container');
    
    if (container) {
        container.innerHTML = `
            <p>"${randomVerse.text}"</p>
            <footer>— ${randomVerse.reference}</footer>
        `;
    }
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
 * Displays the reading plan for the current day. (Right Column)
 */
function displayDailyReading() {
    const dayOfYear = getDayOfYear();
    const readingRefs = planLookup.get(dayOfYear.toString());

    const titleEl = document.getElementById('daily-reading-title');
    const textEl = document.getElementById('daily-reading-text');

    if (!titleEl || !textEl) return;

    titleEl.innerText = `Today's Reading Plan`;
    
    let htmlOutput = `<p><strong>Day of the Year:</strong> ${dayOfYear}</p>`;

    if (readingRefs) {
        htmlOutput += `<p><strong>Reading for Today:</strong> ${readingRefs}</p>`;
    } else {
        htmlOutput += `<p><strong>Reading for Today:</strong> No reading scheduled for today.</p>`;
    }

    textEl.innerHTML = htmlOutput;
}

/**
 * Main function to initialize the page.
 */
async function main() {
    await loadData();

    // Hide loading indicators once data processing is done
    document.querySelectorAll('.loading').forEach(el => el.style.display = 'none');

    // Set up the random verse generator. It will show an error if it failed.
    displayRandomVerse();
    if (allVersesArray.length > 0) {
        setInterval(displayRandomVerse, 3600 * 1000); // Update every hour only if successful
    }
    
    // Display the daily reading plan
    displayDailyReading();
}

// Run the main function.
main();
