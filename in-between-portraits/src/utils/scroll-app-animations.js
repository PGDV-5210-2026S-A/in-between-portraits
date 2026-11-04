import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import {
  EXHIBITIONS_SANKEY_BRIDGE_ATTR,
  EXHIBITIONS_VIZ_CONFIG,
} from "../constants/exhibitions-viz.js";
import { artistDotInlineSvg } from "./artist-dot.js";
import { isClusterArtModeActive } from "./cluster-art-mode-flag.js";

const SMOOTH_WRAPPER_ID = "#smooth-wrapper";
const SMOOTH_CONTENT_ID = "#smooth-content";
const EXHIBITIONS_SCROLL_CONFIG = {
  timelineToSankey: {
    startNearBottomPx: 200,
  },
  bridgeLabel: {
    endYOffsetPx: -8,
    startXOffsetPx: 6,
    exhibitionsEndXNudgePx: 2,
    artistsEndXNudgePx: -2,
    institutionsEndXNudgePx: -4,
  },
};
const SECTION_HANDOFF_SCROLL_CONFIG = {
  identity: {
    pinScrollDistance: "+=440%",
    finalStateHoldProgressWindow: 0.22,
  },
  personaToExhibitions: {
    preCoverHoldViewport: 0.34,
    coverRevealStartProgress: 0.56,
    minPinScrollVh: 0.5,
  },
};
const IDENTITY_PREVIEW_CONFIG = {
  featuredKeywords: {
    state2Primary: "ancestry",
    state2Secondary: "mixed",
    state3Sequence: ["appearance", "community", "personal"],
  },
  emphasis: {
    highlightScale: 2,
    nonFeaturedOpacity: 0.3,
  },
  timeline: {
    holdEnd: {
      state0: 0.16,
      state1Collective: 0.34,
      state2: 0.72,
      state3TextLead: 0.75,
      state3First: 0.82,
      state3Second: 0.92,
    },
    transitionStart: {
      state2: 0.44,
    },
    transitionEnd: {
      state2TextLead: 0.48,
      state2Primary: 0.56,
      state2Secondary: 0.66,
      state3SecondBlend: 0.88,
      state3ThirdBlend: 0.97,
    },
    pinScrollDistance: SECTION_HANDOFF_SCROLL_CONFIG.identity.pinScrollDistance,
  },
};

function measurePersonaPositions(actorsEl, section3El, personaIcon, section3PersonaImg) {
  if (!actorsEl || !section3El || !personaIcon || !section3PersonaImg) return null;

  const s2Rect = actorsEl.getBoundingClientRect();
  const iconRect = personaIcon.getBoundingClientRect();
  const s3Rect = section3El.getBoundingClientRect();
  const s3PRect = section3PersonaImg.getBoundingClientRect();

  return {
    start: {
      x: iconRect.left,
      y: iconRect.top - s2Rect.top,
      w: iconRect.width,
      h: iconRect.height,
    },
    end: {
      x: s3PRect.left,
      y: s3PRect.top - s3Rect.top,
      w: s3PRect.width,
      h: s3PRect.height,
    },
  };
}

function setIdentityState(sectionEl, stateId) {
  const descriptorMap = {
    descriptor0: null,
    descriptor1: "descriptor1",
    descriptor2: "descriptor2",
    descriptor3_1: "descriptor3",
    descriptor3_2: "descriptor3",
    descriptor3_3: "descriptor3",
  };
  const activeDescriptor = descriptorMap[stateId];
  sectionEl.querySelectorAll("[data-descriptor]").forEach((node) => {
    node.classList.toggle(
      "identity-heading__descriptor--active",
      node.dataset.descriptor === activeDescriptor,
    );
  });
}

function normalizeThemeKey(input) {
  return String(input ?? "").trim().toLowerCase();
}

function smoothstep01(v) {
  const p = clamp01(v);
  return p * p * (3 - 2 * p);
}

function applyIdentityLabelFocus(sectionEl, weightsByTheme, focusStrength = 1) {
  const labels = sectionEl.querySelectorAll(".identity-label[data-theme-key]");
  const strength = clamp01(focusStrength);
  labels.forEach((node) => {
    const themeKey = normalizeThemeKey(node.dataset.themeKey);
    const themeWeight = clamp01(weightsByTheme[themeKey] ?? 0);
    const featuredness = themeWeight * strength;
    const scale = 1 + (IDENTITY_PREVIEW_CONFIG.emphasis.highlightScale - 1) * featuredness;
    const opacity = 1
      - (1 - IDENTITY_PREVIEW_CONFIG.emphasis.nonFeaturedOpacity) * strength * (1 - featuredness);
    gsap.set(node, {
      "--identity-label-scale": String(scale),
      "--identity-label-opacity": String(opacity),
    });
  });
}

