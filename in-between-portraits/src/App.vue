<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  artistClustersMap,
  institutionClustersMap,
  exhibitionClustersMap,
} from "./data/index.js";
import ClusterSection from "./components/ClusterSection/index.vue";
import ClusterView from "./components/ClusterView/index.vue";
import PageSection from "./components/PageSection/index.vue";
import IdentityStatesPreview from "./components/IdentityStatesPreview/index.vue";
import ActorsPreview from "./components/ActorsPreview/index.vue";
import ArtistDot from "./components/ArtistDot/index.vue";
import ExhibitionsSankey from "./components/ExhibitionsSankey/index.vue";
import ExhibitionsTimeline from "./components/ExhibitionsTimeline/index.vue";
import InfoModal from "./components/InfoModal/index.vue";
import { publicImgSrc } from "./utils/public-img-src.js";
import {
  destroyAppScrollAnimations,
  initAppScrollAnimations,
} from "./utils/scroll-app-animations.js";
import { REPRESENTATIVE_PERSONA_ARTIST_ID } from "./constants.js";
import { EXHIBITIONS_INNER_MARGIN_X_PX } from "./constants/exhibitions-viz.js";

const expandedCluster = ref(null);
const expandedClusterGroupBy = ref(null);
const introPreviewVideoSrc = "https://github.com/mnav0/thesis/releases/download/assets/gallery-preview.mov";
const shellReady = ref(false);
const introPreviewVideoRef = ref(null);
const introFadeToWhiteActive = ref(false);
const INTRO_END_FADE_SECONDS = 2.4;
const INTRO_WHITE_HOLD_MS = 180;
const artistSelectionPoints = [
  "An initial dataset of exhibitions was curated from modern and contemporary shows about identity.",
  "From the list of the top 100 most visited art museums in the world in 2025, those with open access digital archives were selected.",
  "Artists who also fit the case study criteria and have work catalogued within these museums and exhibitions make up the final dataset.",
];

const section2HeadingHtml = [
  "Identity is",
  '<span class="identity-heading__descriptors">',
  '<i class="identity-heading__descriptor" data-descriptor="descriptor1">collective</i>',
  '<i class="identity-heading__descriptor" data-descriptor="descriptor2">multifaceted</i>',
  '<i class="identity-heading__descriptor" data-descriptor="descriptor3">ever-changing</i>',
  "</span>",
].join("");

const section2Ref = ref(null);
const actorsRef = ref(null);
const section3Ref = ref(null);
const timelineRef = ref(null);
const sankeyRef = ref(null);
const clustersRef = ref(null);
const exhibitionsLabelRef = ref(null);
const exhibitionsAnchorStartRef = ref(null);
const exhibitionsAnchorEndRef = ref(null);
const section3PersonaRef = ref(null);
const floatingPersonaRef = ref(null);

let smoother = null;
let introWhiteHoldTimeoutId = null;

function openClusterFromEmbedding(cluster) {
  expandedCluster.value = cluster;
  expandedClusterGroupBy.value = "embedding";
}

function closeClusterView() {
  expandedCluster.value = null;
  expandedClusterGroupBy.value = null;
}

function getSectionEl(compRef) {
  return compRef.value?.sectionEl ?? compRef.value?.$el;
}

function pauseIntroPreviewVideo() {
  introPreviewVideoRef.value?.pause();
}

function playIntroPreviewVideo() {
  introPreviewVideoRef.value?.play().catch(() => {
    // Ignore autoplay resume failures caused by browser policies.
  });
}

function updateIntroWhiteFade() {
  const video = introPreviewVideoRef.value;
  if (!video || !Number.isFinite(video.duration)) return;
  introFadeToWhiteActive.value = video.duration - video.currentTime <= INTRO_END_FADE_SECONDS;
}

