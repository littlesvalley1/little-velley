const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const dashboard = document.querySelector("#dashboard");
const loginMessage = document.querySelector("#login-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const fatalMessage = document.querySelector("#fatal-message");

let currentData = { teachers: [], notices: [], highlights: [] };

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function setBusy(form, busy) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
}

function resetForm(form) {
  form.reset();
  form.elements.namedItem("id").value = "";
  const cancel = document.querySelector(`#${form.id.replace("-form", "-cancel")}`);
  if (cancel) cancel.hidden = true;
  const submit = form.querySelector('[type="submit"]');
  if (form === document.querySelector("#teacher-form")) {
    submit.textContent = "Save teacher";
    form.elements.namedItem("image").required = true;
  } else if (form === document.querySelector("#notice-form")) {
    submit.textContent = "Save notice or event";
  } else if (form === document.querySelector("#highlight-form")) {
    submit.textContent = "Save school highlight";
  }
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function recordCard({ title, description, published, image, badges, onEdit, onDelete }) {
  const article = document.createElement("article");
  article.className = "record-card";
  if (image) {
    const photo = document.createElement("img");
    photo.className = "record-photo";
    photo.src = image;
    photo.alt = "";
    photo.loading = "lazy";
    article.append(photo);
  }

  const content = document.createElement("div");
  content.className = "record-main";
  content.append(textElement("h3", "record-title", title));
  content.append(textElement("p", "record-detail", description));
  const status = textElement("span", `record-status${published ? "" : " is-draft"}`, published ? "Published" : "Draft");
  content.append(status);
  for (const badge of badges ?? []) content.append(textElement("span", "record-status", badge));
  article.append(content);

  const actions = document.createElement("div");
  actions.className = "record-actions";
  const edit = textElement("button", "", "Edit");
  edit.type = "button";
  edit.addEventListener("click", onEdit);
  const remove = textElement("button", "delete-button", "Delete");
  remove.type = "button";
  remove.addEventListener("click", onDelete);
  actions.append(edit, remove);
  article.append(actions);
  return article;
}

function renderList(container, items, renderItem, emptyMessage) {
  container.replaceChildren();
  if (items.length === 0) {
    container.append(textElement("p", "empty-list", emptyMessage));
    return;
  }
  items.forEach((item) => container.append(renderItem(item)));
}

function fillSettings(settings) {
  const form = document.querySelector("#settings-form");
  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field instanceof HTMLSelectElement &&
        !Array.from(field.options).some((option) => option.value === value)) {
      const option = new Option(value, value);
      field.add(option);
    }
    field.value = value;
  }
}

function editItem(form, item) {
  for (const [key, value] of Object.entries(item)) {
    const field = form.elements.namedItem(key);
    if (!field || key === "image" || key === "image_url" || key === "image_key") continue;
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      field.checked = Boolean(Number(value));
    } else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement) {
      field.value = value ?? "";
    }
  }
  form.elements.namedItem("id").value = item.id;
  const photoInput = form.elements.namedItem("image");
  if (photoInput) photoInput.required = false;
  const submit = form.querySelector('[type="submit"]');
  if (form.id === "teacher-form") submit.textContent = "Update teacher";
  if (form.id === "notice-form") submit.textContent = "Update notice or event";
  if (form.id === "highlight-form") submit.textContent = "Update school highlight";
  document.querySelector(`#${form.id.replace("-form", "-cancel")}`).hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  form.elements.namedItem("name")?.focus();
}