function applyIdentityPreviewByProgress(sectionEl, progress) {
  const { holdEnd, transitionStart, transitionEnd } = IDENTITY_PREVIEW_CONFIG.timeline;
  const p = clamp01(progress);
  const state3Keywords = IDENTITY_PREVIEW_CONFIG.featuredKeywords.state3Sequence
    .map((theme) => normalizeThemeKey(theme));
  const [firstKeyword, secondKeyword, thirdKeyword] = state3Keywords;
  const primaryState2Keyword = normalizeThemeKey(
    IDENTITY_PREVIEW_CONFIG.featuredKeywords.state2Primary,
  );
  const secondaryState2Keyword = normalizeThemeKey(
    IDENTITY_PREVIEW_CONFIG.featuredKeywords.state2Secondary,
  );

  if (p < holdEnd.state0) {
    setIdentityState(sectionEl, "descriptor0");
    applyIdentityLabelFocus(sectionEl, {}, 0);
    return;
  }

  if (p < holdEnd.state1Collective) {
    setIdentityState(sectionEl, "descriptor1");
    applyIdentityLabelFocus(sectionEl, {}, 0);
    return;
  }

  if (p < transitionStart.state2) {
    setIdentityState(sectionEl, "descriptor1");
    applyIdentityLabelFocus(sectionEl, {}, 0);
    return;
  }

  if (p < holdEnd.state2) {
    setIdentityState(sectionEl, "descriptor2");

    if (p < transitionEnd.state2TextLead) {
      applyIdentityLabelFocus(sectionEl, {}, 0);
      return;
    }

    if (p < transitionEnd.state2Primary) {
      const localP = smoothstep01(
        (p - transitionEnd.state2TextLead) /
        (transitionEnd.state2Primary - transitionEnd.state2TextLead),
      );
      applyIdentityLabelFocus(
        sectionEl,
        { [primaryState2Keyword]: 1 },
        localP,
      );
      return;
    }

    if (p < transitionEnd.state2Secondary) {
      const localP = smoothstep01(
        (p - transitionEnd.state2Primary) /
        (transitionEnd.state2Secondary - transitionEnd.state2Primary),
      );
      applyIdentityLabelFocus(
        sectionEl,
        {
          [primaryState2Keyword]: 1,
          [secondaryState2Keyword]: localP,
        },
        1,
      );
      return;
    }

    applyIdentityLabelFocus(
      sectionEl,
      {
        [primaryState2Keyword]: 1,
        [secondaryState2Keyword]: 1,
      },
      1,
    );
    return;
  }

  if (p < holdEnd.state3TextLead) {
    setIdentityState(sectionEl, "descriptor3_1");
    applyIdentityLabelFocus(
      sectionEl,
      {
        [primaryState2Keyword]: 1,
        [secondaryState2Keyword]: 1,
      },
      1,
    );
    return;
  }

  if (p < holdEnd.state3First) {
    setIdentityState(sectionEl, "descriptor3_1");
    applyIdentityLabelFocus(sectionEl, { [firstKeyword]: 1 }, 1);
    return;
  }

  if (p < transitionEnd.state3SecondBlend) {
    const blendP = smoothstep01(
      (p - holdEnd.state3First) /
      (transitionEnd.state3SecondBlend - holdEnd.state3First),
    );
    setIdentityState(sectionEl, "descriptor3_2");
    applyIdentityLabelFocus(
      sectionEl,
      {
        [firstKeyword]: 1 - blendP,
        [secondKeyword]: blendP,
      },
      1,
    );
    return;
  }

  if (p < holdEnd.state3Second) {
    setIdentityState(sectionEl, "descriptor3_2");
    applyIdentityLabelFocus(sectionEl, { [secondKeyword]: 1 }, 1);
    return;
  }

  if (p < transitionEnd.state3ThirdBlend) {
    const blendP = smoothstep01(
      (p - holdEnd.state3Second) /
      (transitionEnd.state3ThirdBlend - holdEnd.state3Second),
    );
    setIdentityState(sectionEl, "descriptor3_3");
    applyIdentityLabelFocus(
      sectionEl,
      {
        [secondKeyword]: 1 - blendP,
        [thirdKeyword]: blendP,
      },
      1,
    );
    return;
  }

  setIdentityState(sectionEl, "descriptor3_3");
  applyIdentityLabelFocus(sectionEl, { [thirdKeyword]: 1 }, 1);
}

function setupIdentitySectionTimeline(section2El) {
  applyIdentityPreviewByProgress(section2El, 0);

  function getIdentityMappedProgress(progress) {
    const holdWindow = clamp01(
      SECTION_HANDOFF_SCROLL_CONFIG.identity.finalStateHoldProgressWindow,
    );
    const activeProgressSpan = Math.max(0.01, 1 - holdWindow);
    return clamp01(progress / activeProgressSpan);
  }

  ScrollTrigger.create({
    trigger: section2El,
    start: "top top",
    end: IDENTITY_PREVIEW_CONFIG.timeline.pinScrollDistance,
    pin: true,
    scrub: 1,
    onUpdate: (self) => {
      applyIdentityPreviewByProgress(section2El, getIdentityMappedProgress(self.progress));
    },
    onRefresh: (self) => {
      applyIdentityPreviewByProgress(section2El, getIdentityMappedProgress(self.progress));
    },
    onLeaveBack: () => {
      applyIdentityPreviewByProgress(section2El, 0);
    },
  });
}

