/**
 * This file is used to dynamically load other scripts.
 *
 * It will load the asynchronously scripts first.
 * Once those all finish loading, we can then append all the normal scripts to the document.head.
 *
 * There are many reasons why we may need to load scripts asynchronously. In my particular use case,
 * I wanted to load a script from github, but the it had a MIME type of 'text/plain', which is not
 * executable.
 *
 * OR, take several google json endpoints that start with `while(1);`. The only way to load the
 * data from those scripts is to load it with xhr, and strip out the beginning while infinite-loop.
 * If you try to fetch the data using a script tag, it will immediately execute and lock-out the browser.
 *
 * This technique is also known as JSON hijacking, and the only way to get the data is doing an ajax
 * fetch (which CORS rules can prevent attempting to access sensitive data from across domains.)
 */

'use strict';

(function(loaderObject) {

    function loadScripts(scripts) {
        scripts.forEach(function(scriptSrc) {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = scriptSrc;
            document.head.appendChild(script);
        });
    }

    var xhrScripts = loaderObject.xhrScripts || [],
        normalScripts = loaderObject.normalScripts || [],

        xhrScriptsSize = xhrScripts.length,
        xhrScriptsLoaded = 0;

    if (!xhrScriptsSize) {
        loadScripts(normalScripts);
    }

    xhrScripts.forEach(function(scriptSrc) {

        var xhr = new XMLHttpRequest();
        xhr.addEventListener('load', function() {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.innerHTML = this.response;
            document.head.appendChild(script);

            xhrScriptsLoaded++;
            if (xhrScriptsLoaded === xhrScriptsSize) {

                // All async scripts have loaded, now lets load the non-async ones
                loadScripts(normalScripts);
            }
        });
        xhr.open('get', scriptSrc);
        xhr.send();
    });

})({
    xhrScripts: ['https://raw.githubusercontent.com/TheIronDeveloper/dom-to-canvas/master/dom-to-canvas.js'],
    normalScripts: ['/javascripts/app.js']
});