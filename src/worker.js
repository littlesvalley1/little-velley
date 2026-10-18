const SESSION_COOKIE = "lv_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DEFAULT_SETTINGS = {
  school_name: "Little's Valley Preparatory School",
  phone: "011 2833 2578",
  address: "Plot no, 31-A, Chand Nagar Main Rd, DDA Colony, Chand Nagar, Vishnu Garden, Delhi, 110018",
  status: "Temporarily closed",
  about: "Little's Valley Preparatory School is listed as a preparatory school in the Chand Nagar neighbourhood of West Delhi.",
  visit_note: "Call to confirm the school's current opening status and visiting hours.",
};

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

function error(message, status = 400, headers = {}) {
  return json({ error: message }, status, headers);
}

function secret(value, name) {
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured as a Cloudflare secret with at least 32 characters.`);
  }
  return value;
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function unbase64url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function cookie(request, name) {
  const cookies = request.headers.get("Cookie");
  if (!cookies) return "";
  return cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

async function signingKey(value) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function makeSession(expiration, sessionId, signingSecret) {
  const payload = `${expiration}.${sessionId}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(signingSecret),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

async function checkSession(request, signingSecret, db) {
  const token = cookie(request, SESSION_COOKIE);
  const [expiration, sessionId, signature, extra] = token.split(".");
  if (!expiration || !sessionId || !signature || extra !== undefined || !validId(sessionId) ||
      !Number.isSafeInteger(Number(expiration)) || Number(expiration) <= Date.now() / 1000) {
    return false;
  }
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    await signingKey(signingSecret),
    unbase64url(signature),
    new TextEncoder().encode(`${expiration}.${sessionId}`),
  );
  if (!validSignature) return false;
  const activeSession = await db.prepare(
    "SELECT id FROM admin_sessions WHERE id = ? AND expires_at > ?",
  ).bind(sessionId, Math.floor(Date.now() / 1000)).first();
  return Boolean(activeSession);
}

function safeCookie(value, maxAge) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function bodyJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function text(value, label, maximum, required = true) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return cleaned;
}

function isPublished(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  throw new Error("Choose whether to publish this item.");
}

function validId(id) {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function secureStringEqual(left, right) {
  const first = new TextEncoder().encode(left);
  const second = new TextEncoder().encode(right);
  let difference = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index++) {
    difference |= (first[index] ?? 0) ^ (second[index] ?? 0);
  }
  return difference === 0;
}

async function readPhoto(form) {
  const photo = form.get("image");
  if (!(photo instanceof File) || !photo.size) return null;
  if (photo.size > MAX_PHOTO_BYTES) throw new Error("Choose a teacher photo smaller than 5 MB.");

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const jpeg = photo.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = photo.type === "image/png" && bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  const webp = photo.type === "image/webp" && bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("Use a valid JPEG, PNG, or WebP photo.");

  return {
    key: `teacher-images/${crypto.randomUUID()}.${jpeg ? "jpg" : png ? "png" : "webp"}`,
    type: photo.type,
    bytes: photo.size,
  };
}

async function currentSettings(db) {
  const settings = { ...DEFAULT_SETTINGS };
  const rows = await db.prepare("SELECT key, value FROM school_settings").all();
  for (const row of rows.results) settings[row.key] = row.value;
  return settings;
}