function personaHandoffHoldPx() {
  const f = SECTION_HANDOFF_SCROLL_CONFIG.personaToExhibitions.preCoverHoldViewport;
  return Math.max(0, Math.round(window.innerHeight * f));
}

function getPersonaCoverFlowGapPx(s3El, sectionAfterS3El) {
  if (!s3El || !sectionAfterS3El) return 0;
  if (s3El.parentElement === sectionAfterS3El.parentElement) {
    const gap = sectionAfterS3El.offsetTop - s3El.offsetTop;
    if (gap > 1) return Math.round(gap);
  }
  const dy =
    sectionAfterS3El.getBoundingClientRect().top - s3El.getBoundingClientRect().top;
  return Math.max(0, Math.round(dy));
}

function getPersonaPinScrollDistancePx(s3El, sectionAfterS3El) {
  const { minPinScrollVh } = SECTION_HANDOFF_SCROLL_CONFIG.personaToExhibitions;
  const base = getPersonaCoverFlowGapPx(s3El, sectionAfterS3El);
  const hold = personaHandoffHoldPx();
  const minPx = Math.round(window.innerHeight * minPinScrollVh);
  return Math.max(minPx, 1, base + hold);
}

function createPersonaCoverTimeline({
  s3El,
  sectionAfterS3El,
  s3PersonaImg = null,
  floatingEl = null,
  onEnter,
  onLeaveBack,
}) {
  const holdPx = personaHandoffHoldPx();
  const revealStartProgress = clamp01(
    SECTION_HANDOFF_SCROLL_CONFIG.personaToExhibitions.coverRevealStartProgress,
  );
  const revealDuration = Math.max(0.01, 1 - revealStartProgress);
  gsap.set(sectionAfterS3El, { position: "relative", zIndex: 2, y: holdPx });

  function syncFloatingForScrollPosition(scrollTriggerSelf) {
    if (!floatingEl) return;
    const scroll = scrollTriggerSelf.scroll();
    if (scroll >= scrollTriggerSelf.start) gsap.set(floatingEl, { opacity: 0 });
  }

  return gsap.timeline({
    scrollTrigger: {
      trigger: s3El,
      start: "top top",
      end: () => `+=${getPersonaPinScrollDistancePx(s3El, sectionAfterS3El)}`,
      pin: true,
      pinSpacing: false,
      pinReparent: true,
      scrub: true,
      invalidateOnRefresh: true,
      onEnter,
      onLeave: () => {
        gsap.set(sectionAfterS3El, { y: 0 });
        if (s3PersonaImg) gsap.set(s3PersonaImg, { opacity: 0 });
      },
      onEnterBack: () => {
        if (s3PersonaImg) gsap.set(s3PersonaImg, { opacity: 1 });
        if (floatingEl) gsap.set(floatingEl, { opacity: 0 });
      },
      onLeaveBack,
      onRefresh: (self) => {
        const p = self.progress;
        if (p <= 0) {
          if (s3PersonaImg) gsap.set(s3PersonaImg, { opacity: 0 });
        } else if (p >= 1) {
          gsap.set(sectionAfterS3El, { y: 0 });
          if (s3PersonaImg) gsap.set(s3PersonaImg, { opacity: 0 });
        } else if (s3PersonaImg) {
          gsap.set(s3PersonaImg, { opacity: 1 });
        }
        queueMicrotask(() => syncFloatingForScrollPosition(self));
        gsap.delayedCall(0, () => syncFloatingForScrollPosition(self));
      },
    },
  })
    .to(sectionAfterS3El, { y: holdPx, duration: revealStartProgress, ease: "none" }, 0)
    .to(sectionAfterS3El, { y: 0, duration: revealDuration, ease: "none" }, revealStartProgress);
}

function setupActorsToPersonaGrow({
  actorsEl,
  s3El,
  sectionAfterS3El,
  floatingEl,
  s3PersonaImg,
  personaPos,
}) {
  let personaCoverST = null;

  const personaIcon = actorsEl.querySelector(
    '[data-actor="persona"] .actors-preview__icon',
  );
  const personaCell = actorsEl.querySelector('[data-actor="persona"]');
  const nonPersonaCells = actorsEl.querySelectorAll(
    '.actors-preview__cell:not([data-actor="persona"])',
  );
  const personaLabel = personaCell?.querySelector("span");
  const s2Heading = actorsEl.querySelector(".page-section-heading");

  gsap.set(floatingEl, {
    left: personaPos.start.x,
    top: personaPos.start.y,
    width: personaPos.start.w,
    height: personaPos.start.h,
    opacity: 0,
  });

  gsap.set(s3PersonaImg, { opacity: 0 });

  const s2Tl = gsap.timeline({
    scrollTrigger: {
      trigger: actorsEl,
      start: "top top",
      end: "+=150%",
      pin: true,
      scrub: 1,
      onUpdate(self) {
        if (personaCoverST && self.scroll() >= personaCoverST.start) {
          gsap.set(floatingEl, { opacity: 0 });
        }
      },
    },
  });

  s2Tl
    .to(s2Heading, { opacity: 0, duration: 0.25 }, 0)
    .to(nonPersonaCells, { opacity: 0, duration: 0.25 }, 0)
    .to(personaLabel, { opacity: 0, duration: 0.2 }, 0.1);

  s2Tl
    .set(personaIcon, { visibility: "hidden" }, 0.28)
    .set(floatingEl, { opacity: 1 }, 0.28)
    .to(
      floatingEl,
      {
        left: personaPos.end.x,
        top: personaPos.end.y,
        width: personaPos.end.w,
        height: personaPos.end.h,
        duration: 0.55,
        ease: "power2.inOut",
      },
      0.3,
    );

  const personaCoverTl = createPersonaCoverTimeline({
    s3El,
    sectionAfterS3El,
    s3PersonaImg,
    floatingEl,
    onEnter: () => {
      gsap.set(floatingEl, { opacity: 0 });
      gsap.set(s3PersonaImg, { opacity: 1 });
    },
    onLeaveBack: () => {
      gsap.set(sectionAfterS3El, { y: 0 });
      gsap.set(s3PersonaImg, { opacity: 0 });
      gsap.set(floatingEl, { opacity: 1 });
    },
  });

  personaCoverST = personaCoverTl.scrollTrigger;
}

