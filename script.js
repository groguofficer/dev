// --- CONFIGURATION ---
const KJV_URL         = 'kjv.csv';
const KJV_CHAPTER_URL = 'kjv_by_chapter.csv';
const PLAN_URL        = 'ChronoBiblePlan.csv';
const SPURGEON_URL    = 'spurgeon_morning_and_evening.csv';

// --- GLOBAL DATA STORES ---
let allVersesArray = [];
let chapterLookup  = new Map();
let planLookup     = new Map();
let spurgeonLookup = new Map();

// ============================================================
//  FULL RFC-4180 CSV PARSER
//  Handles quoted fields with embedded commas AND newlines.
// ============================================================
function parseCSVFull(text) {
    const rows = [];
    let row   = [];
    let field = '';
    let inQ   = false;
    let i     = 0;

    while (i < text.length) {
        const ch = text[i];
        if (inQ) {
            if (ch === '"' && text[i + 1] === '"') { // escaped quote ""
                field += '"'; i += 2;
            } else if (ch === '"') {
                inQ = false; i++;
            } else {
                field += ch; i++;
            }
        } else {
            if (ch === '"') {
                inQ = true; i++;
            } else if (ch === ',') {
                row.push(field); field = ''; i++;
            } else if (ch === '\r' && text[i + 1] === '\n') {
                row.push(field); rows.push(row); row = []; field = ''; i += 2;
            } else if (ch === '\n') {
                row.push(field); rows.push(row); row = []; field = ''; i++;
            } else {
                field += ch; i++;
            }
        }
    }
    if (row.length > 0 || field) { row.push(field); rows.push(row); }
    return rows;
}

// ============================================================
//  SAFE FETCH  — never throws; returns null on failure
// ============================================================
async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            showError(`Could not load "${url}" (HTTP ${res.status}). Make sure the file exists and you are running from a web server, not file://.`);
            return null;
        }
        return await res.text();
    } catch (e) {
        showError(`Network error loading "${url}": ${e.message}. Make sure you are running from a local web server (e.g. VS Code Live Server), not directly from the filesystem.`);
        return null;
    }
}

function showError(msg) {
    let box = document.getElementById('_error_box');
    if (!box) {
        box = document.createElement('div');
        box.id = '_error_box';
        box.style.cssText = 'background:#fff0f0;border:1px solid #c00;color:#700;padding:12px 16px;margin:16px 24px;border-radius:4px;font-family:monospace;font-size:0.82rem;white-space:pre-wrap;';
        document.body.insertBefore(box, document.body.firstChild);
    }
    box.textContent += msg + '\n';
}

