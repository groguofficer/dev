// --- CONFIGURATION ---
const KJV_URL      = 'kjv.csv';
const KJV_CHAPTER_URL = 'kjv_by_chapter.csv';
const PLAN_URL     = 'ChronoBiblePlan.csv';
const SPURGEON_URL = 'spurgeon_morning_and_evening.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = [];
let chapterLookup  = new Map();
let planLookup     = new Map();
let spurgeonLookup = new Map(); // key: "January 1" → { Morning: "...", Evening: "..." }

// ============================================================
//  CSV PARSERS
// ============================================================

/**
 * Full RFC-4180 CSV parser.
 * Correctly handles quoted fields that contain commas AND embedded newlines.
 * Returns an array of rows, each row being an array of field strings.
 */
function parseCSVFull(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                // Peek ahead: two double-quotes = escaped quote inside field
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i++;
                }
            } else {
                field += ch;
                i++;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
            } else if (ch === ',') {
                row.push(field);
                field = '';
                i++;
            } else if (ch === '\r' && text[i + 1] === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
                i += 2;
            } else if (ch === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
                i++;
            } else {
                field += ch;
                i++;
            }
        }
    }

    // Last field/row
    if (field || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

// ============================================================
//  DATA LOADING
// ============================================================

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.text();
}

async function loadData() {
    // Load core files — if these fail, show an error
    let kjvText, kjvChapterText, planText;
    try {
        [kjvText, kjvChapterText, planText] = await Promise.all([
            fetchText(KJV_URL),
            fetchText(KJV_CHAPTER_URL),
            fetchText(PLAN_URL)
        ]);
    } catch (err) {
        console.error('Failed to load core Bible data:', err);
        document.body.innerHTML = `<p style="color:red;text-align:center;padding:40px;">
            Error: Could not load data files (${err.message}).<br>
            Make sure you are running this from a local web server, not directly from the filesystem.
        </p>`;
        return;
    }

    // --- Parse kjv.csv (for random verse) ---
    // Format: Reference,Verse text  (no header, no quoting)
    kjvText.trim().split('\n').forEach(line => {
        const comma = line.indexOf(',');
        if (comma === -1) return;
        const reference = line.slice(0, comma).trim();
        const text = line.slice(comma + 1).trim().replace(/^"|"$/g, '');
        if (reference && text) allVersesArray.push({ reference, text });
    });

    // --- Parse kjv_by_chapter.csv (for daily reading) ---
    // Format: Chapter,"All verses..."  (has header row)
    const chapterRows = parseCSVFull(kjvChapterText);
    chapterRows.forEach((row, idx) => {
        if (idx === 0) return; // skip header
        if (row.length < 2) return;
        const chapter = row[0].trim();
        const text    = row[1].trim();
        if (chapter) chapterLookup.set(chapter, text);
    });

    // --- Parse ChronoBiblePlan.csv ---
    planText.trim().split('\n').forEach(line => {
        const match = line.trim().match(/^(\d+)\s*,?\s*(.*)$/);
        if (match) planLookup.set(match[1], match[2].trim());
    });

    // --- Parse spurgeon_morning_and_evening.csv (optional) ---
    // This file has multiline quoted fields, so we MUST use the full CSV parser.
    try {
        const spurgeonText = await fetchText(SPURGEON_URL);
        const rows = parseCSVFull(spurgeonText);
        rows.forEach((row, idx) => {
            if (idx === 0) return; // skip header: "date","time","content"
            if (row.length < 3) return;
            const date    = row[0].trim();
            const time    = row[1].trim();
            const content = row[2].trim();
            if (!date || !time || !content) return;
            if (!spurgeonLookup.has(date)) spurgeonLookup.set(date, {});
            spurgeonLookup.get(date)[time] = content;
        });
    } catch (err) {
        console.warn('Spurgeon file could not be loaded:', err.message);
        // Non-fatal — other sections still work
    }
}

// ============================================================
//  DISPLAY FUNCTIONS
// ============================================================

function displayRandomVerse() {
    const container = document.getElementById('random-verse-container');
    if (!container) return;
    if (allVersesArray.length === 0) {
        container.innerHTML = `<p>Could not load any verses. Check that kjv.csv is present.</p>`;
        return;
    }
    const v = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    container.innerHTML = `<p>"${v.text}"</p><footer>— ${v.reference}</footer>`;
}

