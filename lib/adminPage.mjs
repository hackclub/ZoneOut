// shared head
const HEAD = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="robots" content="noindex, nofollow">',

    '<link rel="stylesheet" href="/style.css">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
].join("\n");

// what everyone who is not an administrator receives
export const NOT_FOUND_PAGE = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    HEAD,
    "<title>Not Found</title>",
    "<style>",
    "body{background:black;color:white;min-height:100vh;min-height:100dvh;display:flex;",
    "flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:24px;text-align:center;}",
    ".errCode{font-size:clamp(28px,7vw,44px);letter-spacing:4px;}",
    ".errText{opacity:0.7;letter-spacing:2px;}",
    "</style>",
    "</head>",
    "<body>",
    '<div class="errCode">404: PAGE NOT FOUND</div>',
    '<div class="errText">There is nothing at this address.</div>',
    '<button class="camNode" id="toMenuBtn" type="button">&larr; RETURN TO MAIN MENU</button>',
    "<script>",
    "document.getElementById('toMenuBtn').addEventListener('click', function () {",
    "  window.location.href = '/';",
    "});",
    "</script>",
    "</body>",
    "</html>"
].join("\n");

// the dashboard
export const ADMIN_PAGE = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    HEAD,
    "<title>ZoneOut Admin</title>",
    "<style>",
    adminCss(),
    "</style>",
    "</head>",
    "<body>",
    adminBody(),
    "<script>",
    adminScript(),
    "</script>",
    "</body>",
    "</html>"
].join("\n");

// styling
function adminCss() {
    return [
        "body{background:black;color:white;min-height:100vh;padding:28px 20px 140px;}",

        ".adminTop{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;",
        "justify-content:space-between;width:min(1180px,100%);margin:0 auto 26px;}",
        ".adminTitle{font-size:clamp(24px,4vw,34px);letter-spacing:6px;font-weight:bold;}",
        ".adminSub{margin-top:6px;font-size:13px;opacity:0.55;letter-spacing:2px;}",

        ".queryBox{width:min(420px,100%);}",
        ".queryBox label{display:block;font-size:12px;letter-spacing:3px;opacity:0.55;margin-bottom:6px;}",
        ".queryBox input{width:100%;}",
        ".queryHint{margin-top:6px;font-size:11px;opacity:0.42;line-height:1.6;}",

        "input[type=text]{background:rgba(10,10,10,0.9);color:#fff;border:1px solid rgba(200,160,255,0.35);",
        "padding:9px 11px;font-size:14px;font-family:'Courier New',monospace;border-radius:4px;}",
        "input[type=text]:focus{outline:none;border-color:rgba(185,140,255,0.9);",
        "box-shadow:0 0 12px rgba(130,70,200,0.35);}",

        ".tableWrap{width:min(1180px,100%);margin:0 auto;overflow-x:auto;",
        "border:1px solid rgba(200,160,255,0.35);box-shadow:0 0 18px rgba(130,70,200,0.18);",
        "background:linear-gradient(135deg, rgba(35,10,55,0.96), rgba(10,10,10,0.96));}",
        "table{width:100%;border-collapse:collapse;font-size:13px;}",
        "th,td{padding:10px 12px;text-align:left;border-bottom:1px dashed rgba(255,255,255,0.12);",
        "white-space:nowrap;}",
        "th{font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.45);font-weight:normal;}",
        "tr:last-child td{border-bottom:none;}",
        "td.wrap{white-space:normal;word-break:break-all;max-width:280px;}",
        ".balanceInput{width:96px;}",
        ".banned{color:#ff6b6b;letter-spacing:2px;}",
        ".projectIds{opacity:0.75;}",
        ".empty{padding:24px;text-align:center;opacity:0.6;}",

        ".pending{position:fixed;left:50%;bottom:0;transform:translateX(-50%);",
        "width:min(1180px,100%);z-index:230;padding:14px 18px;",
        "background:linear-gradient(135deg, rgba(35,10,55,0.98), rgba(10,10,10,0.98));",
        "border:1px solid rgba(200,160,255,0.35);border-bottom:none;",
        "box-shadow:0 -8px 30px rgba(0,0,0,0.7);display:none;}",
        ".pending.show{display:flex;gap:16px;align-items:center;flex-wrap:wrap;}",
        ".pendingList{flex:1;min-width:220px;max-height:120px;overflow-y:auto;font-size:12px;line-height:1.8;}",
        ".pendingList div{opacity:0.85;}",

        ".adminMsg{width:min(1180px,100%);margin:16px auto 0;font-size:13px;line-height:1.7;min-height:20px;}",
        ".adminMsg.bad{color:#ff6b6b;}",

        "@media (max-width:700px){",
        ".adminTop{flex-direction:column;}",
        ".queryBox{width:100%;}",
        "}"
    ].join("\n");
}

