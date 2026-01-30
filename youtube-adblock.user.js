// ==UserScript==
// @name         Brave-Style YouTube Adblock
// @namespace    https://github.com/Unknows05/Brave-StyleYouTubeAdblock
// @version      1.2.3
// @description  Multi-layer adblock mimicking Brave Shields - FIXED AUTO-PLAY BUG
// @author       Unknowns05
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @icon         https://brave.com/static-assets/images/brave-favicon.png
// @grant        none
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/Unknows05/Brave-StyleYouTubeAdblock/main/youtube-adblock.user.js
// @downloadURL  https://raw.githubusercontent.com/Unknows05/Brave-StyleYouTubeAdblock/main/youtube-adblock.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    
    const CONFIG = {
        enableNetworkBlock: true,
        enableDOMFilter: true,
        enableScriptBlock: true,
        enableAntiAdblockBypass: true,
        debug: false
    };

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================
    
    let state = {
        userPaused: false,
        lastUserInteraction: 0,
        isAdShowing: false,
        videoElement: null,
        adSkipAttempted: false
    };

    const USER_INTERACTION_TIMEOUT = 5000;

    // ============================================================
    // LAYER 1: NETWORK-LEVEL BLOCKING
    // ============================================================
    
    function setupNetworkBlocking() {
        if (!CONFIG.enableNetworkBlock) return;

        const AD_DOMAINS = [
            'doubleclick.net',
            'googleadservices.com',
            'adservice.google',
            'pagead2.googlesyndication.com',
            'pubads.g.doubleclick.net',
            'youtube-nocookie.com',
            'imasdk.googleapis.com',
            'static.ads-twitter.com',
            'ads.youtube.com',
            'yt3.ggpht.com',  // Added common ad domain
            'googleleadservices.com'
        ];

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string') {
                const lowerUrl = url.toLowerCase();
                for (const domain of AD_DOMAINS) {
                    if (lowerUrl.includes(domain)) {
                        if (CONFIG.debug) console.log('[ADBLOCK] Blocked XHR:', url);
                        return;
                    }
                }
            }
            return originalOpen.apply(this, arguments);
        };

        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            let url = typeof input === 'string' ? input : input?.url;
            if (url) {
                const lowerUrl = url.toLowerCase();
                for (const domain of AD_DOMAINS) {
                    if (lowerUrl.includes(domain)) {
                        if (CONFIG.debug) console.log('[ADBLOCK] Blocked Fetch:', url);
                        return Promise.resolve(new Response('', { status: 200 }));
                    }
                }
            }
            return originalFetch.apply(this, arguments);
        };

        console.log('[Brave Adblock] Network blocking active');
    }

    // ============================================================
    // LAYER 2: DOM FILTERING
    // ============================================================
    
    function setupDOMFiltering() {
        if (!CONFIG.enableDOMFilter) return;

        const CSS_FILTERS = `
            .ad-showing,
            .ytp-ad-player-overlay,
            .ytp-ad-text-overlay,
            .ytp-ad-module,
            .ytp-ad-overlay-container,
            .ytp-ad-progress-list,
            .ytp-ad-skip-button,
            .ytp-ad-skip-button-modern,
            .videoAdUi,
            ytd-display-ad-renderer,
            ytd-promoted-sparkles-web-renderer,
            ytd-promoted-video-renderer,
            ytd-compact-promoted-video-renderer,
            ytd-in-feed-ad-layout-renderer,
            ytd-ad-slot-renderer,
            ytd-banner-promo-renderer,
            ytd-enforcement-message-view-model,
            tp-yt-iron-overlay-backdrop,
            #masthead-ad,
            #player-ads,
            .ytd-video-masthead-ad-v3-renderer,
            [data-is-sponsored],
            .style-scope.ytd-enforcement-message-view-model {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                height: 0 !important;
                width: 0 !important;
            }
            
            .ytp-ad-loading-spinner {
                display: none !important;
            }
        `;

        const style = document.createElement('style');
        style.id = 'brave-youtube-adblock';
        style.textContent = CSS_FILTERS;
        
        (document.head || document.documentElement).appendChild(style);
        console.log('[Brave Adblock] DOM filtering active');
    }

    // ============================================================
    // LAYER 3: SCRIPT BLOCKING
    // ============================================================
    
    function setupScriptBlocking() {
        if (!CONFIG.enableScriptBlock) return;

        const AD_PATTERNS = /adsbygoogle|google_ad|doubleclick|pubads|ima3\.js|\/ad_/;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'SCRIPT' && node.src) {
                        if (AD_PATTERNS.test(node.src)) {
                            node.remove();
                            if (CONFIG.debug) console.log('[ADBLOCK] Blocked script:', node.src);
                        }
                    }
                });
            });
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
        console.log('[Brave Adblock] Script blocking active');
    }

    // ============================================================
    // USER INTERACTION TRACKING
    // ============================================================
    
    function setupUserInteractionTracking() {
        const updateInteraction = () => {
            state.lastUserInteraction = Date.now();
        };

        document.addEventListener('click', (e) => {
            const video = document.querySelector('video');
            const player = document.querySelector('#movie_player, .html5-video-player');
            
            if (player && player.contains(e.target)) {
                updateInteraction();
                if (video) {
                    state.userPaused = video.paused;
                }
            }
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                updateInteraction();
            }
        }, true);
    }

    // ============================================================
    // ANTI-ADBLOCK BYPASS & AD SKIPPING
    // ============================================================
    
    function setupAntiAdblockBypass() {
        if (!CONFIG.enableAntiAdblockBypass) return;

        setInterval(() => {
            const video = document.querySelector('video');
            if (!video) return;

            // Remove anti-adblock popups
            document.querySelectorAll('ytd-enforcement-message-view-model, tp-yt-iron-overlay-backdrop').forEach(el => {
                el.remove();
            });

            // Auto-click dismiss buttons
            const dismissBtn = document.querySelector('#dismiss-button, [aria-label="Close"]');
            if (dismissBtn) dismissBtn.click();

            // Smart autoplay - only if not user paused
            if (video.paused && !state.userPaused) {
                const timeSinceInteraction = Date.now() - state.lastUserInteraction;
                if (timeSinceInteraction > USER_INTERACTION_TIMEOUT) {
                    video.play().catch(() => {});
                }
            }

        }, 1000);
    }

    function setupSkipButtonAutoClick() {
        setInterval(() => {
            const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
            if (skipBtn && skipBtn.offsetParent !== null) {
                skipBtn.click();
                if (CONFIG.debug) console.log('[ADBLOCK] Auto-skipped ad');
            }
        }, 500);
    }

    function setupAdDetection() {
        setInterval(() => {
            const adOverlay = document.querySelector('.ad-showing, .ytp-ad-player-overlay');
            const video = document.querySelector('video');
            
            if (adOverlay && video) {
                state.isAdShowing = true;
                video.muted = true;
                
                // Fast forward ad
                if (video.duration && isFinite(video.duration)) {
                    video.currentTime = video.duration - 0.1;
                }
            } else if (state.isAdShowing && video) {
                state.isAdShowing = false;
                video.muted = false;
            }
        }, 200);
    }

    // ============================================================
    // MAIN INITIALIZATION
    // ============================================================
    
    function init() {
        console.log('[Brave Adblock] Initializing v1.2.3...');
        
        setupUserInteractionTracking();
        setupNetworkBlocking();
        setupDOMFiltering();
        setupScriptBlocking();
        setupAdDetection();
        setupAntiAdblockBypass();
        setupSkipButtonAutoClick();
        
        console.log('[Brave Adblock] All protections active!');
    }

    // Run immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