// ============================================================
//  DATA LOADING
// ============================================================
async function loadData() {
    // Fetch all four files concurrently; safeFetch returns null on failure
    const [kjvText, kjvChapterText, planText, spurgeonText] = await Promise.all([
        safeFetch(KJV_URL),
        safeFetch(KJV_CHAPTER_URL),
        safeFetch(PLAN_URL),
        safeFetch(SPURGEON_URL)
    ]);

    // --- kjv.csv → allVersesArray ---
    // Format: Genesis 1:1,"In the beginning..."  (no header, simple comma sep)
    if (kjvText) {
        kjvText.trim().split('\n').forEach(line => {
            const comma = line.indexOf(',');
            if (comma === -1) return;
            const reference = line.slice(0, comma).trim();
            const text = line.slice(comma + 1).trim().replace(/^"|"$/g, '');
            if (reference && text) allVersesArray.push({ reference, text });
        });
    }

    // --- kjv_by_chapter.csv → chapterLookup ---
    // Format: Chapter,"All verses as one string"  (has header row)
    if (kjvChapterText) {
        parseCSVFull(kjvChapterText).forEach((row, i) => {
            if (i === 0) return; // skip header
            if (row.length < 2) return;
            const ch = row[0].trim(), tx = row[1].trim();
            if (ch) chapterLookup.set(ch, tx);
        });
    }

    // --- ChronoBiblePlan.csv → planLookup ---
    if (planText) {
        planText.trim().split('\n').forEach(line => {
            const m = line.trim().match(/^(\d+)\s*,?\s*(.*)$/);
            if (m) planLookup.set(m[1], m[2].trim());
        });
    }

    // --- spurgeon_morning_and_evening.csv → spurgeonLookup ---
    // Format: "date","time","content"  — content has embedded newlines → need full parser
    if (spurgeonText) {
        parseCSVFull(spurgeonText).forEach((row, i) => {
            if (i === 0) return; // skip header
            if (row.length < 3) return;
            const date = row[0].trim(), time = row[1].trim(), content = row[2].trim();
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
        el.innerHTML = '<p>Verse data not loaded — check error above.</p>';
        return;
    }
    const v = allVersesArray[Math.floor(Math.random() * allVersesArray.length)];
    el.innerHTML = `<p>"${v.text}"</p><footer>— ${v.reference}</footer>`;
}

// ============================================================
//  DISPLAY: SPURGEON
// ============================================================
function getTodayDateKey() {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getDate()}`;
}

function displaySpurgeon() {
    const labelEl   = document.getElementById('spurgeon-date-label');
    const container = document.getElementById('spurgeon-container');
    if (!container) return;

    const dateKey = getTodayDateKey();
    if (labelEl) labelEl.textContent = dateKey;

    if (!spurgeonLookup.size) {
        container.innerHTML = '<p class="not-found">Spurgeon data not loaded — check error above.</p>';
        return;
    }

    const entries = spurgeonLookup.get(dateKey);
    if (!entries) {
        container.innerHTML = `<p class="not-found">No devotional entry found for "${dateKey}".</p>`;
        return;
    }

    let html = '';
    ['Morning', 'Evening'].forEach((session, idx) => {
        const text = entries[session];
        if (!text) return;

        // The content from the CSV looks like:
        // "They did eat of the fruit..."-Joshua 5:12  Body text here...
        // Extract the scripture ref (everything up to and including the book:chapter ref)
        let verseRef = '';
        let body = text;
        const refMatch = text.match(/^(".*?"-[A-Za-z0-9 ]+\d+:\d+)/);
        if (refMatch) {
            verseRef = refMatch[1];
            body = text.slice(refMatch[0].length).trim();
        }

        if (idx > 0) html += '<hr class="spurgeon-divider">';
        html += `<div class="spurgeon-entry">`;
        html += `<div class="spurgeon-time">${session}</div>`;
        if (verseRef) html += `<div class="spurgeon-verse">${verseRef}</div>`;
        html += `<div class="spurgeon-body">${body}</div>`;
        html += `</div>`;
    });

    container.innerHTML = html || `<p class="not-found">No entries for ${dateKey}.</p>`;
}

// ============================================================
//  DISPLAY: DAILY READING
// ============================================================
function getDayOfYear() {
    const now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
}

function expandPassage(passageStr) {
    const results  = [];
    const bookMatch = passageStr.match(/^(\d\s+[A-Za-z][\w\s]*?|[A-Za-z][\w\s]*?)\s+(\d[\d\S]*)$/);
    if (!bookMatch) return [];
    const book = bookMatch[1].trim();
    bookMatch[2].trim().split(',').forEach(part => {
        const p = part.trim();
        if (!p) return;
        if (p.includes('-') && !p.includes(':')) {
            const [s, e] = p.split('-').map(Number);
            for (let i = s; i <= e; i++) results.push(`${book} ${i}`);
        } else if (p.includes(':')) {
            results.push(`${book} ${p.split(':')[0]}`);
        } else {
            results.push(`${book} ${p}`);
        }
    });
    return [...new Set(results)];
}

function displayDailyReading() {
    const titleEl = document.getElementById('daily-reading-title');
    const textEl  = document.getElementById('daily-reading-text');
    if (!titleEl || !textEl) return;

    const day    = getDayOfYear();
    const planStr = planLookup.get(String(day));
    titleEl.innerText = `Today's Reading (Day ${day})`;

    if (!planStr) {
        textEl.innerHTML = '<p>No reading scheduled for today.</p>';
        return;
    }

    const chapters = planStr.split(';').flatMap(p => expandPassage(p.trim()));
    let html = `<p><strong>Reading Plan:</strong> ${planStr}</p><hr>`;
    if (chapters.length) {
        chapters.forEach(key => {
            const tx = chapterLookup.get(key);
            html += tx
                ? `<h3>${key}</h3><p>${tx}</p>`
                : `<p style="color:red;">--- CHAPTER NOT FOUND: ${key} ---</p>`;
        });
    } else {
        html += `<p style="color:red;"><strong>Parser Failure:</strong> Could not parse "${planStr}"</p>`;
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
    if (allVersesArray.length) {
        setInterval(displayRandomVerse, 3600 * 1000);
    }
}

// Expose for the refresh button (works with defer since onclick runs after defer)
window.refreshVerse = displayRandomVerse;

main().catch(err => showError('Unexpected error in main(): ' + err.message));

// Wire up the refresh button via addEventListener (more reliable than onclick with async scripts)
document.addEventListener("DOMContentLoaded", function() {
    var btn = document.getElementById("refresh-btn");
    if (btn) btn.addEventListener("click", displayRandomVerse);
});