// markup
function adminBody() {
    return [
        '<div class="adminTop">',
        "<div>",
        '<div class="adminTitle">ADMIN</div>',
        '<div class="adminSub" id="adminCount">loading&hellip;</div>',
        "</div>",

        '<div class="queryBox">',
        '<label for="queryInput">QUERIES</label>',
        '<input id="queryInput" type="text" autocomplete="off" spellcheck="false" placeholder="DELETE 4 17">',
        '<div class="queryHint">',
        "DELETE &lt;user_id&gt; &lt;project_id&gt; &nbsp;&middot;&nbsp; ",
        "BAN &lt;user_id&gt; &lt;reason&gt; &nbsp;&middot;&nbsp; ",
        "UNBAN &lt;user_id&gt;<br>Press Enter to stage, then Save.",
        "</div>",
        "</div>",
        "</div>",

        '<div class="tableWrap">',
        "<table>",
        "<thead><tr>",
        "<th>USER_ID</th><th>USERNAME</th><th>EMAIL</th>",
        "<th>HOUR_BALANCE</th><th>PROJECT_IDS</th><th>STATE</th>",
        "</tr></thead>",
        '<tbody id="adminRows"></tbody>',
        "</table>",
        '<div class="empty" id="adminEmpty">Loading&hellip;</div>',
        "</div>",

        '<div class="adminMsg" id="adminMsg" role="status" aria-live="polite"></div>',

        '<div class="pending" id="pending">',
        '<div class="pendingList" id="pendingList"></div>',
        '<button class="camNode" id="discardBtn" type="button">DISCARD</button>',
        '<button class="camNode" id="saveBtn" type="button">SAVE</button>',
        "</div>"
    ].join("\n");
}

