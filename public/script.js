const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
const photoDialog = document.querySelector(".photo-dialog");
const dialogImage = photoDialog.querySelector("img");
const dialogCaption = photoDialog.querySelector(".dialog-caption");
const revealSelector = [
  ".hero-banner",
  ".intro-band-inner",
  ".about .section-heading",
  ".about-body",
  ".value-card",
  ".community-heading",
  ".teacher-card",
  ".updates-heading",
  ".update-card",
  ".photos-heading",
  ".photo-card",
  ".photo-credit",
  ".visit-copy",
  ".map-card",
  ".faq-heading",
  ".faq-list details",
  ".footer-inner > *",
].join(", ");
const revealObserver = "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ? new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 })
  : null;

function observeScrollReveals(root = document) {
  if (!revealObserver) return;
  if (root instanceof Element && root.matches(revealSelector)) {
    root.classList.add("scroll-reveal");
    revealObserver.observe(root);
  }
  for (const element of root.querySelectorAll(revealSelector)) {
    if (element.classList.contains("scroll-reveal")) continue;
    element.classList.add("scroll-reveal");
    revealObserver.observe(element);
  }
}

if (revealObserver) {
  document.documentElement.classList.add("scroll-reveal-enabled");
  observeScrollReveals();
}

const scrollFriends = document.querySelector(".scroll-friends");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (scrollFriends && !prefersReducedMotion.matches) {
  const fox = scrollFriends.querySelector(".scroll-fox");
  const rabbit = scrollFriends.querySelector(".scroll-rabbit");
  const letters = [...scrollFriends.querySelectorAll(".scroll-letter")];
  let scrollFrame = 0;
  let walkingTimer = 0;

  function updateScrollFriends() {
    scrollFrame = 0;
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollRange > 0 ? Math.min(window.scrollY / scrollRange, 1) : 0;
    const viewportHeight = window.innerHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const foxSize = fox.getBoundingClientRect().width;
    const rabbitSize = rabbit.getBoundingClientRect().width;
    const sway = Math.sin(progress * Math.PI * 6) * 20;
    const foxX = Math.max(8, Math.min(viewportWidth - foxSize - 8, 12 + sway));
    const rabbitX = Math.max(8, Math.min(viewportWidth - rabbitSize - 8, viewportWidth - rabbitSize - 12 - sway));

    fox.style.transform =
      `translate3d(${foxX}px, ${(viewportHeight - foxSize) * progress}px, 0) scaleX(${progress > .5 ? -1 : 1})`;
    rabbit.style.transform =
      `translate3d(${rabbitX}px, ${(viewportHeight - rabbitSize) * (1 - progress)}px, 0) scaleX(${progress > .5 ? 1 : -1})`;
    letters.forEach((letter, index) => {
      const drift = Math.sin(progress * Math.PI * 2 + index * 2) * 34;
      const y = (viewportHeight - 100) * ((progress + index / letters.length) % 1);
      letter.style.transform = `translate3d(${drift}px, ${y}px, 0) rotate(${progress * 80 + index * 22}deg)`;
    });
  }

  function queueScrollFriendsUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollFriends);
    scrollFriends.classList.add("is-walking");
    window.clearTimeout(walkingTimer);
    walkingTimer = window.setTimeout(() => scrollFriends.classList.remove("is-walking"), 220);
  }

  window.addEventListener("scroll", queueScrollFriendsUpdate, { passive: true });
  window.addEventListener("resize", queueScrollFriendsUpdate);
  updateScrollFriends();
}

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  navigation.classList.toggle("is-open", !isExpanded);
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  }
});

document.querySelectorAll(".photo-card").forEach((photo) => {
  photo.addEventListener("click", () => {
    const image = photo.querySelector("img");
    dialogImage.src = photo.dataset.photo;
    dialogImage.alt = image.alt;
    dialogCaption.textContent = photo.dataset.caption;
    photoDialog.showModal();
  });
});

photoDialog.querySelector(".dialog-close").addEventListener("click", () => {
  photoDialog.close();
});

photoDialog.addEventListener("click", (event) => {
  if (event.target === photoDialog) {
    photoDialog.close();
  }
});

photoDialog.addEventListener("close", () => {
  dialogImage.removeAttribute("src");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navigation.classList.contains("is-open")) {
    menuToggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  }
});

