// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTS ---
    const hourlyVerseContainer = document.getElementById('hourly-verse-container');
    const bioyContainer = document.getElementById('bioy-container');
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');

    // --- HOURLY VERSE ---
    // In a real app, you might want to cycle through a more curated list.
    // This list provides 24 verses, one for each hour of the day.
    const verseList = [
        "John 3:16", "Romans 8:28", "Philippians 4:13", "Proverbs 3:5", "Jeremiah 29:11",
        "1 Corinthians 10:13", "Ephesians 2:8", "Genesis 1:1", "Romans 5:8", "Joshua 1:9",
        "Hebrews 11:1", "2 Timothy 1:7", "1 John 4:8", "Matthew 6:33", "Isaiah 41:10",
        "Psalm 23:1", "Galatians 5:22-23", "Romans 12:2", "John 14:6", "Isaiah 53:5",
        "Matthew 28:19", "Acts 1:8", "Psalm 119:105", "Proverbs 4:23"
    ];

    function fetchHourlyVerse() {
        const currentHour = new Date().getHours(); // 0-23
        const verseReference = verseList[currentHour];
        
        // Using bible-api.com, a simple, no-key API
        fetch(`https://bible-api.com/${verseReference}`)
            .then(response => response.json())
            .then(data => {
                hourlyVerseContainer.innerHTML = `
                    <blockquote>${data.text.trim()}</blockquote>
                    <cite>${data.reference}</cite>
                `;
            })
            .catch(error => {
                console.error("Error fetching hourly verse:", error);
                hourlyVerseContainer.innerHTML = `<p>Could not load verse. Please try again later.</p>`;
            });
    }

    // --- BIBLE IN ONE YEAR (MOCK DATA) ---
    // In a real app, this would come from a dedicated API or a larger local data file.
    // This is a simplified example.
    function getBioyReadings() {
        // This is a placeholder. A real implementation would calculate the day of the year
        // and fetch the corresponding reading from a full schedule.
        const today = new Date().toDateString();
        const readings = {
            "psalm": "Psalm 1:1-6",
            "newTestament": "Matthew 1:1-25",
            "oldTestament": "Genesis 1:1-2:25"
        };

        bioyContainer.innerHTML = `
            <p><strong>Psalms/Proverbs:</strong> ${readings.psalm}</p>
            <p><strong>New Testament:</strong> ${readings.newTestament}</p>
            <p><strong>Old Testament:</strong> ${readings.oldTestament}</p>
            <small>Note: This is a static daily reading for demonstration.</small>
        `;
    }

    // --- VERSE SEARCH (MOCK FUNCTIONALITY) ---
    // A real search would use a backend service or a dedicated Bible search API.
    // This mock database simulates searching against a small set of verses.
    const verseDatabase = [
        { ref: "Philippians 4:13", text: "I can do all this through him who gives me strength.", keywords: ["strength", "power", "can do"] },
        { ref: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding.", keywords: ["trust", "heart", "understanding", "faith"] },
        { ref: "Jeremiah 29:11", text: "For I know the plans I have for you,” declares the Lord, “plans to prosper you and not to harm you, plans to give you hope and a future.", keywords: ["plans", "hope", "future", "prosper"] },
        { ref: "John 14:27", text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.", keywords: ["peace", "troubled", "afraid", "heart"] },
        { ref: "Romans 8:38-39", text: "For I am convinced that neither death nor life... will be able to separate us from the love of God that is in Christ Jesus our Lord.", keywords: ["love", "separate", "convinced", "God's love"] },
        { ref: "1 John 4:7", text: "Dear friends, let us love one another, for love comes from God. Everyone who loves has been born of God and knows God.", keywords: ["love", "one another", "friends", "God's love"] },
        { ref: "Matthew 11:28", text: "Come to me, all you who are weary and burdened, and I will give you rest.", keywords: ["rest", "weary", "burdened", "tired"] }
    ];

    function handleSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
            searchResultsContainer.innerHTML = "<p>Please enter a search term.</p>";
            return;
        }

        const results = verseDatabase.filter(verse => 
            verse.keywords.some(keyword => keyword.includes(query)) || verse.text.toLowerCase().includes(query)
        );

        // Limit to top 3 results
        const topResults = results.slice(0, 3);

        displaySearchResults(topResults);
    }

    function displaySearchResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = "<p>No verses found matching your query.</p>";
            return;
        }

        let html = '<h3>Top Results:</h3>';
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
    // Allow pressing Enter in the input field to trigger the search
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });

    // --- INITIALIZATION ---
    fetchHourlyVerse();
    getBioyReadings();
});
