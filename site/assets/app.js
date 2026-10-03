(function () {
  "use strict";

  var root = document.documentElement;
  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function motionReduced() {
    return root.getAttribute("data-motion") === "reduced" || (reduceQuery && reduceQuery.matches);
  }

  // Reduced-motion preference, remembered locally.
  var motionToggle = document.getElementById("motion-toggle");
  function applyMotion(mode) {
    if (mode === "reduced") root.setAttribute("data-motion", "reduced");
    else root.removeAttribute("data-motion");
    if (motionToggle) {
      var pressed = mode === "reduced";
      motionToggle.setAttribute("aria-pressed", pressed ? "true" : "false");
      motionToggle.textContent = pressed ? "동작 줄임 켜짐" : "동작 줄이기";
    }
  }
  var storedMotion = null;
  try {
    storedMotion = localStorage.getItem("blueb-motion");
  } catch (error) {
    storedMotion = null;
  }
  applyMotion(storedMotion || (reduceQuery && reduceQuery.matches ? "reduced" : "full"));
  if (motionToggle) {
    motionToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-motion") === "reduced" ? "full" : "reduced";
      applyMotion(next);
      try {
        localStorage.setItem("blueb-motion", next);
      } catch (error) {
        /* storage may be blocked */
      }
    });
  }

  // Mascot notes. Local tips only; this is not a chat interface.
  var notes = document.getElementById("mascot-notes");
  var mascotButton = document.querySelector(".mascot-button");
  if (notes && mascotButton) {
    var openNotes = function () {
      notes.hidden = false;
      mascotButton.setAttribute("aria-expanded", "true");
      var first = notes.querySelector("a, button");
      if (first) first.focus();
    };
    var closeNotes = function (returnFocus) {
      notes.hidden = true;
      mascotButton.setAttribute("aria-expanded", "false");
      if (returnFocus) mascotButton.focus();
    };
    mascotButton.addEventListener("click", function () {
      if (notes.hidden) openNotes();
      else closeNotes(true);
    });
    notes.addEventListener("click", function (event) {
      if (event.target.closest("[data-notes-close]")) closeNotes(true);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !notes.hidden) closeNotes(true);
    });
    document.addEventListener("click", function (event) {
      if (!notes.hidden && !notes.contains(event.target) && !mascotButton.contains(event.target)) {
        closeNotes(false);
      }
    });
  }

  // Cursor parallax, scoped to the mascot scene only.
  var scene = document.querySelector("[data-parallax]");
  if (scene && !motionReduced()) {
    var frame = 0;
    scene.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch") return;
      var rect = scene.getBoundingClientRect();
      var mx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      var my = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        scene.style.setProperty("--mx", mx.toFixed(3));
        scene.style.setProperty("--my", my.toFixed(3));
      });
    });
    scene.addEventListener("pointerleave", function () {
      scene.style.setProperty("--mx", "0");
      scene.style.setProperty("--my", "0");
    });
  }

  // Home: keyboard-accessible search + category filter over static cards.
  var postList = document.getElementById("post-list");
  if (postList) {
    var cards = Array.prototype.slice.call(postList.querySelectorAll("[data-post-card]"));
    var filters = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
    var search = document.getElementById("post-search");
    var listStatus = document.getElementById("list-status");
    var emptyState = document.getElementById("empty-state");
    var activeFilter = "all";

    var render = function () {
      var query = search ? search.value.trim().toLowerCase() : "";
      var shown = 0;
      cards.forEach(function (card) {
        var categoryOk = activeFilter === "all" || card.getAttribute("data-category") === activeFilter;
        var searchOk = !query || (card.getAttribute("data-search") || "").indexOf(query) !== -1;
        var show = categoryOk && searchOk;
        card.hidden = !show;
        if (show) shown += 1;
      });
      if (listStatus) listStatus.textContent = "글 " + shown + "편";
      if (emptyState) emptyState.hidden = shown !== 0;
    };

    filters.forEach(function (button) {
      button.addEventListener("click", function () {
        activeFilter = button.getAttribute("data-filter");
        filters.forEach(function (other) {
          var on = other === button;
          other.classList.toggle("is-active", on);
          other.setAttribute("aria-pressed", on ? "true" : "false");
        });
        render();
      });
      button.addEventListener("keydown", function (event) {
        var index = filters.indexOf(button);
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          filters[(index + 1) % filters.length].focus();
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          filters[(index - 1 + filters.length) % filters.length].focus();
        }
      });
    });
    if (search) search.addEventListener("input", render);
    render();
  }

  // Article table of contents scroll spy.
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc nav a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      if (target) byId[id] = link;
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          tocLinks.forEach(function (link) {
            link.classList.remove("is-active");
          });
          var activeLink = byId[entry.target.id];
          if (activeLink) activeLink.classList.add("is-active");
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    Object.keys(byId).forEach(function (id) {
      observer.observe(document.getElementById(id));
    });
  }

  // Reading progress bar.
  var progressBar = document.querySelector("#reading-progress span");
  if (progressBar) {
    var updateProgress = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var percent = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
      progressBar.style.width = percent + "%";
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  // Copy link with a non-secure-context fallback.
  Array.prototype.slice.call(document.querySelectorAll("[data-copy-url]")).forEach(function (button) {
    button.addEventListener("click", function () {
      var url = button.getAttribute("data-copy-url") || window.location.href;
      var status = document.querySelector(".copy-status");
      var report = function (message) {
        if (status) status.textContent = message;
      };
      var fallback = function () {
        var field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.top = "-1000px";
        document.body.appendChild(field);
        field.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (error) {
          ok = false;
        }
        document.body.removeChild(field);
        report(ok ? "주소를 복사했습니다." : "복사할 수 없습니다. 주소창의 주소를 사용하세요.");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () {
            report("주소를 복사했습니다.");
          },
          fallback,
        );
      } else {
        fallback();
      }
    });
  });

  // Privacy-enhanced video: load YouTube only after a click.
  Array.prototype.slice.call(document.querySelectorAll("[data-video]")).forEach(function (box) {
    var loadButton = box.querySelector("[data-video-load]");
    if (!loadButton) return;
    loadButton.addEventListener("click", function () {
      var id = box.getAttribute("data-youtube-id");
      if (!id) return;
      var iframe = document.createElement("iframe");
      iframe.setAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0",
      );
      iframe.setAttribute("title", loadButton.getAttribute("aria-label") || "공식 영상");
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      );
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("loading", "lazy");
      box.replaceChildren(iframe);
    });
  });
})();