function setupSection3PinCoverFallback(s3El, sectionAfterS3El) {
  createPersonaCoverTimeline({
    s3El,
    sectionAfterS3El,
    onEnter: undefined,
    onLeaveBack: () => {
      gsap.set(sectionAfterS3El, { y: 0 });
    },
  });
}

function sankeySvgUserXToViewportX(svgEl, userX, userY) {
  if (!svgEl || !Number.isFinite(userX)) return null;
  const h = parseFloat(svgEl.getAttribute("height"));
  const y = Number.isFinite(userY) ? userY : (Number.isFinite(h) ? h / 2 : 0);
  const pt = svgEl.createSVGPoint();
  pt.x = userX;
  pt.y = y;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return null;
  return pt.matrixTransform(ctm).x;
}

function setupExhibitionsLabel({
  labelEl,
  startAnchorEl,
  endAnchorEl,
  timelineSectionEl,
  sankeySectionEl,
}) {
  if (!labelEl || !startAnchorEl || !endAnchorEl || !timelineSectionEl || !sankeySectionEl) return;

  const trackEl = labelEl.querySelector(".exhibitions-bridge-label__track");
  const exhibitionsEl = labelEl.querySelector(".exhibitions-bridge-label__token--exhibitions");
  const artistsEl = labelEl.querySelector(".exhibitions-bridge-label__token--artists");
  const institutionsEl = labelEl.querySelector(".exhibitions-bridge-label__token--institutions");
  if (!trackEl || !exhibitionsEl || !artistsEl) return;
  const fadeInEls = [artistsEl, institutionsEl].filter(Boolean);
  gsap.set([exhibitionsEl, ...fadeInEls], { yPercent: -50 });

  function yFromTimelineBaseline() {
    const baselineLine = [...timelineSectionEl.querySelectorAll(".exhibitions-timeline line")]
      .find((node) => !node.hasAttribute("stroke-dasharray"));
    if (baselineLine) {
      const { top, height } = baselineLine.getBoundingClientRect();
      return top + height / 2;
    }
    return startAnchorEl.getBoundingClientRect().top;
  }

  function labelTopForTokenCenter(targetCenterY) {
    const labelRect = labelEl.getBoundingClientRect();
    const exhibitionsRect = exhibitionsEl.getBoundingClientRect();
    const tokenCenterOffset = exhibitionsRect.top + exhibitionsRect.height / 2 - labelRect.top;
    return targetCenterY - tokenCenterOffset;
  }

  function getSankeyColumnTargets() {
    const svg = sankeySectionEl.querySelector(".exhibitions-sankey svg");
    if (!svg) return null;
    const exX = parseFloat(svg.getAttribute(EXHIBITIONS_SANKEY_BRIDGE_ATTR.exhibitionLabelAnchorX));
    const arX = parseFloat(svg.getAttribute(EXHIBITIONS_SANKEY_BRIDGE_ATTR.artistLabelAnchorX));
    const inX = parseFloat(
      svg.getAttribute(EXHIBITIONS_SANKEY_BRIDGE_ATTR.institutionLabelAnchorX),
    );
    const h = parseFloat(svg.getAttribute("height"));
    const midY = Number.isFinite(h) ? h / 2 : 0;
    if (!Number.isFinite(exX) || !Number.isFinite(arX)) return null;
    const exhibitionRight = sankeySvgUserXToViewportX(svg, exX, midY);
    const artistLeft = sankeySvgUserXToViewportX(svg, arX, midY);
    if (exhibitionRight == null || artistLeft == null) return null;
    const institutionLeft = Number.isFinite(inX)
      ? sankeySvgUserXToViewportX(svg, inX, midY)
      : null;
    return { exhibitionRight, artistLeft, institutionLeft };
  }

  function getTokenTargets() {
    const trackRect = trackEl.getBoundingClientRect();
    const exhibitionWidth = exhibitionsEl.getBoundingClientRect().width;
    const artistsWidth = artistsEl.getBoundingClientRect().width;
    const trackWidth = trackRect.width;
    const startAnchoredExhibitionsX = EXHIBITIONS_SCROLL_CONFIG.bridgeLabel.startXOffsetPx;
    const nudgeEx = EXHIBITIONS_SCROLL_CONFIG.bridgeLabel.exhibitionsEndXNudgePx;
    const nudgeArt = EXHIBITIONS_SCROLL_CONFIG.bridgeLabel.artistsEndXNudgePx;
    const nudgeInst = EXHIBITIONS_SCROLL_CONFIG.bridgeLabel.institutionsEndXNudgePx;
    const sankeyTargets = getSankeyColumnTargets();
    if (!sankeyTargets) {
      const fallbackArtistsX = trackWidth / 2 - artistsWidth / 2 + nudgeArt;
      return {
        exhibitionsStartX: startAnchoredExhibitionsX,
        exhibitionsEndX: startAnchoredExhibitionsX,
        artistsTargetX: fallbackArtistsX,
        institutionsTargetX: fallbackArtistsX + artistsWidth + 24,
      };
    }

    const nonNegativeX = (x) => Math.max(0, x);
    const clampStartX = (x) =>
      gsap.utils.clamp(0, Math.max(0, trackWidth - exhibitionWidth), x);

    const exhibitionsEndX = nonNegativeX(
      sankeyTargets.exhibitionRight - trackRect.left - exhibitionWidth + nudgeEx,
    );
    const artistsTargetX = nonNegativeX(
      sankeyTargets.artistLeft - trackRect.left + nudgeArt,
    );
    const institutionsTargetX =
      sankeyTargets.institutionLeft == null
        ? null
        : nonNegativeX(sankeyTargets.institutionLeft - trackRect.left + nudgeInst);

    return {
      exhibitionsStartX: clampStartX(startAnchoredExhibitionsX),
      exhibitionsEndX,
      artistsTargetX,
      institutionsTargetX,
    };
  }

  function applyProgress(p) {
    const startCenterY = yFromTimelineBaseline();
    const endCenterY = endAnchorEl.getBoundingClientRect().top
      + EXHIBITIONS_SCROLL_CONFIG.bridgeLabel.endYOffsetPx;
    const {
      exhibitionsStartX,
      exhibitionsEndX,
      artistsTargetX,
      institutionsTargetX,
    } = getTokenTargets();

    const yP = Math.min(p / 0.15, 1);
    const tokenCenterY =
      yP >= 1 ? endCenterY : startCenterY + (endCenterY - startCenterY) * yP;
    const top = labelTopForTokenCenter(tokenCenterY);
    gsap.set(labelEl, { top, opacity: 1 });

    const xP = gsap.utils.clamp(0, 1, (p - 0.15) / 0.06);
    gsap.set(exhibitionsEl, {
      x: exhibitionsStartX + (exhibitionsEndX - exhibitionsStartX) * xP,
      opacity: 1,
    });

    const fP = gsap.utils.clamp(0, 1, (p - 0.21) / 0.06);
    gsap.set(artistsEl, {
      x: artistsTargetX,
      opacity: fP,
    });
    if (institutionsEl && institutionsTargetX != null) {
      gsap.set(institutionsEl, { x: institutionsTargetX, opacity: fP });
    }
  }

  function setStartAnchorState(labelOpacity = 1) {
    const { exhibitionsStartX } = getTokenTargets();
    const top = labelTopForTokenCenter(yFromTimelineBaseline());
    gsap.set(labelEl, { top, opacity: labelOpacity });
    gsap.set(exhibitionsEl, { x: exhibitionsStartX, opacity: 1 });
    gsap.set(fadeInEls, { opacity: 0 });
  }

  function syncExhibitionsLabelToScrollPosition() {
    if (stSankey?.isActive) {
      applyProgress(stSankey.progress);
    } else if (stStart?.isActive) {
      setStartAnchorState(gsap.utils.clamp(0, 1, stStart.progress / 0.25));
    } else {
      applyProgress(0);
    }
  }

  let stStart = null;
  let stSankey = null;

  stStart = ScrollTrigger.create({
    id: "exhibitions-bridge-start",
    invalidateOnRefresh: true,
    trigger: startAnchorEl,
    start: "top bottom",
    endTrigger: sankeySectionEl,
    end: `top bottom-=${EXHIBITIONS_SCROLL_CONFIG.timelineToSankey.startNearBottomPx}`,
    onUpdate: (self) => setStartAnchorState(gsap.utils.clamp(0, 1, self.progress / 0.25)),
    onEnter: () => setStartAnchorState(0),
    onEnterBack: () => setStartAnchorState(1),
    onLeaveBack: () => gsap.set(labelEl, { opacity: 0 }),
  });

  stSankey = ScrollTrigger.create({
    id: "exhibitions-bridge-sankey",
    invalidateOnRefresh: true,
    trigger: sankeySectionEl,
    start: `top bottom-=${EXHIBITIONS_SCROLL_CONFIG.timelineToSankey.startNearBottomPx}`,
    endTrigger: sankeySectionEl,
    end: "bottom top",
    onUpdate: (self) => applyProgress(self.progress),
    onLeave: () => gsap.set(labelEl, { opacity: 0 }),
    onLeaveBack: () => setStartAnchorState(),
    onEnter: () => applyProgress(0),
    onEnterBack: () => applyProgress(1),
  });

  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    syncExhibitionsLabelToScrollPosition();
  });
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function centerFromRect(rect, rootRect) {
  return {
    x: rect.left + rect.width / 2 - rootRect.left,
    y: rect.top + rect.height / 2 - rootRect.top,
  };
}

