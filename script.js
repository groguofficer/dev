// --- FILE URLS ---
const KJV_URL         = 'kjv.csv';
const KJV_CHAPTER_URL = 'kjv_by_chapter.csv';
const PLAN_URL        = 'ChronoBiblePlan.csv';
const SPURGEON_URL    = 'spurgeon_morning_and_evening.csv';

// --- DATA STORES ---
let allVersesArray = [];
let chapterLookup  = new Map();
let planLookup     = new Map();
let spurgeonLookup = new Map();

// ============================================================
//  FULL RFC-4180 CSV PARSER
//  Handles quoted fields with embedded commas and newlines.
// ============================================================
function parseCSVFull(text) {
    const rows = [];
    let row = [], field = '', inQ = false, i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inQ) {
            if (ch === '"' && text[i+1] === '"') { field += '"'; i += 2; }
            else if (ch === '"')                 { inQ = false; i++; }
            else                                 { field += ch; i++; }
        } else {
            if      (ch === '"')                              { inQ = true; i++; }
            else if (ch === ',')                              { row.push(field); field = ''; i++; }
            else if (ch === '\r' && text[i+1] === '\n')      { row.push(field); rows.push(row); row = []; field = ''; i += 2; }
            else if (ch === '\n')                            { row.push(field); rows.push(row); row = []; field = ''; i++; }
            else                                             { field += ch; i++; }
        }
    }
    if (row.length > 0 || field !== '') { row.push(field); rows.push(row); }
    return rows;
}

// ============================================================
//  SAFE FETCH — shows an on-page error, never throws
// ============================================================
function showError(msg) {
    let box = document.getElementById('_err');
    if (!box) {
        box = document.createElement('div');
        box.id = '_err';
        box.style.cssText = [
            'position:fixed;top:0;left:0;right:0;z-index:9999',
            'background:#fff0f0;border-bottom:2px solid #c00',
            'color:#700;padding:10px 16px;font:13px monospace',
            'white-space:pre-wrap;max-height:40vh;overflow-y:auto'
        ].join(';');
        document.body.prepend(box);
    }
    box.textContent += '⚠ ' + msg + '\n';
}

async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) { showError('HTTP ' + res.status + ' loading: ' + url); return null; }
        return await res.text();
    } catch (e) {
        showError('Cannot fetch "' + url + '": ' + e.message +
            '\n  → Make sure you are opening the page via a local web server, not file://');
        return null;
    }
}

