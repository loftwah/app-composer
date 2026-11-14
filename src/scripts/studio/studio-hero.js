import { createStudioEngine } from "./studio-engine.js";
import { stationById, studioStations } from "./studio-data.js";

const stage = document.querySelector("[data-studio-stage]");
const canvas = document.querySelector("[data-studio-canvas]");
const posters = Array.from(
  document.querySelectorAll("[data-studio-poster]"),
);
const consolePanel = document.querySelector("[data-studio-console]");
const staticPanel = document.querySelector("[data-studio-static]");
const status = document.querySelector("[data-studio-status]");
const instruction = document.querySelector("[data-studio-instruction]");
const readout = document.querySelector("[data-studio-readout]");
const context = document.querySelector("[data-studio-context]");
const productLink = document.querySelector("[data-studio-link]");
const sceneLabel = document.querySelector("[data-studio-scene-label]");
const caption = document.querySelector("[data-studio-caption]");
const feed = document.querySelector("[data-studio-feed]");
const feedLabel = document.querySelector("[data-studio-feed-label]");
const action = document.querySelector("[data-studio-action]");
const actionLabel = document.querySelector("[data-studio-action-label]");
const pause = document.querySelector("[data-studio-pause]");
const pauseLabel = document.querySelector("[data-studio-pause-label]");
const announcement = document.querySelector("[data-studio-announcement]");
const stationButtons = Array.from(document.querySelectorAll("[data-station]"));