function onIntroPreviewEnded() {
  const video = introPreviewVideoRef.value;
  if (!video) return;

  introFadeToWhiteActive.value = true;
  video.currentTime = 0;
  playIntroPreviewVideo();
  if (introWhiteHoldTimeoutId !== null) {
    window.clearTimeout(introWhiteHoldTimeoutId);
  }
  introWhiteHoldTimeoutId = window.setTimeout(() => {
    introFadeToWhiteActive.value = false;
    introWhiteHoldTimeoutId = null;
  }, INTRO_WHITE_HOLD_MS);
}

onMounted(() => {
  const fontWait =
    typeof document !== "undefined" && document.fonts?.ready
      ? document.fonts.ready
      : Promise.resolve();
  Promise.race([fontWait, new Promise((r) => setTimeout(r, 500))]).then(() => {
    shellReady.value = true;
    nextTick(() => {
      requestAnimationFrame(() => {
        smoother = initAppScrollAnimations({
          section2El: getSectionEl(section2Ref),
          actorsSectionEl: getSectionEl(actorsRef),
          section3El: getSectionEl(section3Ref),
          sectionAfterS3El: getSectionEl(timelineRef),
          floatingPersonaEl: floatingPersonaRef.value,
          section3PersonaImg: section3PersonaRef.value,
          exhibitionsLabelEl: exhibitionsLabelRef.value,
          exhibitionsAnchorStartEl: exhibitionsAnchorStartRef.value,
          exhibitionsAnchorEndRef: exhibitionsAnchorEndRef.value,
          sankeySectionEl: getSectionEl(sankeyRef),
          clusterSectionEl: getSectionEl(clustersRef),
        });
      });
    });
  });
});

onBeforeUnmount(() => {
  if (introWhiteHoldTimeoutId !== null) {
    window.clearTimeout(introWhiteHoldTimeoutId);
    introWhiteHoldTimeoutId = null;
  }
  destroyAppScrollAnimations(smoother);
});
</script>

