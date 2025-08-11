// ==UserScript==
// @name         Twitter DeCensor 
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  where my tweets at
// @icon         https://barachlo.szprink.xyz/fiIAlnosGV5w.png
// @match        https://twitter.com/*
// @match        https://x.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const pageCode = `
    (function() {
        console.log("[DeCensor] Injected into page context");

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
            this._url = url;

            this.addEventListener('readystatechange', () => {
                if (this.readyState === 4 && this.responseType === '' && this.responseText) {
                    try {
                        let json = JSON.parse(this.responseText);
                        recursiveClean(json);
                        const patched = JSON.stringify(json);

                        Object.defineProperty(this, 'responseText', { value: patched });
                        Object.defineProperty(this, 'response', { value: patched });

                        console.log(\`[XHR PATCHED] \${this._url}\`);
                    } catch (e) {
                        // ignore non-JSON
                    }
                }
            });
            return realXHROpen.apply(this, arguments);
        };

        // -------- Hook fetch --------
        const realFetch = window.fetch;
        window.fetch = async function(resource, init) {
            const response = await realFetch(resource, init);

            if (typeof resource === 'string' && resource.includes('/i/api/graphql/')) {
                try {
                    const cloned = response.clone();
                    const data = await cloned.json();

                    recursiveClean(data);

                    const patchedBody = JSON.stringify(data);
                    return new Response(patchedBody, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    });
                } catch (e) {
                    return response;
                }
            } else {
                return response;
            }
        };
    })();
    `;

    // Inject into page context via Blob URL (CSP-safe)
    const blob = new Blob([pageCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement('script');
    script.src = url;
    document.documentElement.appendChild(script);
    script.remove();
})();