if (stage && canvas && consolePanel && staticPanel) {
  let engine = null;
  let actionTaken = new Set();
  let userPaused = false;
  let lastStation = null;
  let failed = false;

  const announce = (message) => {
    if (!announcement) return;
    announcement.textContent = "";
    requestAnimationFrame(() => {
      announcement.textContent = message;
    });
  };

  const copyFor = (id) => stationById(id);

  const readoutFor = (snapshot) => {
    const station = copyFor(snapshot.station);
    if (snapshot.station === "press") {
      return actionTaken.has("press") ? station.afterAction : station.readout;
    }
    if (snapshot.station === "draw") {
      if (snapshot.target > 80) {
        return "The drawing stands as paper architecture. Its lines are still editable.";
      }
      if (snapshot.target < 10) {
        return "The drawing lies flat on the table. Raise it to give the lines a third dimension.";
      }
      return station.readout;
    }
    const ring = snapshot.ring ?? station.rings[0];
    return `${ring.label}. ${ring.detail}`;
  };

  const updateUi = (snapshot, meta = {}) => {
    const station = copyFor(snapshot.station);
    stationButtons.forEach((button) => {
      const selected = button.dataset.station === snapshot.station;
      button.setAttribute("aria-pressed", String(selected));
      button.dataset.active = String(selected);
      button.tabIndex = selected ? 0 : -1;
    });
    if (feed) {
      if (snapshot.station !== "press" && document.activeElement === feed) {
        stationButtons.find((button) => button.dataset.station === snapshot.station)?.focus();
      }
      feed.hidden = snapshot.station !== "press";
      feed.setAttribute("aria-pressed", String(snapshot.target > 80));
    }
    if (feedLabel) feedLabel.textContent = snapshot.target > 80 ? "Reset the sheet" : "Feed the sheet";
    if (actionLabel) {
      const active =
        snapshot.station === "draw"
          ? snapshot.target > 80
          : actionTaken.has(snapshot.station);
      actionLabel.textContent = active ? station.actionActive : station.actionIdle;
    }
    if (instruction) instruction.textContent = station.instruction;
    if (readout) readout.textContent = readoutFor(snapshot);
    if (context) context.textContent = station.context;
    if (productLink) {
      productLink.href = station.href;
      productLink.textContent = station.linkLabel;
    }
    if (sceneLabel) sceneLabel.textContent = station.sceneLabel;
    if (caption) caption.textContent = station.caption;

    if (pause && pauseLabel) {
      pause.disabled = snapshot.reduced;
      pause.setAttribute("aria-pressed", String(snapshot.paused || snapshot.reduced));
      pauseLabel.textContent = snapshot.reduced
        ? "Reduced motion"
        : snapshot.paused
          ? "Resume motion"
          : "Pause motion";
    }

    if (lastStation !== snapshot.station) {
      lastStation = snapshot.station;
      if (meta.reason === "station" || meta.reason === "init") {
        announce(`${station.name}. ${station.instruction}`);
      }
    }

    if (meta.reason === "action") {
      if (snapshot.station === "press") announce("A fictional page was stamped.");
      if (snapshot.station === "draw") {
        announce(
          snapshot.target > 80
            ? "The drawing lifted into paper architecture."
            : "The drawing returned to the page.",
        );
      }
      if (snapshot.station === "lens") {
        const ring = snapshot.ring ?? station.rings[0];
        announce(`${ring.label}. ${ring.detail}`);
      }
    }
    if (meta.reason === "pause") {
      announce(
        snapshot.paused
          ? "Ambient motion paused. The controls still work."
          : "Ambient motion resumed.",
      );
    }
  };

  const setStatus = (message, tone = "quiet") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const fail = (message) => {
    // Construction reports its error before returning null; announce that
    // single failure once even when both paths reach this fallback.
    if (failed) return;
    failed = true;
    stage.dataset.state = "static";
    stage.classList.remove("is-ready");
    posters.forEach((poster) => {
      poster.hidden = false;
    });
    consolePanel.hidden = true;
    staticPanel.hidden = false;
    setStatus("Illustrated workshop · static", "warn");
    const note = document.querySelector("[data-studio-static-note]");
    if (note) note.textContent = message;
    announce(message);
  };

  const start = async () => {
    if (engine || stage.dataset.state === "static") return;
    setStatus("Waking the workshop…", "loading");
    try {
      engine = createStudioEngine({
        canvas,
        stage,
        onReady: () => {
          stage.dataset.state = "live";
          stage.classList.add("is-ready");
          // Readiness follows the first painted frame. Keep the poster beneath
          // the brief canvas fade so loading never reveals an empty backdrop.
          consolePanel.hidden = false;
          staticPanel.hidden = true;
          setStatus("Live 3D workshop", "live");
          announce(
            "Interactive workshop ready. Choose a station and use its buttons. Press P to pause motion.",
          );
        },
        onState: updateUi,
        onLost: () =>
          fail("The live workshop stopped. The illustrated poster and app links remain."),
        onError: () =>
          fail("The live workshop could not start. The illustrated poster and app links remain."),
      });
      if (!engine) {
        fail("This browser could not start the live workshop. The poster and app links remain.");
        return;
      }
      engine.setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (userPaused) engine.setPaused(true);
    } catch (error) {
      console.warn("Studio workshop unavailable:", error?.message ?? error);
      fail("The live workshop could not start. The poster and app links remain.");
    }
  };

  stationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!engine) return;
      engine.setStation(button.dataset.station);
    });
    button.addEventListener("keydown", (event) => {
      const index = studioStations.findIndex(
        (station) => station.id === button.dataset.station,
      );
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (index + 1) % studioStations.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (index + studioStations.length - 1) % studioStations.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = studioStations.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const target = stationButtons[next];
      target.focus();
      engine?.setStation(target.dataset.station);
    });
  });

  feed?.addEventListener("click", () => {
    if (!engine) return;
    const reset = feed.getAttribute("aria-pressed") === "true";
    engine.setProgress(reset ? copyFor("press").initialProgress : 100);
    announce(reset ? "The sheet returned to the feed position." : "The sheet moved through the press.");
  });

  action?.addEventListener("click", () => {
    if (!engine) return;
    actionTaken.add(engine.state.station);
    engine.action();
  });

  pause?.addEventListener("click", () => {
    if (!engine) return;
    userPaused = !userPaused;
    engine.setPaused(userPaused);
  });

  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  reducedQuery.addEventListener("change", (event) => {
    engine?.setReduced(event.matches);
    if (event.matches) {
      userPaused = false;
      engine?.setPaused(false);
    }
  });

  const withinStudio = () => {
    const rect = stage.getBoundingClientRect();
    return rect.bottom > 80 && rect.top < innerHeight - 80;
  };

  document.addEventListener("keydown", (event) => {
    if (!engine || !withinStudio() || event.defaultPrevented) return;
    const target = event.target;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (target instanceof HTMLElement) {
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable ||
        target.closest("a") ||
        (target.tagName === "BUTTON" && !target.closest("[data-studio-console]"))
      ) {
        return;
      }
    }
    const index = studioStations.findIndex((station) => station.id === engine.state.station);
    if (event.key === "1" || event.key === "2" || event.key === "3") {
      event.preventDefault();
      engine.setStation(studioStations[Number(event.key) - 1].id);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      engine.setStation(studioStations[(index + 1) % studioStations.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      engine.setStation(
        studioStations[(index + studioStations.length - 1) % studioStations.length].id,
      );
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      if (!reducedQuery.matches) {
        userPaused = !engine.state.paused;
        engine.setPaused(userPaused);
      }
    } else if (event.key === "Escape") {
      engine.resetOrbit();
    }
  });

  // ProductHome already defers the module until after first paint. Do not add
  // a second idle delay before the first frame.
  const connection = navigator.connection;
  const saveData = connection?.saveData === true;
  if (saveData) {
    fail("Save-Data is on. The illustrated poster and app links remain available.");
  } else {
    start();
  }
}
