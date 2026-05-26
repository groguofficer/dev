// --- CONFIGURATION ---
const KJV_URL = 'kjv.csv';
const PLAN_URL = 'ChronoBiblePlan.csv';

// --- GLOBAL DATA STORES ---
// allVersesArray is for the random verse generator (left column)
let allVersesArray = []; 
// planLookup is for the daily reading plan (right column)
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

        // Parse KJV data for the random verse generator
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const reference = parts[0].trim();
                const text = parts.slice(1).join(',').trim(); // Handle commas in verse text
                allVersesArray.push({ reference, text });
            }
        });

        // Parse Chronological Plan data for the daily reading
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
 * Displays a random verse from the loaded KJV data. (Left Column)
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
 * Displays the reading plan for the current day. (Right Column)
 * This version ONLY shows the day and the references, not the full text.
 */
function displayDailyReading() {
    const dayOfYear = getDayOfYear();
    const readingRefs = planLookup.get(dayOfYear.toString());

    const titleEl = document.getElementById('daily-reading-title');
    const textEl = document.getElementById('daily-reading-text');

    // Update the main title for the column
    titleEl.innerText = `Today's Reading Plan`;
    
    let htmlOutput = '';

    // Add the day of the year to the display
    htmlOutput += `<p><strong>Day of the Year:</strong> ${dayOfYear}</p>`;

    if (readingRefs) {
        // Display the reference string directly from the plan file
        htmlOutput += `<p><strong>Reading for Today:</strong> ${readingRefs}</p>`;
    } else {
        // Handle case where there is no reading for today
        htmlOutput += `<p><strong>Reading for Today:</strong> No reading scheduled for today.</p>`;
    }

    // Set the content of the right column
    textEl.innerHTML = htmlOutput;
}

/**
 * Main function to initialize the page.
 */
async function main() {
    await loadData();

    // Check if data loaded successfully before setting up the page
    if (allVersesArray.length > 0 && planLookup.size > 0) {
        // Set up the random verse generator (left column)
        displayRandomVerse();
        setInterval(displayRandomVerse, 3600 * 1000); // Update every hour

        // Set up the daily reading plan (right column)
        displayDailyReading();
    } else {
        // If data loading failed, the error message is already shown.
        // We can hide the loading indicators.
        document.querySelectorAll('.loading').forEach(el => el.style.display = 'none');
    }
}

// Run the main function once the DOM is ready.
main();
