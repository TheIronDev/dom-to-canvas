/**
 * This file handles both the DOM rendering functionality, as well as binding the
 * eventListeners to enable fetching the DOM from other domains.
 *
 * The documentation in this file is intentionally verbose.
 */

/**
 * The following line opts-in to a more restricted version of JavaScript. It makes changes
 * to how JS handles silent errors, and fixes "mistakes" of JavaScript so that browsers can
 * perform optimizations.
 *
 * For more info, checkout https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
 */

'use strict';


/**
 * drawDOM gets defined in a different file, so just incase its undefined somwhoe, lets return a no-op function
 * @type {Function}
 */
var domToCanvas = domToCanvas || {};
var drawDOM = domToCanvas.drawDOM || function() {};

/**
 * I'm wrapping functionality in an IIFE, or "immediately-invoked function expression".
 *
 * The benefit to this is that my variable declarations do not pollute the global namespace.
 *
 * AMD syntax works in a similar manner, the global namespace is no longer polluted because we are wrapped in a define
 * or require callback function.
 *
 * An even better alternative is working with modules in a commonJS syntax, where files are intended to be
 * small components. Its not actually supported by browsers without the help of a loader like webpack or browserify.
 */
(function (document) {

  var myForm = document.getElementById('fetchUrl'),
    myInput = document.getElementById('url'),
    myCanvas = document.getElementById('dom-to-canvas'),
    myBody = document.body,


    /**
     * Events undergo a propagation phase in one of two ways.
     *
     * An event can move from the target element (the one you interacted with) upward, toward its parents. (bubbling)
     * An event can move from the top-most element, and moves downward toward the target element. (capturing)
     *
     * This behavior matches the design pattern, "chain of responsibility".
     *
     * The 3rd argument to adding an eventListener is useCapture. If set to true, events will propagate downward. If
     * set to false, events will bubble from the target toward the top.
     *
     * Browsers generally default to "false", favoring bubbling over propagation.
     *
     * Here is a helpful primer visually on whats happening: http://www.quirksmode.org/js/events_order.html
     */
    useCapture = false;


  /**
   * Vanilla AJAX Request. I generally see the xhr.open and xhr.send immediately after instantiation, but it seemed
   * weird to constantly reinstantiate an xhr variable.
   *
   * Anyhow, the way you can make a vanilla ajax call is to:
   *
   * 1. instantiate a new XMLHttpRequest object
   * 2. bind events to this object (Either with .addEventListener(fn) or .onload(fn)
   * 3. initialize a request by calling open with a method and url (ie, .open("GET", url))
   * 4. send a request to that url (ie, .send() )
   *
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest
   *
   * I'm setting the responseType to "document" because I am making the assumption that the response I get back will
   * be in the form of a document. I can also set this as text, arraybuffer, blob, and json.
   */
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', function() {

    myForm.classList.remove('loading');

    /**
     * Fun fact: event callbacks automatically bind the XMLHttpRequest instance as "this". We can override it
     * if we decide to pass in a function that has been `.bind`ed already... but we probably don't want to do that.
     */
    var response = this.response;
    drawDOM(myCanvas, response);
  });
  xhr.responseType ='document';

  /**
   * Defining a variable outside of the eventListener scope that can be used to debounce events... more on that in a min.
   */
  var simpleDebounce;

  /**
   * We are listening to the submits of the <form> element that wraps the text-input and button.
   *
   * Although we *could* listen to the "click" event from the button, we don't catch the "enter key" event from
   * the text-input.
   */
  myForm.addEventListener('submit', function(event) {

    /**
     * event.preventDefault() prevents default browser behavior. Default browser behavior includes
     * clicking on an anchor to go to a different url, hitting a button to submit a form, clicking on
     * a checkbox to "check" it.
     *
     * In our case, we don't want the "submit" to actually do anything, since that would try to redirect
     * the page to a url/method defined on the <form> element.
     */
    event.preventDefault();

    /**
     * By calling this, we can skip the propagation this event to other elements. I put a listener on the document.body
     * element to demonstrate how this works. Feel free to comment out the following line and you should see console
     * output.
     */
    event.stopPropagation();


    var url = myInput.value;

    /**
     * Its helpful to know that empty inputs get submitted A LOT. To combat this, we are making a simple check to
     * see if the url is falsey.
     */
    if (!url) {
      return;
    }

    /**
     * Elements now have a classList, which returns a DOMTokenList. Rather than having to manually edit the className
     * directly, we can use a classList to add / remove classes.
     */
    myForm.classList.add('loading');

    /**
     * The clearTimeout / setTimeout are the magic sauce behind our debounce.  If a user ends up firing an event more
     * than once too soon, we clear the previous setTimeout, and set a new setTimeout.
     *
     * Once enough time has passed (in our case, 200ms), our event will fire.
     *
     * Debouncing is incredibly useful for stalling out events such as a quick succession of keystrokes or mousemovement.
     *
     * To clarify, if a user types "hello", we don't want to make a call to our server with "h", "he", "hel"..., we want to
     * wait until they finish typing to trigger our event.
     *
     * Same thing with mousemove. If you drag your mouse across the screen, it will attempt to fire a LOT of events.
     * To get around that, simply debounce until an adequate delay has passed.
     *
     * I put 200ms for the purpose of demonstration, but 60-100ms seems to be a much better sweet spot.
     *
     */
    clearTimeout(simpleDebounce);
    simpleDebounce = setTimeout(function() {

      /**
       * You might notice that I am hitting my own server to fetch the contents of other urls.  By default,
       * browsers restrict cross-origin HTTP requests from other domains. You can get around this restriction
       * by making use of CORS, or Cross Origin Resource Sharing. https://www.w3.org/TR/cors/
       *
       * CORS gives several options for allowing cross-origin requests. One is to provide additional headers that
       * define what domains are allowed to make requests from you. For example, "Access-Control-Allow-Origin" defines
       * which domains are allowed to access content (so returning * means ANYONE can access)
       *
       * Preflight requests, on the other hand, act more as a handshake between the requesting server and the response
       * server. The first request uses the "OPTIONS" method, and an agreement is made between both client and server.
       * After that, the client can immediately follow up with a GET/POST. Generally there is a duration of time that
       * this agreement is maintained, so we don't need to wait for 2 full requests to be made each time.
       *
       * ...
       * ...
       *
       * But yeah, configuring all that takes more work, and I would still be restricted from a whole lot of websites
       * that do not have an open "Access-Control-Allow-Origin" header.  So, I'm instead passing the url back into
       * my own server, and letting the server do a GET for me using the `request` module.  The request doesn't come
       * baked with a set of CORS security features, so I can get the html content, and send it right along back to
       * the client.
       */
      xhr.open('GET', '/fetchUrl?url=' + url);
      xhr.send();

    }, 200);
  }, useCapture);

  myBody.addEventListener('submit', function(event) {

    // I should never get called, because the form is "stopping propagation"
    console.log('If you see this, propagation is not bring stopped');
  });

})(document, drawDOM);
