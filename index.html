document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTS ---
    const hourlyVerseContainer = document.getElementById('hourly-verse-container');
    const bioyContainer = document.getElementById('bioy-container');
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');

    // --- DATA STORE ---
    // This array will be populated with data from the CSV file.
    let bibleData = [];

    // --- ASYNCHRONOUS DATA LOADING ---
    /**
     * Fetches and parses the 'kjv.csv' file.
     * This is an async function because fetching data over a network (even a local one) takes time.
     */
    async function loadBibleData() {
        try {
            const response = await fetch('kjv.csv');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            
            // Parse the CSV text into our bibleData array
            // .split('\n') creates an array of rows.
            // .slice(1) skips the header row.
            const rows = csvText.split('\n').slice(1);

            bibleData = rows
                .map(row => {
                    // This is a simple but fragile way to parse. It assumes the first comma
                    // always separates the reference from the verse text.
                    const firstCommaIndex = row.indexOf(',');
                    if (firstCommaIndex === -1) {
                        return null; // Skip malformed or empty rows
                    }

                    const ref = row.substring(0, firstCommaIndex).trim();
                    // Get the rest of the string after the first comma
                    let text = row.substring(firstCommaIndex + 1).trim();

                    // Clean up potential quotes that often wrap CSV fields
                    if (text.startsWith('"') && text.endsWith('"')) {
                        text = text.slice(1, -1);
                    }

                    if (ref && text) {
                        return { ref, text };
                    }
                    return null;
                })
                .filter(verse => verse !== null); // Filter out any null entries from parsing

            console.log(`Successfully loaded and parsed ${bibleData.length} verses.`);
            // Enable search functionality now that data is loaded
            searchInput.disabled = false;
            searchButton.disabled = false;
            searchInput.placeholder = "e.g., 'faith', 'love', 'John 3:16'";

        } catch (error) {
            console.error("Error loading or parsing bible data:", error);
            searchResultsContainer.innerHTML = `<p style="color: red;">Error: Could not load the bible data file (kjv.csv). Make sure it's in the correct directory and you are running a local server.</p>`;
            // Disable search if data fails to load
            searchInput.disabled = true;
            searchButton.disabled = true;
            searchInput.placeholder = "Data loading failed.";
        }
    }

    // --- HOURLY VERSE (Unchanged) ---
    const verseList = [
        "John 3:16", "Romans 8:28", "Philippians 4:13", "Proverbs 3:5", "Jeremiah 29:11",
        "1 Corinthians 10:13", "Ephesians 2:8", "Genesis 1:1", "Romans 5:8", "Joshua 1:9",
        "Hebrews 11:1", "2 Timothy 1:7", "1 John 4:8", "Matthew 6:33", "Isaiah 41:10",
        "Psalm 23:1", "Galatians 5:22-23", "Romans 12:2", "John 14:6", "Isaiah 53:5",
        "Matthew 28:19", "Acts 1:8", "Psalm 119:105", "Proverbs 4:23"
    ];

    function fetchHourlyVerse() {
        const currentHour = new Date().getHours();
        const verseReference = verseList[currentHour];
        fetch(`https://bible-api.com/${verseReference}`)
            .then(response => response.json())
            .then(data => {
                hourlyVerseContainer.innerHTML = `<blockquote>${data.text.trim()}</blockquote><cite>${data.reference}</cite>`;
            })
            .catch(error => {
                console.error("Error fetching hourly verse:", error);
                hourlyVerseContainer.innerHTML = `<p>Could not load verse.</p>`;
            });
    }

    // --- BIBLE IN ONE YEAR (Unchanged) ---
    function getBioyReadings() {
        const readings = {
            "psalm": "Psalm 1:1-6",
            "newTestament": "Matthew 1:1-25",
            "oldTestament": "Genesis 1:1-2:25"
        };
        bioyContainer.innerHTML = `<p><strong>Psalms/Proverbs:</strong> ${readings.psalm}</p><p><strong>New Testament:</strong> ${readings.newTestament}</p><p><strong>Old Testament:</strong> ${readings.oldTestament}</p><small>Note: This is a static daily reading for demonstration.</small>`;
    }

    // --- VERSE SEARCH (UPDATED) ---
    function handleSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
            searchResultsContainer.innerHTML = "<p>Please enter a search term.</p>";
            return;
        }

        // Search through the bibleData array loaded from the CSV
        const results = bibleData.filter(verse => 
            verse.text.toLowerCase().includes(query) || 
            verse.ref.toLowerCase().includes(query)
        );

        const topResults = results.slice(0, 3);
        displaySearchResults(topResults, results.length);
    }

    function displaySearchResults(results, totalFound) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = "<p>No verses found matching your query.</p>";
            return;
        }

        let html = `<h3>Showing Top ${results.length} of ${totalFound} Results:</h3>`;
        results.forEach(verse => {
            html += `
                <div class="search-result-item">
                    <p class="verse-ref">${verse.ref}</p>
                    <p>"${verse.text}"</p>
                </div>
            `;
        });
        searchResultsContainer.innerHTML = html;
    }

    // --- EVENT LISTENERS ---
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });

    // --- INITIALIZATION ---
    function initializeApp() {
        // Disable search until data is loaded
        searchInput.disabled = true;
        searchButton.disabled = true;
        searchInput.placeholder = "Loading bible data...";

        // Start loading the bible data from CSV
        loadBibleData();

        // These can run immediately
        fetchHourlyVerse();
        getBioyReadings();
    }

    initializeApp();
});
