// --- FILE URLS ---
const KJV_URL         = 'kjv.csv';
const KJV_CHAPTER_URL = 'kjv_by_chapter.csv';
const PLAN_URL        = 'ChronoBiblePlan.csv';
const SPURGEON_URL    = 'spurgeon_morning_and_evening.csv';

// --- DATA STORES ---
let allVersesArray = [];
let chapterLookup  = new Map();  // "Genesis 1" → verse text
let planLookup     = new Map();  // "147"       → "Job 1-4"
let spurgeonLookup = new Map();  // "May 27"    → { Morning: "...", Evening: "..." }

// ============================================================
//  FULL RFC-4180 CSV PARSER
//  Correctly handles quoted fields with embedded commas/newlines.
// ============================================================
function parseCSVFull(text) {
    const rows = [];
    let row = [], field = '', inQ = false, i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inQ) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; }   // escaped ""
            else if (ch === '"')                   { inQ = false; i++; }        // closing quote
            else                                   { field += ch; i++; }
        } else {
            if      (ch === '"')                            { inQ = true; i++; }
            else if (ch === ',')                            { row.push(field); field = ''; i++; }
            else if (ch === '\r' && text[i + 1] === '\n')  { row.push(field); rows.push(row); row = []; field = ''; i += 2; }
            else if (ch === '\n')                           { row.push(field); rows.push(row); row = []; field = ''; i++; }
            else                                            { field += ch; i++; }
        }
    }
    if (row.length > 0 || field !== '') { row.push(field); rows.push(row); }
    return rows;
}

// ============================================================
//  ON-PAGE ERROR DISPLAY
// ============================================================
function showError(msg) {
    let box = document.getElementById('_err');
    if (!box) {
        box = document.createElement('div');
        box.id = '_err';
        box.style.cssText = [
            'position:fixed;top:0;left:0;right:0;z-index:9999',
            'background:#fff0f0;border-bottom:2px solid #900',
            'color:#600;padding:10px 16px;font:12px monospace',
            'white-space:pre-wrap;max-height:35vh;overflow-y:auto'
        ].join(';');
        document.body.prepend(box);
    }
    box.textContent += '⚠ ' + msg + '\n';
}

// ============================================================
//  SAFE FETCH — never throws; returns null on failure
// ============================================================
async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            showError('HTTP ' + res.status + ' — could not load: ' + url);
            return null;
        }
        return await res.text();
    } catch (e) {
        showError('Cannot fetch "' + url + '": ' + e.message +
            '\n  → Run this page from a local web server (e.g. VS Code Live Server), not directly from file://');
        return null;
    }
}

// ============================================================
//  LOAD ALL DATA
// ============================================================
async function loadData() {
    const [kjvText, chapterText, planText, spurgeonText] = await Promise.all([
        safeFetch(KJV_URL),
        safeFetch(KJV_CHAPTER_URL),
        safeFetch(PLAN_URL),
        safeFetch(SPURGEON_URL)
    ]);

    // --- kjv.csv ---
    // No header. Format: Genesis 1:1,Verse text
    // Verses containing commas are quoted: Genesis 1:2,"And...void, and..."
    if (kjvText) {
        kjvText.trim().split('\n').forEach(function(line) {
            line = line.replace(/\r$/, '');
            var comma = line.indexOf(',');
            if (comma === -1) return;
            var ref  = line.slice(0, comma).trim();
            var text = line.slice(comma + 1).trim().replace(/^"|"$/g, '');
            if (ref && text) allVersesArray.push({ reference: ref, text: text });
        });
    }

    // --- kjv_by_chapter.csv ---
    // Header row: Chapter,Verses
    // Data rows:  Genesis 1,"full chapter text..."
    // Uses full CSV parser because text fields contain commas.
    if (chapterText) {
        parseCSVFull(chapterText).forEach(function(row, i) {
            if (i === 0) return; // skip header
            if (row.length < 2) return;
            var chapter = row[0].trim();
            var text    = row[1].trim();
            if (chapter && text) chapterLookup.set(chapter, text);
        });
    }

    // --- ChronoBiblePlan.csv ---
    // Header row: Day of the year\tBible verses   (TAB-separated)
    // Data rows:  1\tGenesis 1-3
    if (planText) {
        planText.trim().split('\n').forEach(function(line, i) {
            line = line.replace(/\r$/, ''); // strip Windows \r
            if (i === 0) return;            // skip header
            var tab = line.indexOf('\t');
            if (tab === -1) return;
            var day     = line.slice(0, tab).trim();
            var reading = line.slice(tab + 1).trim();
            if (day && reading) planLookup.set(day, reading);
        });
    }

    // --- spurgeon_morning_and_evening.csv ---
    // Header: "date","time","content"
    // Content fields span multiple lines → must use full CSV parser
    if (spurgeonText) {
        parseCSVFull(spurgeonText).forEach(function(row, i) {
            if (i === 0) return;
            if (row.length < 3) return;
            var date    = row[0].trim();  // e.g. "January 1"
            var time    = row[1].trim();  // "Morning" or "Evening"
            var content = row[2].trim();
            if (!date || !time || !content) return;
            if (!spurgeonLookup.has(date)) spurgeonLookup.set(date, {});
            spurgeonLookup.get(date)[time] = content;
        });
    }
}