function getTodayDateKey() {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getDate()}`;
}

function displaySpurgeon() {
    const labelEl   = document.getElementById('spurgeon-date-label');
    const container = document.getElementById('spurgeon-container');
    if (!container) return;

    const dateKey = getTodayDateKey();
    if (labelEl) labelEl.textContent = dateKey;

    const entries = spurgeonLookup.get(dateKey);
    if (!entries) {
        container.innerHTML = `<p class="not-found">No devotional found for ${dateKey}.</p>`;
        return;
    }

    let html = '';
    ['Morning', 'Evening'].forEach((session, idx) => {
        const text = entries[session];
        if (!text) return;

        // Pull out the opening scripture reference: "...verse text..."-Book chapter:verse
        // Pattern: opening quote, text, closing quote, dash, book ref with digits
        let verseRef = '';
        let body = text;
        const refMatch = text.match(/^(\u201c[^\u201d]*\u201d\s*[-\u2013\u2014]\s*[A-Za-z0-9 :]+)/);
        if (refMatch) {
            verseRef = refMatch[1].trim();
            body = text.slice(refMatch[0].length).trim();
        } else {
            // Fallback: try straight quotes
            const refMatch2 = text.match(/^(".*?"\s*-\s*[\w\s]+\d+:\d+)/);
            if (refMatch2) {
                verseRef = refMatch2[1].trim();
                body = text.slice(refMatch2[0].length).trim();
            }
        }

        if (idx > 0) html += '<hr class="spurgeon-divider">';
        html += `<div class="spurgeon-entry">`;
        html += `  <div class="spurgeon-time">${session}</div>`;
        if (verseRef) html += `  <div class="spurgeon-verse">${verseRef}</div>`;
        html += `  <div class="spurgeon-body">${body}</div>`;
        html += `</div>`;
    });

    container.innerHTML = html || `<p class="not-found">No entries for ${dateKey}.</p>`;
}

function expandPassage(passageStr) {
    const results = [];
    const bookMatch = passageStr.match(/^(\d\s+[A-Za-z][\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d[\d\S]*)$/);
    if (!bookMatch) return [];
    const book = bookMatch[1].trim();
    const parts = bookMatch[2].trim().split(',');
    for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        if (p.includes('-') && !p.includes(':')) {
            const [s, e] = p.split('-').map(n => parseInt(n, 10));
            for (let i = s; i <= e; i++) results.push(`${book} ${i}`);
        } else if (p.includes(':')) {
            results.push(`${book} ${p.split(':')[0]}`);
        } else {
            results.push(`${book} ${p}`);
        }
    }
    return [...new Set(results)];
}

function displayDailyReading() {
    const dayOfYear = getDayOfYear();
    const titleEl = document.getElementById('daily-reading-title');
    const textEl  = document.getElementById('daily-reading-text');
    if (!titleEl || !textEl) return;

    titleEl.innerText = `Today's Reading (Day ${dayOfYear})`;
    const planStr = planLookup.get(dayOfYear.toString());
    if (!planStr) {
        textEl.innerHTML = `<p>No reading scheduled for today.</p>`;
        return;
    }

    const chapters = planStr.split(';').flatMap(p => expandPassage(p.trim()));
    let html = `<p><strong>Reading Plan:</strong> ${planStr}</p><hr>`;
    if (chapters.length > 0) {
        for (const key of chapters) {
            const text = chapterLookup.get(key);
            html += text
                ? `<h3>${key}</h3><p>${text}</p>`
                : `<p style="color:red;">--- CHAPTER NOT FOUND: ${key} ---</p>`;
        }
    } else {
        html += `<p style="color:red;"><strong>Parser Failure:</strong> Could not parse plan string.</p>`;
    }
    textEl.innerHTML = html;
}

function getDayOfYear() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
}

// ============================================================
//  MAIN
// ============================================================

async function main() {
    await loadData();

    displayRandomVerse();
    displaySpurgeon();
    displayDailyReading();

    // Rotate verse every hour
    if (allVersesArray.length > 0) {
        setInterval(displayRandomVerse, 3600 * 1000);
    }
}

// Expose refresh function for the button (works with defer)
window.refreshVerse = displayRandomVerse;

main();
