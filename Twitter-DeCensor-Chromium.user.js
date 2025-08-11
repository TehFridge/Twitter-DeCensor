// ==UserScript==
// @name         Twitter DeCensor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  where my tweets at.
// @icon         https://barachlo.szprink.xyz/fiIAlnosGV5w.png
// @match        https://twitter.com/*
// @match        https://x.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Helper to recursively remove mediaVisibilityResults key
    function recursiveClean(obj) {
        if (obj && typeof obj === "object") {
            if ("mediaVisibilityResults" in obj) {
                console.log("[PATCH] Removing mediaVisibilityResults from:", obj);
                delete obj.mediaVisibilityResults;
            }
            for (const key in obj) {
                recursiveClean(obj[key]);
            }
        }
    }

    // -------- Hook XHR --------

    const realXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url; // store URL for logging

        this.addEventListener('readystatechange', () => {
            if (this.readyState === 4 && this.responseType === '' && this.responseText) {
                try {
                    // Try parse JSON
                    let json = JSON.parse(this.responseText);
                    recursiveClean(json);
                    const patched = JSON.stringify(json);

                    // Override responseText and response with patched version
                    Object.defineProperty(this, 'responseText', { writable: true });
                    Object.defineProperty(this, 'response', { writable: true });
                    this.responseText = this.response = patched;

                    console.log(`[XHR PATCHED] ${this._url}`);

                } catch (e) {
                    // Not JSON, ignore
                }
            }
        });
        return realXHROpen.apply(this, arguments);
    };

    // -------- Hook fetch --------

    const realFetch = window.fetch;
    window.fetch = async function(resource, init) {
        const response = await realFetch(resource, init);

        // Only patch Twitter API graphql calls
        if (typeof resource === 'string' && resource.includes('/i/api/graphql/')) {
            try {
                const cloned = response.clone();
                const data = await cloned.json();

                recursiveClean(data);

                const patchedBody = JSON.stringify(data);

                // Return a new Response with patched body, preserving original headers/status
                return new Response(patchedBody, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            } catch (e) {
                // JSON parse failed, fallback to original response
                return response;
            }
        } else {
            return response;
        }
    };
})();
