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

        // --- PARSING LOGIC CORRECTION FOR kjv.csv ---
        // This section is updated to handle space-separated reference and text.
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const trimmedLine = line.trim();
            
            // Regex to capture the full reference (including multi-word books) 
            // and the verse text separately.
            // Example: "1 Samuel 1:1 Now there was a certain man..."
            // match[1] will be "1 Samuel 1:1"
            // match[2] will be "Now there was a certain man..."
            const match = trimmedLine.match(/^(.+?\s\d+:\d+)\s+(.*)$/);

            if (match) {
                const reference = match[1];
                const text = match[2];
                allVersesArray.push({ reference, text });
            }
        });

        // --- PARSING LOGIC FOR ChronoBiblePlan.csv ---
        // This logic correctly handles the space-separated plan file.
        const planLines = planText.trim().split('\n');
        planLines.forEach(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^(\d+)\s+(.*)$/);

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
        container.innerHTML = `<p>Could not load any verses.</p>`;
        return;
    }

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
 * Displays the reading plan for the current day. (Right Column)
 */
function displayDailyReading() {
    const dayOfYear = getDayOfYear();
    const readingRefs = planLookup.get(dayOfYear.toString());

    const titleEl = document.getElementById('daily-reading-title');
    const textEl = document.getElementById('daily-reading-text');

    titleEl.innerText = `Today's Reading Plan`;
    
    let htmlOutput = '';
    htmlOutput += `<p><strong>Day of the Year:</strong> ${dayOfYear}</p>`;

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

    // Check if data loaded successfully before setting up the page
    if (allVersesArray.length > 0) {
        // Set up the random verse generator (left column)
        displayRandomVerse();
        setInterval(displayRandomVerse, 3600 * 1000); // Update every hour
    }
    
    // The daily reading display should run regardless, to show "not found" if needed.
    displayDailyReading();

    // Hide loading indicators
    document.querySelectorAll('.loading').forEach(el => el.style.display = 'none');
}

// Run the main function.
main();