<template>
  <div id="smooth-wrapper">
    <div id="smooth-content">
      <main class="app-shell w-full" :class="{ 'app-shell--ready': shellReady }">
        <PageSection class="intro-section" tone="light" layout="stacked" stacked-full-width>
          <div class="intro-section__grid grid min-h-[100svh] grid-cols-12 gap-x-2 md:gap-x-4">
            <div
              class="intro-section__media-layer"
              @mouseenter="pauseIntroPreviewVideo"
              @mouseleave="playIntroPreviewVideo"
            >
              <video
                ref="introPreviewVideoRef"
                class="intro-section__collage"
                :class="{ 'intro-section__collage--fading': introFadeToWhiteActive }"
                muted
                autoplay
                playsinline
                preload="auto"
                aria-hidden="true"
                @timeupdate="updateIntroWhiteFade"
                @ended="onIntroPreviewEnded"
              >
                <source :src="introPreviewVideoSrc" type="video/mp4" />
              </video>
            </div>
            <div
              class="intro-section__title-wrap col-span-12 mb-8 flex items-end justify-end py-8 lg:col-span-5 lg:col-start-8 sm:col-span-12 sm:col-start-2"
            >
              <div class="intro-section__title-card">
                <h1 class="mb-8"><i>In Between</i> Portraits</h1>
                <p class="mb-8">
                  The matter of persona in constructing an artist's public identity
                </p>
                <p>c. 2026</p>
              </div>
            </div>
          </div>
        </PageSection>

        <!-- Section 2 ─ Identity states -->
        <PageSection
          ref="section2Ref"
          class="section-full-width"
          tone="dark"
          layout="split"
          :heading-html="section2HeadingHtml"
        >
          <IdentityStatesPreview />
        </PageSection>

        <!-- Actors -->
        <PageSection
          ref="actorsRef"
          class="section-full-width"
          tone="light"
          layout="stacked"
          texture-preset="rightSoft"
          heading="Making art provides a way to <i>process</i>, <i>define</i>, and <i>express</i> complex identities."
        >
          <ActorsPreview :persona-artist-id="REPRESENTATIVE_PERSONA_ARTIST_ID" />
        </PageSection>

        <!-- Persona -->
        <PageSection
          ref="section3Ref"
          class="section-full-width"
          tone="light"
          layout="split"
          texture-preset="leftDual"
        >
          <div
            class="grid h-full grid-cols-12 content-between gap-x-2 gap-y-8 md:grid-rows-[auto_1fr_auto] md:gap-x-4"
          >
            <h2 class="col-span-12 m-0 md:col-span-5">
              What makes up a persona...*
            </h2>
            <div class="hidden md:block md:col-span-2" aria-hidden="true"></div>
            <div class="col-span-12 flex justify-center md:col-span-5 md:justify-end">
              <div
                ref="section3PersonaRef"
                class="aspect-square w-full max-w-[28rem] self-center opacity-0"
                role="presentation"
              >
                <ArtistDot :artist-id="REPRESENTATIVE_PERSONA_ARTIST_ID" />
              </div>
            </div>
            <p class="col-span-12 md:row-start-3 md:self-end">
              *A representation of artist identity constructed from texts that
              contextualize their work.
            </p>
          </div>
        </PageSection>

        <!-- Exhibition section -->
        <PageSection
          ref="timelineRef"
          class="section-full-width"
          tone="dark"
          layout="stacked"
          stacked-full-width
          stacked-narrow-heading
          heading="for artists selected from modern exhibitions about identity?"
          subheading="*with a case study of mixed-race, Asian American identifying artists."
        >
          <template #subheading-addon>
            <InfoModal
              heading="More about the artist selection process"
              :bullet-points="artistSelectionPoints"
              triggerTitle="More about the artist selection process"
              list-type="numbered"
              aria-label="Open artist selection information modal"
              class="app-exhibitions-info-button"
            />
          </template>
          <ExhibitionsTimeline class="mt-12" />
          <div ref="exhibitionsAnchorStartRef" class="exhibitions-bridge-anchor" aria-hidden="true"></div>
        </PageSection>

        <!-- Sankey section -->
        <PageSection
          ref="sankeyRef"
          class="section-full-width"
          tone="dark"
          layout="stacked"
          stacked-full-width
        >
          <div ref="exhibitionsAnchorEndRef" class="exhibitions-bridge-anchor mb-4" aria-hidden="true"></div>
          <ExhibitionsSankey />
        </PageSection>

        <!-- Text-embedding cluster visualization -->
        <PageSection
          ref="clustersRef"
          tone="light"
          layout="stacked"
          stacked-full-width
          stacked-fill-height
        >
          <ClusterSection
            :exhibitions="exhibitionClustersMap"
            :artist-data="artistClustersMap"
            :institution-data="institutionClustersMap"
            initial-view-mode="exhibitions"
            @select-point="openClusterFromEmbedding"
            @select-cluster="openClusterFromEmbedding"
          />
        </PageSection>
      </main>
    </div>
  </div>

  <div ref="floatingPersonaRef" class="floating-persona">
    <ArtistDot :artist-id="REPRESENTATIVE_PERSONA_ARTIST_ID" />
  </div>

  <div ref="exhibitionsLabelRef" class="exhibitions-bridge-label">
    <div class="mx-auto w-full px-4 md:px-8">
      <div class="grid grid-cols-12 gap-x-2 md:gap-x-4">
        <div class="col-span-12">
          <div
            class="exhibitions-bridge-label__track"
            :style="{ '--exhibitions-inner-margin-x': `${EXHIBITIONS_INNER_MARGIN_X_PX}px` }"
          >
            <span
              class="label-text exhibitions-bridge-label__token exhibitions-bridge-label__token--exhibitions"
            >
              Exhibitions
            </span>
            <span
              class="label-text exhibitions-bridge-label__token exhibitions-bridge-label__token--artists"
            >
              artists
            </span>
            <span
              class="label-text exhibitions-bridge-label__token exhibitions-bridge-label__token--institutions"
            >
              institutions
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="expandedCluster"
    class="cluster-view-backdrop"
    aria-hidden="true"
    @click="closeClusterView"
  />
  <ClusterView
    v-if="expandedCluster"
    :cluster="expandedCluster"
    :groupBy="expandedClusterGroupBy"
    @close="closeClusterView"
  />
</template>