// behaviour
function adminScript() {
    return [
        '"use strict";',

        "var rowsEl = document.getElementById('adminRows');",
        "var emptyEl = document.getElementById('adminEmpty');",
        "var countEl = document.getElementById('adminCount');",
        "var msgEl = document.getElementById('adminMsg');",
        "var pendingEl = document.getElementById('pending');",
        "var pendingListEl = document.getElementById('pendingList');",
        "var queryInput = document.getElementById('queryInput');",
        "var saveBtn = document.getElementById('saveBtn');",

        "// staged edits, nothing written until Save",
        "var stagedBalances = new Map();",
        "var stagedCommands = [];",
        "var users = [];",

        "function say(text, bad) {",
        "  msgEl.textContent = text || '';",
        "  msgEl.classList.toggle('bad', Boolean(bad));",
        "}",

        "// a 404 means this session is no longer an administrator",
        "function handleGone(response) {",
        "  if (response.status === 404) { location.reload(); return true; }",
        "  return false;",
        "}",

        "function load() {",
        "  fetch('/api/admin/users', { credentials: 'same-origin' })",
        "    .then(function (r) {",
        "      if (handleGone(r)) return null;",
        "      if (!r.ok) throw new Error('Could not load the user list.');",
        "      return r.json();",
        "    })",
        "    .then(function (data) { if (data) render(data.users); })",
        "    .catch(function (err) {",
        "      say(err.message || 'Could not reach ZoneOut.', true);",
        "      emptyEl.textContent = 'Could not load.';",
        "    });",
        "}",

        "function render(list) {",
        "  users = list || [];",
        "  rowsEl.textContent = '';",
        "  emptyEl.style.display = users.length ? 'none' : '';",
        "  emptyEl.textContent = 'No one has registered yet.';",
        "  countEl.textContent = users.length + ' registered';",

        "  users.forEach(function (user) {",
        "    var tr = document.createElement('tr');",
        "    tr.appendChild(cell(String(user.userId)));",
        "    tr.appendChild(cell(user.name || '\\u2014'));",
        "    tr.appendChild(cell(user.email, 'wrap'));",

        "    // balance field",
        "    var td = document.createElement('td');",
        "    var input = document.createElement('input');",
        "    input.type = 'text';",
        "    input.className = 'balanceInput';",
        "    input.value = String(user.balanceHours);",
        "    input.setAttribute('aria-label', 'Hour balance for user ' + user.userId);",
        "    input.addEventListener('input', function () {",
        "      var raw = input.value.trim();",
        "      var value = Number(raw);",
        "      if (raw === '' || !isFinite(value) || value < 0 || value === user.balanceHours) {",
        "        stagedBalances['delete'](user.userId);",
        "      } else {",
        "        stagedBalances.set(user.userId, value);",
        "      }",
        "      renderPending();",
        "    });",
        "    td.appendChild(input);",
        "    tr.appendChild(td);",

        "    var ids = Array.isArray(user.projectIds) ? user.projectIds : [];",
        "    tr.appendChild(cell(ids.length ? ids.join(', ') : '\\u2014', 'projectIds'));",

        "    var state = document.createElement('td');",
        "    if (user.isBanned) {",
        "      state.className = 'banned';",
        "      state.textContent = 'BANNED';",
        "      state.title = user.banReason || '';",
        "    } else {",
        "      state.textContent = user.status;",
        "    }",
        "    tr.appendChild(state);",
        "    rowsEl.appendChild(tr);",
        "  });",

        "  renderPending();",
        "}",

        "// table cells",
        "function cell(text, className) {",
        "  var td = document.createElement('td');",
        "  if (className) td.className = className;",
        "  td.textContent = text;",
        "  return td;",
        "}",

        "function renderPending() {",
        "  var lines = [];",
        "  stagedBalances.forEach(function (hours, userId) {",
        "    lines.push('set user ' + userId + ' balance to ' + hours);",
        "  });",
        "  stagedCommands.forEach(function (raw) { lines.push(raw); });",

        "  pendingListEl.textContent = '';",
        "  lines.forEach(function (line) {",
        "    var div = document.createElement('div');",
        "    div.textContent = '\\u203a ' + line;",
        "    pendingListEl.appendChild(div);",
        "  });",

        "  pendingEl.classList.toggle('show', lines.length > 0);",
        "}",

        "// command box",
        "queryInput.addEventListener('keydown', function (e) {",
        "  if (e.key !== 'Enter') return;",
        "  e.preventDefault();",
        "  var raw = queryInput.value.trim();",
        "  if (!raw) return;",
        "  stagedCommands.push(raw);",
        "  queryInput.value = '';",
        "  say('');",
        "  renderPending();",
        "});",

        "document.getElementById('discardBtn').addEventListener('click', function () {",
        "  stagedBalances.clear();",
        "  stagedCommands = [];",
        "  say('Discarded.');",
        "  render(users);",
        "});",

        "saveBtn.addEventListener('click', function () {",
        "  var balances = [];",
        "  stagedBalances.forEach(function (hours, userId) {",
        "    balances.push({ userId: userId, balanceHours: hours });",
        "  });",
        "  if (!balances.length && !stagedCommands.length) return;",

        "  saveBtn.disabled = true;",
        "  say('Saving\\u2026');",

        "  fetch('/api/admin/apply', {",
        "    method: 'POST',",
        "    credentials: 'same-origin',",
        "    headers: { 'Content-Type': 'application/json' },",
        "    body: JSON.stringify({ balances: balances, commands: stagedCommands })",
        "  })",
        "    .then(function (r) {",
        "      if (handleGone(r)) return null;",
        "      return r.json().then(function (data) { return { ok: r.ok, data: data }; });",
        "    })",
        "    .then(function (result) {",
        "      if (!result) return;",
        "      if (!result.ok) {",
        "        // the batch rolled back; staged changes stay put",
        "        say(result.data.error || 'Could not save.', true);",
        "        return;",
        "      }",
        "      stagedBalances.clear();",
        "      stagedCommands = [];",
        "      if (result.data.users) { render(result.data.users); } else { load(); }",
        "      say('Saved: ' + (result.data.applied || []).join('; '));",
        "    })",
        "    .catch(function () { say('Could not reach ZoneOut.', true); })",
        "    .then(function () { saveBtn.disabled = false; });",
        "});",

        "load();"
    ].join("\n");
}