function rectInRootSpace(rect, rootRect) {
  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function setupTimelineToSankeyExhibitionTravel({ timelineSectionEl, sankeySectionEl }) {
  if (!timelineSectionEl || !sankeySectionEl) return;

  const GROUP_STAGGER_STEP = 0.008;
  const GROUP_STAGGER_MAX = 0.045;
  const TRAVEL_PROGRESS_SPAN = 0.5;
  const SOURCE_HIDE_PROGRESS = 0.05;
  const SANKEY_REVEAL_PROGRESS = 0.5;
  const contentEl = document.querySelector(SMOOTH_CONTENT_ID);
  if (!contentEl) return;

  const overlayEl = document.createElement("div");
  overlayEl.className = "timeline-sankey-travel-overlay";
  contentEl.appendChild(overlayEl);

  let pairs = [];
  let sourceNodes = [];
  let targetNodes = [];
  let latestProgress = 0;
  let timelineObserver = null;
  let sankeyObserver = null;

  function setNodesOpacity(nodes, opacity) {
    nodes.forEach((node) => {
      node.style.opacity = opacity;
    });
  }

  function clearOverlayRects() {
    overlayEl.replaceChildren();
    pairs = [];
  }

  function resetOriginalRects() {
    setNodesOpacity(sourceNodes, "");
    setNodesOpacity(targetNodes, "");
  }

  function collectPairs() {
    const contentRect = contentEl.getBoundingClientRect();
    sourceNodes = [
      ...timelineSectionEl.querySelectorAll(".exhibition-marker[data-exhibition-id]"),
    ];
    targetNodes = [...sankeySectionEl.querySelectorAll("rect.sankey-node-mark[data-exhibition-id]")];
    if (!sourceNodes.length || !targetNodes.length) return [];

    const sourceById = new Map();
    sourceNodes.forEach((node) => {
      const exhibitionId = node.dataset.exhibitionId;
      if (!exhibitionId || sourceById.has(exhibitionId)) return;
      sourceById.set(exhibitionId, node);
    });

    const out = [];
    targetNodes.forEach((targetNode, index) => {
      const exhibitionId = targetNode.dataset.exhibitionId;
      const sourceNode = exhibitionId ? sourceById.get(exhibitionId) : null;
      if (!sourceNode) return;

      const sourceRect = rectInRootSpace(sourceNode.getBoundingClientRect(), contentRect);
      const targetRect = rectInRootSpace(targetNode.getBoundingClientRect(), contentRect);

      const proxyRectEl = document.createElement("div");
      proxyRectEl.className = "timeline-sankey-travel-rect";
      proxyRectEl.style.width = `${sourceRect.width}px`;
      proxyRectEl.style.height = `${sourceRect.height}px`;
      proxyRectEl.style.borderRadius = `${EXHIBITIONS_VIZ_CONFIG.layout.nodeRadiusPx}px`;
      overlayEl.appendChild(proxyRectEl);

      const delay = Math.min(index * GROUP_STAGGER_STEP, GROUP_STAGGER_MAX);
      out.push({
        sourceRect,
        targetRect,
        delay,
        proxyRectEl,
      });
    });

    return out;
  }

  function applyProgress(progress) {
    const p = clamp01(progress);
    if (!pairs.length) {
      resetOriginalRects();
      return;
    }

    const sourceOpacity = p <= SOURCE_HIDE_PROGRESS ? "1" : "0";
    sourceNodes.forEach((node) => { node.style.opacity = sourceOpacity; });
    targetNodes.forEach((node) => {
      node.style.opacity = p >= SANKEY_REVEAL_PROGRESS ? "1" : "0";
    });

    pairs.forEach((pair) => {
      const localProgress = clamp01((p - pair.delay) / TRAVEL_PROGRESS_SPAN);
      const x = pair.sourceRect.x + (pair.targetRect.x - pair.sourceRect.x) * localProgress;
      const y = pair.sourceRect.y + (pair.targetRect.y - pair.sourceRect.y) * localProgress;
      const width = pair.sourceRect.width + (pair.targetRect.width - pair.sourceRect.width) * localProgress;
      const height = pair.sourceRect.height + (pair.targetRect.height - pair.sourceRect.height) * localProgress;
      pair.proxyRectEl.style.transform = `translate(${x}px, ${y}px)`;
      pair.proxyRectEl.style.width = `${width}px`;
      pair.proxyRectEl.style.height = `${height}px`;
      pair.proxyRectEl.style.opacity = localProgress > 0 && localProgress < 1 ? "1" : "0";
    });
  }

  function rebuild(progress = 0) {
    clearOverlayRects();
    resetOriginalRects();
    pairs = collectPairs();
    applyProgress(progress);
  }

  function cleanup() {
    clearOverlayRects();
    resetOriginalRects();
    timelineObserver?.disconnect();
    sankeyObserver?.disconnect();
    timelineObserver = null;
    sankeyObserver = null;
  }

  function observeSection(sectionEl, observerRefSetter) {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => rebuild(latestProgress));
    });
    observer.observe(sectionEl, {
      subtree: true,
      childList: true,
    });
    observerRefSetter(observer);
  }

  function setupSectionMutationObservers() {
    if (!timelineObserver) {
      observeSection(timelineSectionEl, (observer) => {
        timelineObserver = observer;
      });
    }
    if (!sankeyObserver) {
      observeSection(sankeySectionEl, (observer) => {
        sankeyObserver = observer;
      });
    }
  }

  ScrollTrigger.create({
    trigger: sankeySectionEl,
    start: `top bottom-=${EXHIBITIONS_SCROLL_CONFIG.timelineToSankey.startNearBottomPx}`,
    endTrigger: sankeySectionEl,
    end: "top top",
    scrub: 1,
    onEnter: () => {
      latestProgress = 0;
      rebuild(0);
      setupSectionMutationObservers();
    },
    onEnterBack: () => {
      latestProgress = 1;
      rebuild(1);
      setupSectionMutationObservers();
    },
    onUpdate: (self) => {
      latestProgress = self.progress;
      applyProgress(self.progress);
    },
    onRefresh: (self) => {
      latestProgress = self.progress;
      rebuild(self.progress);
      setupSectionMutationObservers();
    },
    onLeave: () => cleanup(),
    onLeaveBack: () => cleanup(),
    onKill: () => cleanup(),
  });
}