function photoUrl(key, origin) {
  return `${origin}/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function publicContent(request, env) {
  const [settings, teachers, notices, highlights] = await Promise.all([
    currentSettings(env.SCHOOL_DB),
    env.SCHOOL_DB.prepare(
      "SELECT id, name, role, bio, image_key FROM teachers WHERE published = 1 ORDER BY name LIMIT 30",
    ).all(),
    env.SCHOOL_DB.prepare(
      "SELECT id, kind, title, message, publish_on FROM school_notices WHERE published = 1 AND publish_on <= date('now') ORDER BY publish_on DESC, updated_at DESC LIMIT 20",
    ).all(),
    env.SCHOOL_DB.prepare(
      "SELECT id, school_year, title, details FROM school_highlights WHERE published = 1 ORDER BY school_year DESC, updated_at DESC LIMIT 20",
    ).all(),
  ]);

  return json({
    settings,
    teachers: teachers.results.map(({ image_key, ...teacher }) => ({
      ...teacher,
      image_url: photoUrl(image_key, new URL(request.url).origin),
    })),
    notices: notices.results,
    highlights: highlights.results,
  }, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
}

async function adminContent(env, origin) {
  const [settings, teachers, notices, highlights] = await Promise.all([
    currentSettings(env.SCHOOL_DB),
    env.SCHOOL_DB.prepare(
      "SELECT id, name, role, bio, image_key, published FROM teachers ORDER BY name LIMIT 30",
    ).all(),
    env.SCHOOL_DB.prepare(
      "SELECT id, kind, title, message, publish_on, published FROM school_notices ORDER BY publish_on DESC LIMIT 50",
    ).all(),
    env.SCHOOL_DB.prepare(
      "SELECT id, school_year, title, details, published FROM school_highlights ORDER BY school_year DESC LIMIT 50",
    ).all(),
  ]);

  return json({
    settings,
    teachers: teachers.results.map(({ image_key, ...teacher }) => ({
      ...teacher,
      image_url: teacher.published ? photoUrl(image_key, origin) : "",
    })),
    notices: notices.results,
    highlights: highlights.results,
  });
}

async function login(request, env) {
  const password = env.ADMIN_PASSWORD;
  if (!password || password.length < 14) {
    throw new Error("ADMIN_PASSWORD must be configured as a secret with at least 14 characters.");
  }
  const signingSecret = secret(env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET");
  const data = await bodyJson(request);
  if (!data || typeof data.password !== "string" || data.password.length > 256) {
    return error("Enter the staff password to sign in.");
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const hashed = await crypto.subtle.sign("HMAC", await signingKey(signingSecret), new TextEncoder().encode(ip));
  const ipHash = base64url(new Uint8Array(hashed));
  const now = Math.floor(Date.now() / 1000);
  const previous = await env.SCHOOL_DB.prepare(
    "SELECT window_started_at, attempt_count, blocked_until FROM login_attempts WHERE ip_hash = ?",
  ).bind(ipHash).first();

  if (previous?.window_started_at > now - LOGIN_WINDOW_SECONDS && previous.blocked_until > now) {
    const wait = previous.blocked_until - now;
    return error("Too many attempts. Wait a little while before trying again.", 429, { "Retry-After": String(wait) });
  }

  if (!secureStringEqual(data.password, password)) {
    const sameWindow = previous?.window_started_at > now - LOGIN_WINDOW_SECONDS;
    const count = sameWindow ? previous.attempt_count + 1 : 1;
    const started = sameWindow ? previous.window_started_at : now;
    const blockedUntil = count >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_WINDOW_SECONDS : 0;
    await env.SCHOOL_DB.prepare(
      `INSERT INTO login_attempts (ip_hash, window_started_at, attempt_count, blocked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET window_started_at=excluded.window_started_at,
       attempt_count=excluded.attempt_count, blocked_until=excluded.blocked_until`,
    ).bind(ipHash, started, count, blockedUntil).run();
    return error("That password doesn't match. Please try again.", 401);
  }

  await env.SCHOOL_DB.prepare("DELETE FROM login_attempts WHERE ip_hash = ?").bind(ipHash).run();
  const sessionId = crypto.randomUUID();
  const expiresAt = now + SESSION_SECONDS;
  await env.SCHOOL_DB.batch([
    env.SCHOOL_DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(now),
    env.SCHOOL_DB.prepare("INSERT INTO admin_sessions (id, expires_at, created_at) VALUES (?, ?, ?)")
      .bind(sessionId, expiresAt, now),
  ]);
  const session = await makeSession(String(expiresAt), sessionId, signingSecret);
  return json({ ok: true }, 200, { "Set-Cookie": safeCookie(session, SESSION_SECONDS) });
}

async function saveSettings(request, db) {
  const data = await bodyJson(request);
  if (!data || typeof data !== "object" || Array.isArray(data)) return error("Check the school information and try again.");
  let values;
  try {
    values = {
      school_name: text(data.school_name, "School name", 100),
      phone: text(data.phone, "Phone number", 24),
      address: text(data.address, "Address", 280),
      status: text(data.status, "School status", 60),
      about: text(data.about, "About text", 500),
      visit_note: text(data.visit_note, "Visit note", 240),
    };
  } catch (cause) {
    return error(cause.message);
  }

  if (!/^[+\d() -]{7,24}$/.test(values.phone)) return error("Enter a valid school phone number.");
  await db.batch(Object.entries(values).map(([key, value]) =>
    db.prepare("INSERT INTO school_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .bind(key, value),
  ));
  return json({ ok: true });
}

async function saveTeacher(request, env, id = null) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return error("Couldn't read the teacher form. Please try again.");
  }

  let teacher;
  let photo;
  try {
    teacher = {
      name: text(form.get("name"), "Teacher name", 100),
      role: text(form.get("role"), "Role or subject", 100),
      bio: text(form.get("bio"), "Introduction", 600, false),
      published: isPublished(form.get("published")),
    };
    photo = await readPhoto(form);
  } catch (cause) {
    return error(cause.message);
  }

  const existing = id ? await env.SCHOOL_DB.prepare("SELECT image_key FROM teachers WHERE id = ?").bind(id).first() : null;
  if (id && !existing) return error("That teacher profile no longer exists.", 404);
  if (!id && !photo) return error("Choose a teacher photo before adding their profile.");
  if (!id) {
    const count = await env.SCHOOL_DB.prepare("SELECT COUNT(*) AS count FROM teachers").first();
    if (count.count >= 30) return error("The teacher directory is full.", 409);
  }

  let imageKey = existing?.image_key;
  if (photo) {
    const file = form.get("image");
    imageKey = photo.key;
    await env.SCHOOL_MEDIA.put(imageKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: photo.type },
    });
  }

  const teacherId = id ?? crypto.randomUUID();
  await env.SCHOOL_DB.prepare(
    `INSERT INTO teachers (id, name, role, bio, image_key, published, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, bio=excluded.bio,
     image_key=excluded.image_key, published=excluded.published, updated_at=datetime('now')`,
  ).bind(teacherId, teacher.name, teacher.role, teacher.bio, imageKey, teacher.published).run();

  if (photo && existing?.image_key && existing.image_key !== imageKey) {
    await env.SCHOOL_MEDIA.delete(existing.image_key);
  }
  return json({ ok: true });
}

async function deleteTeacher(env, id) {
  const existing = await env.SCHOOL_DB.prepare("SELECT image_key FROM teachers WHERE id = ?").bind(id).first();
  if (!existing) return error("That teacher profile no longer exists.", 404);
  await env.SCHOOL_DB.prepare("DELETE FROM teachers WHERE id = ?").bind(id).run();
  await env.SCHOOL_MEDIA.delete(existing.image_key);
  return json({ ok: true });
}

async function saveNotice(request, db, id = null) {
  const data = await bodyJson(request);
  let item;
  try {
    const kind = data?.kind;
    if (kind !== "notice" && kind !== "event") throw new Error("Choose a notice or an event.");
    const publishOn = text(data.publish_on, "Publish date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishOn) ||
        new Date(`${publishOn}T00:00:00Z`).toISOString().slice(0, 10) !== publishOn) {
      throw new Error("Choose a valid publish date.");
    }
    item = {
      kind,
      title: text(data.title, "Headline", 120),
      message: text(data.message, "Details", 1200),
      publishOn,
      published: isPublished(data.published),
    };
  } catch (cause) {
    return error(cause.message);
  }
  const itemId = id ?? crypto.randomUUID();
  if (id && !await db.prepare("SELECT id FROM school_notices WHERE id=?").bind(id).first()) {
    return error("That update no longer exists.", 404);
  }
  if (!id) {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM school_notices").first();
    if (count.count >= 50) return error("The updates list is full.", 409);
  }
  await db.prepare(
    `INSERT INTO school_notices (id,kind,title,message,publish_on,published,updated_at)
     VALUES (?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,message=excluded.message,
     publish_on=excluded.publish_on,published=excluded.published,updated_at=datetime('now')`,
  ).bind(itemId, item.kind, item.title, item.message, item.publishOn, item.published).run();
  return json({ ok: true });
}

async function saveHighlight(request, db, id = null) {
  const data = await bodyJson(request);
  let item;
  try {
    const schoolYear = text(data?.school_year, "School year", 9);
    if (!/^\d{4}(?:-\d{2})?$/.test(schoolYear)) throw new Error("Use a school year like 2026 or 2026-27.");
    item = {
      schoolYear,
      title: text(data.title, "Highlight", 120),
      details: text(data.details, "Details", 1200, false),
      published: isPublished(data.published),
    };
  } catch (cause) {
    return error(cause.message);
  }
  const itemId = id ?? crypto.randomUUID();
  if (id && !await db.prepare("SELECT id FROM school_highlights WHERE id=?").bind(id).first()) {
    return error("That highlight no longer exists.", 404);
  }
  if (!id) {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM school_highlights").first();
    if (count.count >= 50) return error("The highlights list is full.", 409);
  }
  await db.prepare(
    `INSERT INTO school_highlights (id,school_year,title,details,published,updated_at)
     VALUES (?,?,?,?,?,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET school_year=excluded.school_year,title=excluded.title,
     details=excluded.details,published=excluded.published,updated_at=datetime('now')`,
  ).bind(itemId, item.schoolYear, item.title, item.details, item.published).run();
  return json({ ok: true });
}

async function deleteItem(db, table, id) {
  const allowed = { notices: "school_notices", highlights: "school_highlights" };
  const tableName = allowed[table];
  if (!tableName) return error("School update not found.", 404);
  const existing = await db.prepare(`SELECT id FROM ${tableName} WHERE id=?`).bind(id).first();
  if (!existing) return error("That item no longer exists.", 404);
  await db.prepare(`DELETE FROM ${tableName} WHERE id=?`).bind(id).run();
  return json({ ok: true });
}

async function servePhoto(request, env, key) {
  let decoded;
  try {
    decoded = decodeURIComponent(key);
  } catch {
    return error("Photo not found.", 404);
  }
  if (!/^teacher-images\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(decoded)) return error("Photo not found.", 404);
  const teacher = await env.SCHOOL_DB.prepare(
    "SELECT id FROM teachers WHERE image_key=? AND published=1 LIMIT 1",
  ).bind(decoded).first();
  if (!teacher) return error("Photo not found.", 404);
  const file = await env.SCHOOL_MEDIA.get(decoded);
  if (!file) return error("Photo not found.", 404);
  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": file.httpMetadata?.contentType ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  if (file.httpEtag) headers.set("ETag", file.httpEtag);
  if (request.headers.get("If-None-Match") === file.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : file.body, { headers });
}

async function api(request, env) {
  if (!env.SCHOOL_DB || !env.SCHOOL_MEDIA) {
    return error("Cloudflare database and photo storage are not configured yet.", 503);
  }
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/site" && method === "GET") return publicContent(request, env);
  if (path === "/api/admin/login" && method === "POST") return login(request, env);

  if (path.startsWith("/api/admin/") &&
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      request.headers.get("Origin") !== url.origin) {
    return error("This request could not be verified. Reload the admin page and try again.", 403);
  }
  const signingSecret = secret(env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET");
  if (path === "/api/admin/logout" && method === "POST") {
    if (!await checkSession(request, signingSecret, env.SCHOOL_DB)) {
      return error("Please sign in again to continue.", 401);
    }
    const [expiration, sessionId] = cookie(request, SESSION_COOKIE).split(".");
    if (expiration && sessionId) {
      await env.SCHOOL_DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(sessionId).run();
    }
    return json({ ok: true }, 200, { "Set-Cookie": safeCookie("", 0) });
  }

  if (path.startsWith("/api/admin/") && !await checkSession(request, signingSecret, env.SCHOOL_DB)) {
    return error("Please sign in again to continue.", 401);
  }
  if (path === "/api/admin/content" && method === "GET") return adminContent(env, url.origin);
  if (path === "/api/admin/settings" && method === "PUT") return saveSettings(request, env.SCHOOL_DB);

  const teacher = path.match(/^\/api\/admin\/teachers(?:\/([^/]+))?$/);
  if (teacher && method === "POST" && !teacher[1]) return saveTeacher(request, env);
  if (teacher && method === "PUT" && teacher[1]) {
    return validId(teacher[1]) ? saveTeacher(request, env, teacher[1]) : error("Teacher not found.", 404);
  }
  if (teacher && method === "DELETE" && teacher[1]) {
    return validId(teacher[1]) ? deleteTeacher(env, teacher[1]) : error("Teacher not found.", 404);
  }

  const notice = path.match(/^\/api\/admin\/notices(?:\/([^/]+))?$/);
  if (notice && method === "POST" && !notice[1]) return saveNotice(request, env.SCHOOL_DB);
  if (notice && method === "PUT" && notice[1]) {
    return validId(notice[1]) ? saveNotice(request, env.SCHOOL_DB, notice[1]) : error("Notice not found.", 404);
  }
  if (notice && method === "DELETE" && notice[1]) {
    return validId(notice[1]) ? deleteItem(env.SCHOOL_DB, "notices", notice[1]) : error("Notice not found.", 404);
  }

  const highlight = path.match(/^\/api\/admin\/highlights(?:\/([^/]+))?$/);
  if (highlight && method === "POST" && !highlight[1]) return saveHighlight(request, env.SCHOOL_DB);
  if (highlight && method === "PUT" && highlight[1]) {
    return validId(highlight[1]) ? saveHighlight(request, env.SCHOOL_DB, highlight[1]) : error("Highlight not found.", 404);
  }
  if (highlight && method === "DELETE" && highlight[1]) {
    return validId(highlight[1]) ? deleteItem(env.SCHOOL_DB, "highlights", highlight[1]) : error("Highlight not found.", 404);
  }
  return error("That school service could not be found.", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      const media = url.pathname.match(/^\/media\/(.+)$/);
      if (media && ["GET", "HEAD"].includes(request.method)) return await servePhoto(request, env, media[1]);
      return env.ASSETS.fetch(request);
    } catch (cause) {
      console.error("School site request failed:", cause);
      return error("Something went wrong. Please try again.", 500);
    }
  },
};
