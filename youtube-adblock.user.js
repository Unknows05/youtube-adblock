// ==UserScript==
// @name         Efficient YouTube Adblock (Hybrid Style)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  A refined adblock script combining RAT efficiency with BSA coverage, focusing on stability and reduced UI errors.
// @author       Assistant (Hybrid Approach)
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // --- CONFIGURATION ---
    const CONFIG = {
        debug: false,
        // Use RAT-style core logic for video ads (skip/speed mute)
        enableCoreAdHandling: true,
        // Use CSS injection for broader UI ad hiding (inspired by BSA, but simplified)
        enableBroadUIHiding: true,
        // Track user interaction to prevent autoplay bugs (inspired by BSA)
        enableUserInteractionTracking: true,
        // Interval for core ad check (should match RAT's speed)
        coreAdCheckInterval: 50, // ms
        // Interval for UI cleanup (less frequent than core check)
        uiCleanupInterval: 1000, // ms
        // Timeout for considering a user pause as intentional
        userPauseTimeoutMs: 5000
    };

    // --- STATE MANAGEMENT ---
    const state = {
        // Core ad state (like RAT)
        isAdCurrentlyPlaying: false,
        adLoopCounter: 0,
        originalVideoPlaybackRate: 1,
        userPausedAt: 0, // Timestamp
        // UI state
        initialUrl: window.location.href,
        // For realistic interaction simulation (like RAT)
        clickEvent: new PointerEvent('click', {
            bubbles: true, cancelable: true, view: window,
            button: 0, buttons: 1, detail: 1,
            // Add randomness to coordinates like the original RAT
            clientX: 0, clientY: 0, screenX: 0, screenY: 0,
            // Keep other props constant as in RAT
            pointerId: 1, pointerType: 'mouse', isPrimary: true,
            ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
            width: 1, height: 1, pressure: 0.5, tiltX: 0, tiltY: 0
        }),
        // Video reference
        videoElement: null
    };

    // --- HELPER FUNCTIONS ---
    function log(message, level = 'info') {
        if (!CONFIG.debug) return;
        const prefix = '🛡️ [Efficient Adblock]';
        const styles = {
            info: 'color: #2196F3; font-weight: bold;',
            warn: 'color: #FF9800; font-weight: bold;',
            error: 'color: #F44336; font-weight: bold;',
        };
        const style = styles[level] || styles.info;
        console.log(`%c${prefix}%c ${message}`, style, '');
    }

    function getVideoElement() {
        return document.querySelector('video');
    }

    function updateVideoReference() {
        const video = getVideoElement();
        if (video && video !== state.videoElement) {
            state.videoElement = video;
            log('Video element updated.');
        }
        return state.videoElement;
    }

    // --- CORE AD HANDLING (Inspired by RAT v5.0) ---
    function setupCoreAdHandling() {
        if (!CONFIG.enableCoreAdHandling) {
            log('Core ad handling disabled by config.', 'warn');
            return;
        }

        log('Initializing core ad handling (RAT-style)...');

        setInterval(() => {
            const video = updateVideoReference();
            if (!video) {
                // log('No video element found, skipping ad check.', 'warn');
                return;
            }

            const adElement = document.querySelector('.ad-showing');
            const isAdPlaying = !!adElement;

            if (isAdPlaying && !state.isAdCurrentlyPlaying) {
                // --- AD STARTED ---
                log('Ad detected (Core Handler).');
                state.isAdCurrentlyPlaying = true;
                state.adLoopCounter = 0; // Reset counter when new ad starts

                // Mute audio immediately
                video.muted = true;

            } else if (!isAdPlaying && state.isAdCurrentlyPlaying) {
                // --- AD ENDED ---
                log('Ad finished (Core Handler).');
                state.isAdCurrentlyPlaying = false;
                state.adLoopCounter = 0; // Reset counter when ad ends

                // Restore audio
                video.muted = false;
                // Restore original playback rate if it was changed by an ad attempt
                if (video.playbackRate === 10) { // Assuming 10x was used for skipping
                    video.playbackRate = state.originalVideoPlaybackRate;
                }
            }

            if (state.isAdCurrentlyPlaying) {
                state.adLoopCounter++;
                // Attempt to skip the ad
                attemptSkipCurrentAd(video);
            } else {
                 // Store the original playback rate when not in an ad
                if (isFinite(video.playbackRate) && video.playbackRate !== 10) {
                    state.originalVideoPlaybackRate = video.playbackRate;
                }
            }

        }, CONFIG.coreAdCheckInterval);
    }

    function attemptSkipCurrentAd(video) {
        // 1. Try clicking skip buttons (like RAT)
        const skipSelectors = [
            '#ytp-ad-skip-button-container',
            '#ytp-ad-skip-button-modern',
            '.videoAdUiSkipButton',
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-ad-skip-button-slot'
        ];
        for (const selector of skipSelectors) {
            const button = document.querySelector(selector);
            if (button && !button.disabled) {
                log(`Clicking skip button: ${selector}`);
                button.dispatchEvent(state.clickEvent);
                // Optional: Break after first click attempt if desired
                // break;
            }
        }

        // 2. Force skip to end (core RAT technique)
        if (video && isFinite(video.duration) && video.duration > 0) {
            const randomOffset = Math.random() * (0.5 - 0.1) + 0.1;
            try {
                video.currentTime = video.duration + randomOffset;
                log(`Force skipped ad (currentTime = ${video.currentTime}).`);
            } catch (e) {
                log(`Error force skipping: ${e.message}`, 'error');
            }
        }

        // 3. Ensure video plays after skip attempt
        if (video.paused) {
            video.play().catch(() => { /* Ignore play errors */ });
        }
    }


    // --- USER INTERACTION TRACKING (Refined BSA-style) ---
    function setupUserInteractionTracking() {
        if (!CONFIG.enableUserInteractionTracking) {
            log('User interaction tracking disabled by config.', 'warn');
            return;
        }

        log('Initializing user interaction tracking...');

        // Listen for spacebar press (common play/pause toggle)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault(); // Prevent default space scroll if needed
                const video = getVideoElement();
                if (video) {
                    state.userPausedAt = Date.now();
                    log(`User interaction: Space pressed. Video paused: ${video.paused}`);
                    // No need to manually pause/play, just record the time.
                }
            }
        }, true); // Use capture phase

        // Listen for clicks on player controls area (play/pause button area)
        const playerContainerSelector = '.html5-video-player, .ytp-chrome-bottom'; // Common areas
        document.addEventListener('click', (e) => {
            const playerContainer = document.querySelector(playerContainerSelector);
            if (playerContainer && playerContainer.contains(e.target)) {
                const video = getVideoElement();
                if (video) {
                    state.userPausedAt = Date.now();
                    log(`User interaction: Click on player area. Video paused: ${video.paused}`);
                }
            }
        }, true); // Use capture phase
    }

    // --- SMART AUTO-PLAY PREVENTION ---
    function setupSmartAutoplayControl() {
        // This runs alongside the core ad handler
        setInterval(() => {
            const video = state.videoElement;
            if (!video || !state.isAdCurrentlyPlaying) {
                // Only intervene if video is paused, an ad *was* playing, and user didn't pause recently
                if (video && video.paused && !state.isAdCurrentlyPlaying) {
                    const timeSinceUserInteraction = Date.now() - state.userPausedAt;
                    const userPausedRecently = timeSinceUserInteraction < CONFIG.userPauseTimeoutMs;

                    if (!userPausedRecently) {
                        // Likely an anti-adblock or unexpected pause, try to resume
                        log('Smart autoplay: Attempting to resume paused video (not user-initiated).');
                        video.play().catch(() => { /* Ignore play errors */ });
                    } else {
                        log('Smart autoplay: Respecting user pause (paused recently).');
                    }
                }
                return; // Exit if no active ad
            }

            // If an ad IS playing and video is paused, ensure it plays (anti-adblock)
            if (video && video.paused && state.isAdCurrentlyPlaying) {
                 log('Smart autoplay: Ad playing, ensuring video continues.');
                 video.play().catch(() => { /* Ignore play errors */ });
            }
        }, 500); // Check less frequently than core ad loop
    }


    // --- BROAD UI HIDING (Refined BSA-style) ---
    function setupBroadUIHiding() {
        if (!CONFIG.enableBroadUIHiding) {
            log('Broad UI hiding disabled by config.', 'warn');
            return;
        }

        log('Initializing broad UI hiding (refined BSA-style)...');

        // CSS rules for hiding ads (inspired by BSA, but simplified/conservative)
        // Focus on known ad containers, avoid overly generic selectors that might affect menus
        const uiHideRules = `
            /* -- Video Player Overlays/Modules -- */
            .ytp-ad-overlay-container,
            .ytp-ad-module,
            .ytp-ad-image-overlay,
            .ytp-ad-overlay-slot,
            .ytp-ad-preview-container,
            .ytp-ad-action-interstitial,
            .videoAdUi,
            .ytp-ad-loading-spinner,
            .ytp-ad-message-text,
            /* -- Page/Sidebar Ads (Common Renderers) -- */
            ytd-display-ad-renderer,
            ytd-promoted-sparkles-web-renderer,
            ytd-promoted-video-renderer,
            ytd-action-companion-ad-renderer,
            ytd-in-feed-ad-layout-renderer,
            ytd-ad-slot-renderer,
            ytd-banner-promo-renderer,
            ytd-mealbar-promo-renderer,
            ytd-merch-shelf-renderer,
            ytd-player-legacy-desktop-watch-ads-renderer,
            /* -- Search Result Ads -- */
            ytd-search-pyv-renderer,
            ytd-movie-offer-module-renderer,
            /* -- Masthead/Sidebar Banners -- */
            #masthead-ad,
            #player-ads,
            .player-ads,
            ytd-video-masthead-ad-renderer,
            /* -- Specific Ad Data Attributes -- */
            [data-is-sponsored],
            [data-ad-slot],
            ytd-rich-item-renderer[is-ad],
            ytd-video-renderer[is-ad],
            /* -- Anti-Adblock Elements -- */
            ytd-enforcement-message-view-model,
            tp-yt-iron-overlay-backdrop,
            ytd-popup-container tp-yt-paper-dialog,
            /* -- Hide Empty Ad Slots -- */
            ytd-ad-slot-renderer:empty,
            ytd-companion-slot-renderer:empty {
                display: none !important;
            }
            /* -- Layout Fix -- */
            ytd-watch-flexy[flexy][is-two-columns_]:not([fullscreen]) {
                --ytd-watch-flexy-player-width: calc(var(--ytd-watch-flexy-player-width) + var(--ytd-watch-flexy-sidebar-width)) !important;
            }
        `;

        const style = document.createElement('style');
        style.id = 'efficient-adblock-ui-hide';
        style.textContent = uiHideRules;
        document.head.appendChild(style);

        log('CSS rules for UI hiding injected.');

        // Periodic cleanup for elements that might appear dynamically
        setInterval(() => {
            // Target specific elements that might not be caught by CSS alone or appear later
            const elementsToRemove = document.querySelectorAll('ytd-enforcement-message-view-model, tp-yt-iron-overlay-backdrop');
            elementsToRemove.forEach(el => {
                 if (el.isConnected) { // Check if still in DOM
                    el.remove();
                    log('Removed leftover ad/enforcement element.');
                 }
            });

            // Check for URL change and trigger potential layout fixes if needed (though CSS usually suffices)
            if (window.location.href !== state.initialUrl) {
                log('URL changed, potential UI refresh.');
                state.initialUrl = window.location.href;
                // Could add more specific UI refresh logic here if needed
            }
        }, CONFIG.uiCleanupInterval);
    }


    // --- INITIALIZATION ---
    function initialize() {
        log('Starting Efficient YouTube Adblock v1.0.0...');
        log('Config: ' + JSON.stringify(CONFIG));

        // Order matters slightly: Interaction tracking helps core handler
        setupUserInteractionTracking();
        setupCoreAdHandling();
        setupSmartAutoplayControl();
        setupBroadUIHiding(); // Run last to apply CSS after other logic hopefully settles UI

        log('Initialization complete. Adblock active.');
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