function setupSankeyToClusterDotTravel({ sankeySectionEl, clusterSectionEl }) {
  if (!sankeySectionEl || !clusterSectionEl) return;

  const GROUP_STAGGER_STEP = 0.03;
  const GROUP_STAGGER_MAX = 0.24;
  const TRAVEL_PROGRESS_SPAN = 0.7;
  const LANDING_REVEAL_PROGRESS = 0.68;
  const contentEl = document.querySelector(SMOOTH_CONTENT_ID);
  if (!contentEl) return;
  const overlayEl = document.createElement("div");
  overlayEl.className = "sankey-cluster-travel-overlay";
  contentEl.appendChild(overlayEl);

  let pairs = [];
  let sourceNodes = [];
  let targetNodes = [];
  let latestProgress = 0;
  let observer = null;

  function setClusterLayerHidden(hidden) {
    clusterSectionEl.classList.toggle("cluster-travel-active", hidden);
  }

  function clearOverlayDots() {
    overlayEl.replaceChildren();
    pairs = [];
  }

  function resetOriginalDots() {
    sourceNodes.forEach((node) => { node.style.opacity = ""; });
    targetNodes.forEach((node) => { node.style.opacity = ""; });
    setClusterLayerHidden(false);
  }

  function getGroupIndexByClusterId(nodes) {
    const clusterIdSet = new Set();
    nodes.forEach((node) => {
      const pointId = node.dataset.pointId ?? "";
      const clusterId = pointId.split("-")[0];
      if (clusterId !== "") clusterIdSet.add(clusterId);
    });
    return new Map(
      [...clusterIdSet]
        .sort((a, b) => Number(a) - Number(b))
        .map((clusterId, index) => [clusterId, index]),
    );
  }

  function collectPairs() {
    const contentRect = contentEl.getBoundingClientRect();
    sourceNodes = [...sankeySectionEl.querySelectorAll("[data-artist-id]")];
    targetNodes = [...clusterSectionEl.querySelectorAll(".cs-point[data-artist-id]")];
    if (!sourceNodes.length || !targetNodes.length) return [];

    const sourceByArtistId = new Map();
    sourceNodes.forEach((node) => {
      const artistId = node.dataset.artistId;
      if (!artistId || sourceByArtistId.has(artistId)) return;
      sourceByArtistId.set(artistId, node);
    });

    const groupIndexByClusterId = getGroupIndexByClusterId(targetNodes);
    const out = [];
    targetNodes.forEach((targetNode) => {
      const artistId = targetNode.dataset.artistId;
      const sourceNode = artistId ? sourceByArtistId.get(artistId) : null;
      if (!sourceNode) return;

      const sourceCenter = centerFromRect(sourceNode.getBoundingClientRect(), contentRect);
      const targetCenter = centerFromRect(targetNode.getBoundingClientRect(), contentRect);
      const clusterId = (targetNode.dataset.pointId ?? "").split("-")[0];
      const groupIndex = groupIndexByClusterId.get(clusterId) ?? 0;
      const delay = Math.min(groupIndex * GROUP_STAGGER_STEP, GROUP_STAGGER_MAX);

      const proxyDotEl = document.createElement("div");
      proxyDotEl.className = "sankey-cluster-travel-dot";
      proxyDotEl.innerHTML = artistDotInlineSvg(artistId, {
        fill: "#000",
        stroke: "#fff",
        strokeWidth: 1,
      });
      overlayEl.appendChild(proxyDotEl);

      out.push({
        sourceX: sourceCenter.x,
        sourceY: sourceCenter.y,
        targetX: targetCenter.x,
        targetY: targetCenter.y,
        delay,
        proxyDotEl,
      });
    });

    return out;
  }

  function applyProgress(progress) {
    if (isClusterArtModeActive()) {
      clearOverlayDots();
      pairs = [];
      resetOriginalDots();
      return;
    }

    const p = clamp01(progress);
    if (!pairs.length) {
      resetOriginalDots();
      return;
    }

    const hideClusterLayer = p < LANDING_REVEAL_PROGRESS;
    setClusterLayerHidden(hideClusterLayer);

    sourceNodes.forEach((node) => { node.style.opacity = String(1 - p * 0.95); });
    targetNodes.forEach((node) => {
      if (hideClusterLayer) { node.style.opacity = "0"; return; }
      const revealP = clamp01((p - LANDING_REVEAL_PROGRESS) / (1 - LANDING_REVEAL_PROGRESS));
      node.style.opacity = String(revealP);
    });

    pairs.forEach((pair) => {
      const localProgress = clamp01((p - pair.delay) / TRAVEL_PROGRESS_SPAN);
      const x = pair.sourceX + (pair.targetX - pair.sourceX) * localProgress;
      const y = pair.sourceY + (pair.targetY - pair.sourceY) * localProgress;
      pair.proxyDotEl.style.transform = `translate(${x}px, ${y}px)`;
      pair.proxyDotEl.style.opacity = localProgress <= 0 ? "0" : "1";
    });
  }

  function rebuild(progress = 0) {
    clearOverlayDots();
    resetOriginalDots();
    if (isClusterArtModeActive()) {
      pairs = [];
      applyProgress(progress);
      return;
    }
    pairs = collectPairs();
    applyProgress(progress);
  }

  function cleanup() {
    clearOverlayDots();
    resetOriginalDots();
    observer?.disconnect();
    observer = null;
  }

  function setupClusterMutationObserver() {
    if (observer || !clusterSectionEl) return;
    observer = new MutationObserver(() => {
      requestAnimationFrame(() => rebuild(latestProgress));
    });
    observer.observe(clusterSectionEl, {
      subtree: true,
      childList: true,
    });
  }

  ScrollTrigger.create({
    trigger: sankeySectionEl,
    start: "bottom bottom",
    endTrigger: clusterSectionEl,
    end: "top top",
    scrub: 1,
    onEnter: () => {
      latestProgress = 0;
      rebuild(0);
      setupClusterMutationObserver();
    },
    onEnterBack: () => {
      latestProgress = 1;
      rebuild(1);
      setupClusterMutationObserver();
    },
    onUpdate: (self) => {
      latestProgress = self.progress;
      applyProgress(self.progress);
    },
    onRefresh: (self) => {
      latestProgress = self.progress;
      rebuild(self.progress);
      setupClusterMutationObserver();
    },
    onLeave: () => cleanup(),
    onLeaveBack: () => cleanup(),
    onKill: () => cleanup(),
  });
}