// ============================================================
//  LOAD & PARSE ALL DATA FILES
// ============================================================
async function loadData() {
    const [kjvText, chapterText, planText, spurgeonText] = await Promise.all([
        safeFetch(KJV_URL),
        safeFetch(KJV_CHAPTER_URL),
        safeFetch(PLAN_URL),
        safeFetch(SPURGEON_URL)
    ]);

    // --- kjv.csv ---
    // Format: Genesis 1:1,Verse text   (no header, comma after reference)
    // Verses with commas inside are quoted: Genesis 1:2,"And...void, and..."
    if (kjvText) {
        kjvText.trim().split('\n').forEach(line => {
            const comma = line.indexOf(',');
            if (comma === -1) return;
            const ref  = line.slice(0, comma).trim();
            const text = line.slice(comma + 1).trim().replace(/^"|"$/g, '');
            if (ref && text) allVersesArray.push({ reference: ref, text });
        });
    }

    // --- kjv_by_chapter.csv ---
    // Same structure as kjv.csv but first col is chapter ("Genesis 1"),
    // second col is all verses concatenated. Has a header row.
    if (chapterText) {
        parseCSVFull(chapterText).forEach((row, i) => {
            if (i === 0) return; // skip header
            if (row.length < 2) return;
            const chapter = row[0].trim();
            const text    = row[1].trim();
            if (chapter) chapterLookup.set(chapter, text);
        });
    }

    // --- ChronoBiblePlan.csv ---
    // TAB-separated; first row is header "Day of the year\tBible verses"
    // Subsequent rows: 1\tGenesis 1-3
    if (planText) {
        planText.trim().split('\n').forEach((line, i) => {
            if (i === 0) return; // skip header row
            const tab = line.indexOf('\t');
            if (tab === -1) return;
            const day     = line.slice(0, tab).trim();
            const reading = line.slice(tab + 1).trim();
            if (day && reading) planLookup.set(day, reading);
        });
    }

    // --- spurgeon_morning_and_evening.csv ---
    // "date","time","content"  — content spans multiple lines, needs full CSV parser
    if (spurgeonText) {
        parseCSVFull(spurgeonText).forEach((row, i) => {
            if (i === 0) return; // skip header
            if (row.length < 3) return;
            const date    = row[0].trim();
            const time    = row[1].trim();
            const content = row[2].trim();
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
    const el = document.getElementById('random-verse-container');
    if (!el) return;
    if (!allVersesArray.length) {
        el.innerHTML = '<p>Verse data not loaded.</p>';
        return;
    }
    const v = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    el.innerHTML = '<p>\u201c' + v.text + '\u201d</p><footer>\u2014 ' + v.reference + '</footer>';
}

// ============================================================
//  DISPLAY: SPURGEON
// ============================================================
function getTodayDateKey() {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const d = new Date();
    return months[d.getMonth()] + ' ' + d.getDate();
}

function displaySpurgeon() {
    const labelEl = document.getElementById('spurgeon-date-label');
    const el      = document.getElementById('spurgeon-container');
    if (!el) return;

    const dateKey = getTodayDateKey();
    if (labelEl) labelEl.textContent = dateKey;

    if (!spurgeonLookup.size) {
        el.innerHTML = '<p class="s-note">Spurgeon data not loaded.</p>';
        return;
    }
    const entries = spurgeonLookup.get(dateKey);
    if (!entries) {
        el.innerHTML = '<p class="s-note">No entry found for ' + dateKey + '.</p>';
        return;
    }

    let html = '';
    ['Morning', 'Evening'].forEach(function(session, idx) {
        const text = entries[session];
        if (!text) return;

        // Content format after CSV parse:
        // "They did eat of the fruit..."-Joshua 5:12 Body text here...
        let verseRef = '', body = text;
        const m = text.match(/^(".*?"-[A-Za-z0-9 ]+\d+:\d+)/);
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
    const now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
}

function expandPassage(str) {
    const results = [];
    const m = str.match(/^(\d\s+[A-Za-z][\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d[\d\S]*)$/);
    if (!m) return [];
    const book = m[1].trim();
    m[2].trim().split(',').forEach(function(part) {
        const p = part.trim();
        if (!p) return;
        if (p.includes('-') && !p.includes(':')) {
            const s = parseInt(p.split('-')[0], 10);
            const e = parseInt(p.split('-')[1], 10);
            for (let i = s; i <= e; i++) results.push(book + ' ' + i);
        } else if (p.includes(':')) {
            results.push(book + ' ' + p.split(':')[0]);
        } else {
            results.push(book + ' ' + p);
        }
    });
    return results.filter(function(v, i, a) { return a.indexOf(v) === i; });
}

function displayDailyReading() {
    const titleEl = document.getElementById('daily-reading-title');
    const textEl  = document.getElementById('daily-reading-text');
    if (!titleEl || !textEl) return;

    const day     = getDayOfYear();
    const planStr = planLookup.get(String(day));
    titleEl.innerText = "Today's Reading (Day " + day + ")";

    if (!planStr) {
        textEl.innerHTML = '<p>No reading scheduled for today (day ' + day + ').</p>';
        return;
    }

    // Plan entries are semicolon-separated passages
    const chapters = planStr.split(';').reduce(function(acc, p) {
        return acc.concat(expandPassage(p.trim()));
    }, []);

    let html = '<p><strong>Reading Plan:</strong> ' + planStr + '</p><hr>';
    if (chapters.length) {
        chapters.forEach(function(key) {
            const tx = chapterLookup.get(key);
            if (tx) {
                html += '<h3>' + key + '</h3><p>' + tx + '</p>';
            } else {
                html += '<p style="color:red">Chapter not found: ' + key + '</p>';
            }
        });
    } else {
        html += '<p style="color:red">Could not parse reading plan: "' + planStr + '"</p>';
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

main().catch(function(e) { showError('Unexpected crash: ' + e.message); });

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', displayRandomVerse);
