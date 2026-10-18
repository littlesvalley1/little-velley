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