export function initAppScrollAnimations({
  section2El,
  actorsSectionEl,
  section3El,
  sectionAfterS3El,
  floatingPersonaEl,
  section3PersonaImg,
  exhibitionsLabelEl,
  exhibitionsAnchorStartEl,
  exhibitionsAnchorEndRef,
  sankeySectionEl,
  clusterSectionEl,
}) {
  if (!section2El) return null;

  const personaIcon = actorsSectionEl?.querySelector(
    '[data-actor="persona"] .actors-preview__icon',
  );

  const personaPos = measurePersonaPositions(
    actorsSectionEl,
    section3El,
    personaIcon,
    section3PersonaImg,
  );

  const smoother = ScrollSmoother.create({
    wrapper: SMOOTH_WRAPPER_ID,
    content: SMOOTH_CONTENT_ID,
    smooth: 1.5,
    effects: true,
  });

  setupIdentitySectionTimeline(section2El);

  if (actorsSectionEl && section3El && sectionAfterS3El) {
    if (personaPos && floatingPersonaEl && section3PersonaImg) {
      setupActorsToPersonaGrow({
        actorsEl: actorsSectionEl,
        s3El: section3El,
        sectionAfterS3El,
        floatingEl: floatingPersonaEl,
        s3PersonaImg: section3PersonaImg,
        personaPos,
      });
    } else {
      setupSection3PinCoverFallback(section3El, sectionAfterS3El);
    }
  }

  setupExhibitionsLabel({
    labelEl: exhibitionsLabelEl,
    startAnchorEl: exhibitionsAnchorStartEl,
    endAnchorEl: exhibitionsAnchorEndRef,
    timelineSectionEl: sectionAfterS3El,
    sankeySectionEl,
  });

  setupTimelineToSankeyExhibitionTravel({
    timelineSectionEl: sectionAfterS3El,
    sankeySectionEl,
  });

  setupSankeyToClusterDotTravel({
    sankeySectionEl,
    clusterSectionEl,
  });

  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });

  return smoother;
}

export function destroyAppScrollAnimations(smoother) {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  smoother?.kill();
}