// ============================================================
//  DISPLAY: RANDOM VERSE
// ============================================================
function displayRandomVerse() {
    var el = document.getElementById('random-verse-container');
    if (!el) return;
    if (!allVersesArray.length) {
        el.innerHTML = '<p>Verse data not loaded — check error banner above.</p>';
        return;
    }
    var v = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    el.innerHTML = '<p>\u201c' + v.text + '\u201d</p><footer>\u2014 ' + v.reference + '</footer>';
}

// ============================================================
//  DISPLAY: SPURGEON MORNING & EVENING
// ============================================================
function getTodayDateKey() {
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var d = new Date();
    return months[d.getMonth()] + ' ' + d.getDate(); // e.g. "May 27"
}

function displaySpurgeon() {
    var labelEl = document.getElementById('spurgeon-date-label');
    var el      = document.getElementById('spurgeon-container');
    if (!el) return;

    var dateKey = getTodayDateKey();
    if (labelEl) labelEl.textContent = dateKey;

    if (!spurgeonLookup.size) {
        el.innerHTML = '<p class="s-note">Spurgeon file not loaded.</p>';
        return;
    }
    var entries = spurgeonLookup.get(dateKey);
    if (!entries) {
        el.innerHTML = '<p class="s-note">No Spurgeon entry for ' + dateKey + '.</p>';
        return;
    }

    var html = '';
    ['Morning', 'Evening'].forEach(function(session, idx) {
        var text = entries[session];
        if (!text) return;

        // Content starts with "Verse text"-Book chapter:verse  Body...
        // After CSV parsing, double-quotes inside the field become single quotes,
        // so it looks like: "They did eat..."-Joshua 5:12 Body here
        var verseRef = '', body = text;
        var m = text.match(/^(".*?"-[A-Za-z0-9 ]+\d+:\d+)/);
        if (m) { verseRef = m[1]; body = text.slice(m[0].length).trim(); }

        if (idx > 0) html += '<hr class="s-divider">';
        html += '<div class="s-entry">';
        html += '<span class="s-badge">' + session + '</span>';
        if (verseRef) html += '<p class="s-verse">' + verseRef + '</p>';
        html += '<div class="s-body">' + body + '</div>';
        html += '</div>';
    });

    el.innerHTML = html || '<p class="s-note">No entries for ' + dateKey + '.</p>';
}

// ============================================================
//  DISPLAY: DAILY READING
// ============================================================
function getDayOfYear() {
    var now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
}

// Expands "Genesis 1-3" → ["Genesis 1", "Genesis 2", "Genesis 3"]
// Expands "John 3:16"   → ["John 3"]
// Handles numbered books: "1 Kings 1-3" → ["1 Kings 1", ...]
function expandPassage(str) {
    str = str.trim();
    var results = [];
    var m = str.match(/^(\d\s+[A-Za-z][\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d[\d\S]*)$/);
    if (!m) return [];
    var book = m[1].trim();
    m[2].trim().split(',').forEach(function(part) {
        var p = part.trim();
        if (!p) return;
        if (p.indexOf('-') !== -1 && p.indexOf(':') === -1) {
            // chapter range: 1-3
            var s = parseInt(p.split('-')[0], 10);
            var e = parseInt(p.split('-')[1], 10);
            for (var i = s; i <= e; i++) results.push(book + ' ' + i);
        } else if (p.indexOf(':') !== -1) {
            // verse ref: 3:16 or 1:1-5 → just the chapter
            results.push(book + ' ' + p.split(':')[0]);
        } else {
            // single chapter: 1
            results.push(book + ' ' + p);
        }
    });
    // deduplicate
    return results.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function displayDailyReading() {
    var titleEl = document.getElementById('daily-reading-title');
    var textEl  = document.getElementById('daily-reading-text');
    if (!titleEl || !textEl) return;

    var day     = getDayOfYear();
    var planStr = planLookup.get(String(day));
    titleEl.innerText = "Today's Reading (Day " + day + ")";

    if (!planStr) {
        textEl.innerHTML = '<p>No reading found for day ' + day + '.</p>';
        return;
    }

    // Plan entries may be semicolon-separated (e.g. "Genesis 1-3; Matthew 1")
    var chapters = [];
    planStr.split(';').forEach(function(p) {
        expandPassage(p.trim()).forEach(function(ch) { chapters.push(ch); });
    });

    var html = '<p><strong>Reading Plan:</strong> ' + planStr + '</p><hr>';
    if (chapters.length) {
        chapters.forEach(function(key) {
            var tx = chapterLookup.get(key);
            if (tx) {
                html += '<h3>' + key + '</h3><p>' + tx + '</p>';
            } else {
                html += '<p style="color:#a00">Chapter not found: ' + key + '</p>';
            }
        });
    } else {
        html += '<p style="color:#a00">Could not parse: "' + planStr + '"</p>';
    }
    textEl.innerHTML = html;
}

// ============================================================
//  MAIN
// ============================================================
async function main() {
    await loadData();
    displayRandomVerse();
    displaySpurgeon();
    displayDailyReading();
    if (allVersesArray.length > 0) {
        setInterval(displayRandomVerse, 3600 * 1000);
    }
}

main().catch(function(e) { showError('Unexpected error: ' + e.message + '\n' + e.stack); });

// Wire refresh button — script is at bottom of <body> so DOM is already ready
document.getElementById('refresh-btn').addEventListener('click', displayRandomVerse);