function renderContent(data) {
  currentData = data;
  fillSettings(data.settings);

  renderList(document.querySelector("#teacher-list"), data.teachers, (teacher) => recordCard({
    title: teacher.name,
    description: `${teacher.role}${teacher.bio ? ` — ${teacher.bio}` : ""}`,
    published: teacher.published,
    image: teacher.image_url,
    onEdit: () => editItem(document.querySelector("#teacher-form"), teacher),
    onDelete: () => removeItem("teachers", teacher.id, teacher.name),
  }), "Teacher profiles will appear here after you add one.");

  renderList(document.querySelector("#notice-list"), data.notices, (notice) => recordCard({
    title: notice.title,
    description: notice.message,
    published: notice.published,
    badges: [notice.kind === "event" ? "Event" : "Notice", `From ${notice.publish_on}`],
    onEdit: () => editItem(document.querySelector("#notice-form"), notice),
    onDelete: () => removeItem("notices", notice.id, notice.title),
  }), "School notices and events will appear here.");

  renderList(document.querySelector("#highlight-list"), data.highlights, (item) => recordCard({
    title: item.title,
    description: item.details || "No extra details added.",
    published: item.published,
    badges: [`School year ${item.school_year}`],
    onEdit: () => editItem(document.querySelector("#highlight-form"), item),
    onDelete: () => removeItem("highlights", item.id, item.title),
  }), "Group achievements and school highlights will appear here.");
}

async function removeItem(collection, id, title) {
  if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    await api(`/api/admin/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
    setMessage(dashboardMessage, "The item was deleted.");
  } catch (error) {
    setMessage(dashboardMessage, error.message, true);
  }
}

async function refresh() {
  const data = await api("/api/admin/content", { cache: "no-store" });
  renderContent(data);
}

async function submitForm(form, endpoint, { multipart = false, message } = {}) {
  setBusy(form, true);
  setMessage(dashboardMessage, "Saving…");
  try {
    const id = form.elements.namedItem("id")?.value;
    let path = endpoint;
    if (id) path += `/${encodeURIComponent(id)}`;
    let options;
    if (multipart) {
      const formData = new FormData(form);
      formData.set("published", form.elements.namedItem("published").checked ? "1" : "0");
      options = { method: id ? "PUT" : "POST", body: formData };
    } else {
      const data = Object.fromEntries(new FormData(form).entries());
      if (form.elements.namedItem("published")) {
        data.published = form.elements.namedItem("published").checked ? 1 : 0;
      }
      options = { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
    }
    await api(path, options);
    if (form.id !== "settings-form") resetForm(form);
    await refresh();
    setMessage(dashboardMessage, message);
  } catch (error) {
    setMessage(dashboardMessage, error.message, true);
  } finally {
    setBusy(form, false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(loginForm, true);
  setMessage(loginMessage, "Checking your password…");
  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: new FormData(loginForm).get("password") }),
    });
    await refresh();
    loginPanel.hidden = true;
    dashboard.hidden = false;
    setMessage(dashboardMessage, "You're signed in. Drafts stay private until you publish them.");
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  } finally {
    setBusy(loginForm, false);
  }
});

document.querySelector("#settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void submitForm(event.currentTarget, "/api/admin/settings", { message: "School information saved." });
});

document.querySelector("#teacher-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void submitForm(event.currentTarget, "/api/admin/teachers", {
    multipart: true,
    message: "Teacher profile saved. Published changes appear on the public site.",
  });
});

document.querySelector("#notice-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void submitForm(event.currentTarget, "/api/admin/notices", { message: "School notice saved." });
});

document.querySelector("#highlight-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void submitForm(event.currentTarget, "/api/admin/highlights", { message: "School highlight saved." });
});

for (const [formId, cancelId] of [
  ["teacher-form", "teacher-cancel"],
  ["notice-form", "notice-cancel"],
  ["highlight-form", "highlight-cancel"],
]) {
  document.querySelector(`#${cancelId}`).addEventListener("click", () => resetForm(document.querySelector(`#${formId}`)));
}

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
    dashboard.hidden = true;
    loginPanel.hidden = false;
    loginForm.reset();
    setMessage(loginMessage, "You have been signed out.");
  } catch (error) {
    setMessage(dashboardMessage, error.message, true);
  }
});

const today = new Date().toISOString().slice(0, 10);
document.querySelector("#notice-date").value = today;
document.querySelector("#teacher-image").required = true;

try {
  await refresh();
  dashboard.hidden = false;
  loginPanel.hidden = true;
} catch (error) {
  if (error.message === "Please sign in again to continue.") {
    loginPanel.hidden = false;
  } else {
    loginPanel.hidden = true;
    fatalMessage.hidden = false;
    fatalMessage.textContent = error.message;
  }
}