function addText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderTeachers(teachers) {
  if (!teachers.length) return;

  const section = document.querySelector(".community-section");
  const grid = document.querySelector(".teacher-grid");
  grid.replaceChildren();
  section.hidden = false;

  for (const teacher of teachers) {
    const card = document.createElement("article");
    card.className = "teacher-card";
    const photo = document.createElement("img");
    photo.className = "teacher-photo";
    photo.src = teacher.image_url;
    photo.alt = `${teacher.name}, ${teacher.role}`;
    photo.width = 300;
    photo.height = 300;
    photo.loading = "lazy";
    photo.decoding = "async";
    card.append(photo);
    addText(card, "p", "teacher-role", teacher.role);
    addText(card, "h3", "teacher-name", teacher.name);
    if (teacher.bio) addText(card, "p", "teacher-bio", teacher.bio);
    grid.append(card);
  }
  observeScrollReveals(grid);
}

function renderNotices(notices) {
  if (!notices.length) return false;

  const section = document.querySelector(".news-section");
  const list = document.querySelector(".updates-list");
  const column = document.querySelector("#notices");
  column.hidden = false;
  section.hidden = false;
  list.replaceChildren();

  for (const notice of notices) {
    const card = document.createElement("article");
    card.className = "update-card";
    addText(card, "span", "update-kind", notice.kind === "event" ? "School event" : "School notice");
    addText(card, "time", "update-date", notice.publish_on);
    addText(card, "h3", "update-title", notice.title);
    addText(card, "p", "update-message", notice.message);
    list.append(card);
  }
  observeScrollReveals(list);
  return true;
}

function renderHighlights(highlights) {
  if (!highlights.length) return false;

  const section = document.querySelector(".news-section");
  const list = document.querySelector(".results-list");
  const column = document.querySelector("#results");
  column.hidden = false;
  section.hidden = false;
  list.replaceChildren();

  for (const highlight of highlights) {
    const card = document.createElement("article");
    card.className = "update-card highlight-card";
    addText(card, "span", "update-kind", `School year ${highlight.school_year}`);
    addText(card, "h3", "update-title", highlight.title);
    if (highlight.details) addText(card, "p", "update-message", highlight.details);
    list.append(card);
  }
  observeScrollReveals(list);
  return true;
}

function updateSchoolDetails(settings) {
  document.title = `${settings.school_name} | Delhi`;
  const band = document.querySelector(".band-copy");
  band.replaceChildren();
  addText(band, "span", "", settings.school_name);
  band.append(document.createTextNode(` ${settings.about.replace(settings.school_name, "").trim()}`));

  document.querySelector(".visit-intro").textContent =
    `${settings.school_name} is in Chand Nagar, Vishnu Garden, Delhi. ${settings.visit_note}`;
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    link.href = `tel:${settings.phone.replace(/[^\d+]/g, "")}`;
    if (link.closest(".phone-number") || link.textContent.includes("011 2833 2578")) {
      link.textContent = settings.phone;
    }
  });

  const address = document.querySelector(".detail-row h3").parentElement.querySelector("p");
  address.textContent = settings.address;
  const mapQuery = `${settings.school_name}, ${settings.address}`;
  const map = document.querySelector(".map-frame iframe");
  map.src = `https://maps.google.com/maps?${new URLSearchParams({ q: mapQuery, output: "embed" })}`;
  map.title = `Map showing ${settings.school_name}`;
  const destination = new URL("https://www.google.com/maps/dir/");
  destination.searchParams.set("api", "1");
  destination.searchParams.set("destination", mapQuery);
  document.querySelectorAll(".detail-link, .map-footer a").forEach((link) => {
    link.href = destination.href;
  });
}

async function loadPublishedSchoolUpdates() {
  try {
    const response = await fetch("/api/site", { cache: "no-store" });
    if (!response.ok) throw new Error(`The school updates could not be loaded (${response.status}).`);
    const content = await response.json();
    updateSchoolDetails(content.settings);
    renderTeachers(content.teachers);
    const hasNotices = renderNotices(content.notices);
    const hasHighlights = renderHighlights(content.highlights);
    document.querySelector(".news-section").hidden = !hasNotices && !hasHighlights;
  } catch (error) {
    console.error("Could not load live school updates:", error);
  }
}

void loadPublishedSchoolUpdates();
