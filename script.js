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
let spurgeonLookup = new Map(); // key: "Month Day" e.g. "January 1"

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
 * Fetches and parses all CSV files into our data stores.
 */
async function loadData() {
    try {
        const [kjvResponse, kjvChapterResponse, planResponse, spurgeonResponse] = await Promise.all([
            fetch(KJV_URL),
            fetch(KJV_CHAPTER_URL),
            fetch(PLAN_URL),
            fetch(SPURGEON_URL)
        ]);

        if (!kjvResponse.ok || !kjvChapterResponse.ok || !planResponse.ok) {
            throw new Error('Network response was not ok for core files.');
        }

        const kjvText          = await kjvResponse.text();
        const kjvChapterText   = await kjvChapterResponse.text();
        const planText         = await planResponse.text();

        // --- Parse kjv.csv (for random verse) ---
        const kjvLines = kjvText.trim().split('\n');
        kjvLines.forEach(line => {
            const parts = line.split(',');
            if (parts.length < 2) return;
            const reference = parts[0].trim();
            const text = parts.slice(1).join(',').trim().replace(/^"|"$/g, '');
            verseLookup.set(reference, text);
            allVersesArray.push({ reference, text });
        });

        // --- Parse kjv_by_chapter.csv (for daily reading) ---
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

        // --- Parse ChronoBiblePlan.csv ---
        const planLines = planText.trim().split('\n');
        planLines.forEach(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^(\d+)\s*,?\s*(.*)$/);
            if (match) {
                planLookup.set(match[1], match[2].trim());
            }
        });

        // --- Parse spurgeon_morning_and_evening.csv ---
        // Expected columns: "date","time","content"
        // date = "January 1", time = "Morning" | "Evening", content = devotional text
        if (spurgeonResponse.ok) {
            const spurgeonText = await spurgeonResponse.text();
            const spurgeonLines = spurgeonText.trim().split('\n');
            spurgeonLines.forEach((line, index) => {
                if (index === 0) return; // skip header row
                const trimmed = line.trim();
                if (!trimmed) return;

                const fields = parseCSVLine(trimmed);
                if (fields.length < 3) return;

                // Strip surrounding quotes left by the parser
                const date    = fields[0].replace(/^"|"$/g, '').trim(); // e.g. "January 1"
                const time    = fields[1].replace(/^"|"$/g, '').trim(); // "Morning" | "Evening"
                const content = fields[2].replace(/^"|"$/g, '').trim();

                if (!date || !time || !content) return;

                // Build a key per date; store morning & evening
                if (!spurgeonLookup.has(date)) {
                    spurgeonLookup.set(date, {});
                }
                spurgeonLookup.get(date)[time] = content;
            });
        } else {
            console.warn('spurgeon_morning_and_evening.csv could not be loaded.');
        }

    } catch (error) {
        console.error("Failed to load bible data:", error);
        document.body.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load data files.</p>`;
    }
}

/**
 * Returns today's date formatted as "Month Day" with no leading zero,
 * e.g. "January 1", "December 25" — matching the CSV's date column.
 */
function getTodayDateKey() {
    const now = new Date();
    const monthNames = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];
    return `${monthNames[now.getMonth()]} ${now.getDate()}`;
}

/**
 * Displays the Spurgeon Morning & Evening devotional for today.
 */
function displaySpurgeon() {
    const dateKey   = getTodayDateKey();
    const labelEl   = document.getElementById('spurgeon-date-label');
    const container = document.getElementById('spurgeon-container');

    if (!container) return;

    if (labelEl) labelEl.textContent = dateKey;

    const entries = spurgeonLookup.get(dateKey);

    if (!entries) {
        container.innerHTML = `<p style="font-style:italic;color:#888;">No devotional found for ${dateKey}.</p>`;
        return;
    }

    const order = ['Morning', 'Evening'];
    let html = '';

    order.forEach((session, idx) => {
        const text = entries[session];
        if (!text) return;

        // Extract the leading scripture reference (text before the first em-dash or hyphen-quote pattern)
        // The CSV format appears to be: "Reference verse text"-Book chapter:verse  Body…
        // We'll just display the full text, splitting off the first sentence as the verse header.
        const firstDashIdx = text.indexOf('\u201c'); // opening curly quote
        let verseRef = '';
        let body = text;

        // Try to pull out the scripture reference shown as ".."-Book ref at the start
        const refMatch = text.match(/^(".*?"\s*[-\u2013\u2014]\s*[\w\s]+\d+:\d+)/);
        if (refMatch) {
            verseRef = refMatch[1];
            body = text.slice(refMatch[0].length).trim();
        }

        if (idx > 0) html += '<hr class="spurgeon-divider">';

        html += `<div class="spurgeon-entry">`;
        html += `  <div class="spurgeon-time">${session}</div>`;
        if (verseRef) {
            html += `  <div class="spurgeon-verse">${escapeHtml(verseRef)}</div>`;
        }
        html += `  <div class="spurgeon-text">${escapeHtml(body)}</div>`;
        html += `</div>`;
    });

    container.innerHTML = html || `<p style="font-style:italic;color:#888;">No entries for ${dateKey}.</p>`;
}

/** Minimal HTML escaper to prevent XSS from CSV content. */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
//  EXISTING FUNCTIONS (unchanged logic)
// ============================================================

/**
 * THE DEFINITIVE PARSER for bible reading passages.
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
        } else if (trimmedPart.includes('-') && trimmedPart.includes(':')) {
            const chapter = trimmedPart.split(':')[0];
            results.push(`${book} ${chapter}`);
        } else if (trimmedPart.includes(':')) {
            const chapter = trimmedPart.split(':')[0];
            results.push(`${book} ${chapter}`);
        } else {
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
    const textEl  = document.getElementById('daily-reading-text');

    if (!titleEl || !textEl) return;

    titleEl.innerText = `Today's Reading · Day ${dayOfYear}`;

    if (!readingPlanString) {
        textEl.innerHTML = `<p>No reading scheduled for today.</p>`;
        return;
    }

    const passages = readingPlanString.split(';').map(p => p.trim());
    const allChaptersForDay = [];
    for (const passage of passages) {
        allChaptersForDay.push(...expandPassage(passage));
    }

    let htmlOutput = `<p><strong>Reading Plan:</strong> ${escapeHtml(readingPlanString)}</p><hr>`;

    if (allChaptersForDay.length > 0) {
        for (const chapterKey of allChaptersForDay) {
            const text = chapterLookup.get(chapterKey);
            if (text) {
                htmlOutput += `<h3>${escapeHtml(chapterKey)}</h3><p>${escapeHtml(text)}</p>`;
            } else {
                htmlOutput += `<p style="color:red;">— Chapter not found: ${escapeHtml(chapterKey)} —</p>`;
            }
        }
    } else {
        htmlOutput += `<p style="color:red;"><strong>Parser failure:</strong> Could not generate chapter references from plan string.</p>`;
    }

    textEl.innerHTML = htmlOutput;
}

function displayRandomVerse() {
    if (allVersesArray.length === 0) {
        const container = document.getElementById('random-verse-container');
        if (container) container.innerHTML = `<p>Could not load verses. Please check that 'kjv.csv' is comma-separated.</p>`;
        return;
    }
    const randomVerse = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    const container = document.getElementById('random-verse-container');
    if (container) {
        container.innerHTML = `<p>"${escapeHtml(randomVerse.text)}"</p><footer>— ${escapeHtml(randomVerse.reference)}</footer>`;
    }
}

function getDayOfYear() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff  = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

// ============================================================
//  MAIN
// ============================================================
async function main() {
    await loadData();
    document.querySelectorAll('.loading').forEach(el => el.style.display = 'none');

    displayRandomVerse();
    if (allVersesArray.length > 0) {
        setInterval(displayRandomVerse, 3600 * 1000);
    }

    displaySpurgeon();
    displayDailyReading();
}

main();
