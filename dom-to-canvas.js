/**
 * Dom-To-Canvas
 *
 * The primary intent of this script is to render a DOM tree onto a canvas in a aesthetically pleasing manner.
 *
 * The secondary intent is to serve as an educational primer. Libraries will not be used, and there will be a
 * verbose amount of documentation.
 *
 * This file has two responsibilities:
 *  Convert a fetched document into an abstract DOM-like structure.
 *  Render a visual representation of the DOM-like structure.
 */

'use strict';

/**
 * For convenience, if an object (or truthy value) is passed into this IIFE, then it will automatically execute
 * renderCurrentDOM(), rendering a canvas onto the current document.
 */
var domToCanvas = (function(domToCanvasOpts) {

  /**
   * The document host object maintains a live HTMLCollection of certain element tags.
   *
   * While the dom-like structure we are adding won't be live, we can at the very least update the
   * document to contain a quick reference to these nodes using vanilla arrays.
   */
  var docRefTagsMap = {
    HTML: function(newNode, node, documentRef) {
      documentRef.documentElement = newNode;
    },
    HEAD: function(newNode, node, documentRef) {
      documentRef.head = newNode;
    },
    BODY: function(newNode, node, documentRef) {
      documentRef.body = newNode;
    },
    FORM: function (newNode, node, documentRef) {
      documentRef.forms.push(newNode);
    },
    SCRIPT: function(newNode, node, documentRef) {
      documentRef.scripts.push(newNode);
    },
    A: function(newNode, node, documentRef) {
      // conditional if href exists https://developer.mozilla.org/en-US/docs/Web/API/Document/links
      if (node.attributes.href) {
        documentRef.links.push(newNode);
      }
    },
    AREA: function(newNode, node, documentRef) {
      // conditional if href exists https://developer.mozilla.org/en-US/docs/Web/API/Document/links
      if (node.attributes.href) {
        documentRef.links.push(newNode);
      }
    },
    IMG: function(newNode, node, documentRef) {
      documentRef.images.push(newNode);
    }
  };

  var nodeColorMap = {
    HTML: '#000',
    HEAD: '#F00',
    BODY: '#0F0',
    default: '#2F73D8'
  };

  /**
   * Instead of an if-ladder, or checking if an array contains a value, using a map is a convenient and
   * fast way to check if something meets a condition.
   *
   * The following map is similar to ['HTML', 'HEAD', 'BODY'].includes(node.tagName), but rather than
   * traversing the entire array, we get to jump straight to a "true" or "undefined" (which is an implied false).
   */
  var nodesWithVisibleTags = {
    HTML: true,
    HEAD: true,
    BODY: true
  };

  /**
   * These variables are used in drawNodes. Although it seems odd to pull them out of context of that function,
   * drawNodes() gets called for every node in the dom-tree. That means for every node we reinstantiate two
   * variables that don't ever change.
   */
  var startAngle = 0,
      endAngle = 2 * Math.PI,
      radius = 5;

  // I'm scoping these variables to the top so they can be used in multiple functions without having to pass them around.
  var cellHeight;
  var currentTree;
  var currentHoveredNode;
  var currentHoveredNodeBackgroundColor;
  var ctx;
  var treeStack = [];

  /**
   * Traverse down an document, creating a DOM-like structure
   * @param node - the true DOM node
   * @param parentNode - a dom-like representation of our DOM node
   * @param depth - the node's depth, used for the rendering process
   * @param start - the starting range to draw on the canvas
   * @param end - the ending range to draw on the canvas
   * @param documentRef {Object} - An object literal that will get merged into our document-like element after traversal
   *
   * @returns {Object} DOM-like object.
   */
  function traverseDomLikeNode(node, parentNode, depth, start, end, documentRef) {

    if (depth > documentRef.largestDepth) {
      documentRef.largestDepth = depth;
    }

    /**
     * This is our new "node". We've creating an object literal that gives a close representation of an actual DOM
     * Element.
     *
     * DOM traversal happens by either:
     *  moving up: parentNode,
     *  moving sideways: nextSibling, previousSibling, nextElementSibling, or previousElementSibling
     *  moving down: children, childNodes, firstChild, lastChild, firstElementChild, lastElementChild
     *
     * The "Element" traversals (children, nextElementSibling) will only return traversable nodes... while the regular
     * traversals (childNodes, nextSibling) will return textNodes, commentNodes, and ElementNodes.
     *
     * The DOM trees I've looked at all seem to look super crowded already, so I'm going to skip text and comment nodes
     * and instead go straight to Element nodes.
     *
     */
    var newNode = {

      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      childNodes: [],

      firstElementChild: null,
      lastElementChild: null,
      nextElementSibling: null,
      previousElementSibling: null,

      children: [],
      childElementCount: node.childElementCount,
      attributes: {},
      depth: depth,
      end: end,
      start: start,
      tagName: node.tagName,
      parentNode: parentNode,

      __nodeRef: node.__nodeRef || node // create a reference to the original node. This does NOT exist on the DOM Element
    };


    var attributes = node.attributes,
        attributesLength,
        attribute;

    /**
     * In the event we are traversing DOM-like nodes (and not real DOM nodes), we can simply set the
     * newNode's attributes object to be the same as the node's attributes.
     *
     * One way we can be sure if we are looking at a REAL DOM element is checking that the attributes instance.
     *
     * (real) Element.attributes returns a NamedNodeMap
     */
    if (attributes instanceof NamedNodeMap) {

      attributesLength = attributes.length || 0;
      for(var i = 0; i < attributesLength; i++) {

        /**
         * If you know that attribute you are setting or getting, you almost always will want to use
         * node.getAttribute(str) or node.setAttribute(). The getter returns the string value of the
         * attribute.
         *
         * Important Note: even if you set an attribute with a number or boolean, it will be returned
         * as a string.
         */
        attribute = attributes[i];
        newNode.attributes[attribute.name] = attribute.value;
      }
    } else {
      newNode.attributes = node.attributes;
    }

    // If the node has an id, then lets add it directly to the docRef ID map.
    if(node.id) {
      newNode.id = node.id;
      documentRef.ids[node.id] = newNode;
    }

    // If our node is among a set of special cases, lets call a function that updates the documentRef
    if (docRefTagsMap[node.tagName]) {
      docRefTagsMap[node.tagName](newNode, node, documentRef);
    }

    var childDepth = depth + 1,
        childCount = newNode.childElementCount,
        width = (end - start) / childCount,
        child,
        childStart;

    for (var i = 0; i< childCount; i++) {

      childStart = start + (i * width);

      child = traverseDomLikeNode(node.children[i], newNode, childDepth, childStart, childStart + width, documentRef);
      newNode.children.push(child);
    }

    // Nodes have firstChild/lastChild properties too!
    if (childCount) {
      newNode.firstElementChild = newNode.children[0];
      newNode.lastElementChild = newNode.children[childCount-1];
    }

    // Binding relationship between sibling elements
    newNode.children.forEach(function(child, childIndex) {
      if (childIndex > 0) {
        child.previousElementSibling = newNode.children[childIndex-1];
      }
      if (childIndex < childCount - 1) {
        child.nextElementSibling = newNode.children[childIndex+1];
      }
    });

    return newNode;
  }

  /**
   * Create a DOM-like structure. We will be using vanilla objects as our nodes, and making use of a few
   * DOM functions to traverse between each node.
   *
   * @param myDocument {Document}
   * @param start {Number} - canvas starting point
   * @param end {Number} - canvas ending point
   * @returns {Object}  Dom-like Tree
   */
  function createDOMLikeObject(myDocument, start, end) {

    /**
     * The document node, unlike other nodes, stores a reference to ids and certain types of nodes (images, scripts, etc).
     */
    var documentRef = {

      body: null, // reference to the <body> element
      head: null, // reference to the <head> element
      documentElement: null, // reference to <html>

      ids: {},
      links: [], // <a> and <area> tags
      images: [], // <img> tags
      scripts: [], // <scripts>
      forms: [],

      // Rendering helpers :)
      largestDepth: 0
    };

    var newDocument = traverseDomLikeNode(myDocument, null, 0, start, end, documentRef);
    var augmentedDoc = Object.assign({}, newDocument, documentRef);
    return augmentedDoc;
  }

  /**
   * Recursively travel down the dom-like tree, rendering each node as we go.
   * @param ctx
   * @param node
   */
  function drawNodes(ctx, node, height) {

    var tagName = node.tagName,
        x = (node.start + (node.end - node.start) / 2),
        y = node.depth * height + 20;

    var firstElementChild = node.firstElementChild,
        lastElementChild = node.lastElementChild,
        firstX,
        firstY,
        lastX,
        lastY;

    /**
     * Drawing the lines between sibling elements.
     * For us, that just means draw a line from the first to last child elements.
     */
    if (firstElementChild && firstElementChild !== lastElementChild) {
      firstX = (firstElementChild.start + (firstElementChild.end - firstElementChild.start) / 2);
      firstY = firstElementChild.depth * height + 20;

      lastX = (lastElementChild.start + (lastElementChild.end - lastElementChild.start) / 2);
      lastY = lastElementChild.depth * height + 20;

      ctx.beginPath();
      ctx.moveTo(firstX,firstY);
      ctx.lineTo(lastX, lastY);
      ctx.stroke();
      ctx.closePath();
    }

    /**
     * Important Note: We recreated the dom using objects and arrays.
     * Element.children actually returns a live HTMLCollection, which does not have access to
     * array functions like forEach, map, reduce, etc.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/ParentNode/children
     */
    node.children.forEach(function(child) {

      // Draw a line from our current node, to each of its children
      var childX = (child.start + (child.end - child.start) / 2),
          childY = child.depth * height + 20;

      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(childX, childY);
      ctx.stroke();
      ctx.closePath();

      drawNodes(ctx, child, height);
    });

    ctx.beginPath();
    ctx.fillStyle = nodeColorMap[tagName] ? nodeColorMap[tagName] : nodeColorMap.default;
    ctx.arc(x, y, radius, startAngle, endAngle, false);
    ctx.fill();

    /**
     * Displaying the tagNames of all the nodes would look terrible, but its nice to point out
     * some of the core tagNames (html, body, head)
     */
    if (nodesWithVisibleTags[tagName]) {
      ctx.fillStyle = '#000';
      ctx.fillText(node.tagName, x + 5, y - 5);
    }
  }

  /**
   * Recursively travel down the DOM tree, comparing the current node with the x=y coordinates of
   * the last click or hover event.
   */
  function searchForNodeWithXY(node, x, y) {

    var verticalCenter = (node.start + (node.end - node.start) / 2),
        horizontalCenter = node.depth * cellHeight + 20,
        isInNode = (x >= verticalCenter - radius && x <= verticalCenter + radius && y >= horizontalCenter - radius && y <= horizontalCenter + radius),
        child,
        i;

    if (isInNode) {
      return node;
    }

    for (i = 0; i< node.childElementCount; i++) {

      child = node.children[i];

      /**
       * Each child will have a smaller (or equal) range to its parent. These ranges do not intersect.
       * In the event we found a child whose range includes our "x", lets return a search through that child,
       * since its a better candidate than the other nodes.
       */
      if (x > child.start && x < child.end) {
        return searchForNodeWithXY(child, x, y);
      }
    }

    return null;
  }

  /**
   * Because canvas is a 2-dimentional block, it doesn't store reference to what "element" or "shapes" we click on.
   * Instead, we need to figure that ourselves. In our case, we traverse down the tree until we find the node that
   * we were trying to click on.
   *
   * @param event {Event} - some browsers will include a global event, but its always safer to declare it yourself.
   * For instance, last time I checked FireFox doesn't give you a freebe event object
   */
  function handleCanvasClick(event) {

    var x = event.offsetX,
        y = event.offsetY,
        canvas = ctx.canvas,
        found,
        domLike;

    /**
     * We're using a stack (actually just an array we are treating like a stack)
     * If the user clicks the top-left corner, we can assume they were trying to go backwards up the stack.
     *
     * If they don't then we should find the node they were trying to click on, and push the previous tree into the stack.
     */
    if (x < 20 && y < 20 && treeStack.length) {
      domLike = treeStack.pop();
    } else {
      found = searchForNodeWithXY(currentTree, x, y);

      if (!found) {
        return;
      }

      domLike = createDOMLikeObject(found, 0, canvas.width);
      treeStack.push(currentTree);
    }

    currentTree = domLike;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /**
     * If our stack has any nodes in them, then we should display an arrow to indicate the user can go backward.
     */
    if (treeStack.length) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(20, 5);
      ctx.lineTo(20, 15);
      ctx.fill();
    }

    cellHeight = canvas.height / (domLike.largestDepth + 1);
    drawNodes(ctx, domLike, cellHeight);
  }

  /**
   * If the user hovers over a node on the canvas, we want to reflect what they are hovering over
   * by "highlighting" that node on the current document.
   * @param event
   */
  function handleCurrentDocumentMouseMove(event) {

    var x = event.offsetX,
        y = event.offsetY,
        foundNode = searchForNodeWithXY(currentTree, x, y);

    if (!foundNode) {
      return;
    }

    var domNode = foundNode.__nodeRef,
        domNodeStyle = domNode.style;

    if (currentHoveredNode) {
      currentHoveredNode.style.backgroundColor = currentHoveredNodeBackgroundColor;
    }

    if (domNodeStyle) {
      currentHoveredNodeBackgroundColor = domNodeStyle.backgroundColor;
      domNodeStyle.backgroundColor = 'rgba(255, 255,0, 0.4)';
      currentHoveredNode = domNode;
    }

  }

  /**
   * Given a canvas and a HTMLDocument, render nodes onto our canvas
   * @param canvas {Element}
   * @param myDocument {Document}
   */
  function drawDOM(canvas, myDocument) {
    if (!myDocument instanceof HTMLDocument) {
      // If the response is not an instanceOf an HTMLDocument, then we should short-circuit the render process
      return;
    }

    /**
     * The CanvasRenderingContext2D interface provides the 2D rendering context for the drawing surface of a
     * <canvas> element. It provides a set of functions that allow us to draw/manipulate a canvas board.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
     */
    ctx = canvas.getContext('2d');


    var domLike = createDOMLikeObject(myDocument, 0, canvas.width);
    currentTree = domLike;
    cellHeight = canvas.height / (domLike.largestDepth + 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#ccc';
    drawNodes(ctx, domLike, cellHeight);

    if (treeStack.length) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(20, 5);
      ctx.lineTo(20, 15);
      ctx.fill();
    }

    /**
     * Interesting detail about listeners: if you assign two duplicate eventHandlers to an event, then only one
     * will get triggered.  "drawDOM()" can get called multiple times, all the user needs to do is enter a different
     * url in the app.js file. BUT, because "handleCanvasClick" is already defined, we are NOT regisering multiple
     * click events.
     */
    canvas.addEventListener('click', handleCanvasClick);
  }


  /**
   * Render the current page's document tree onto a canvas.
   * @param width
   * @param height
   */
  function renderCurrentDOM(width, height) {

    /**
     * If there is no global document or document.createElement, this function is going to crash and burn.
     * So I am adding a safety check and exiting early if that happens.
     */
    if (!document || !document.createElement) {
      return;
    }

    width = width || 400;
    height = height || 300;

    /**
     * DocumentFragments are super useful for building out a DOM structure that you want to render onto the
     * page.  The idea is that rather than appending things to the DOM directly, you append them to the
     * documentFragment, which gets around triggering a reflow.
     *
     * You can find more info on reflows here: https://developers.google.com/speed/articles/reflow#guidelines
     */
    var documentFragment = document.createDocumentFragment();


    /**
     * To create dom element with text in it, we have to first create the dom element, then we need to create
     * a "text node", and append that text node to the dom element.
     */
    var closeDiv = document.createElement('div');
    var closeText = document.createTextNode('close');
    closeDiv.appendChild(closeText);

    var canvas = document.createElement('canvas');

    /**
     * [].join() is a way of easily concatting a string that can be more efficient than a regular a + b + c.
     *
     * But, if the number of strings being concat is small, then it makes more sense to "+" the strings together.
     */
    var cssText = [
      'background: rgba(255,255,255,0.8)',
      'border: 1px solid #ccc',
      'cursor: pointer',
      'position: fixed',
      'top: 5px',
      'right: 5px',
      'z-index: 999999'
    ].join(';');

    /**
     * There are multiple ways to style this element.
     *
     * setAttribute - you can set the style attribute like you would any other attribute (href, etc)
     * style.cssText -  allows you to add a series of styles in a single string
     * style.background - you can set individual styles directly.
     */
    canvas.style.cssText = cssText;

    closeDiv.style.cssText = 'position:fixed;right: 10px;top: 10px;z-index:9999999;cursor:pointer;';


    /**
     * Even if you set the css height and width of the canvas, what actually gets rendered will look
     * disproportionate and stretched.
     */
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);

    // We want to draw the DOM First, before appending the canvas to the document.body
    drawDOM(canvas, document);

    /**
     * After we append the contents of the documentFragment into an element, the documentFragment then empties out.
     */
    documentFragment.appendChild(closeDiv);
    documentFragment.appendChild(canvas);

    // documentFragment.children.length === 2;
    document.body.appendChild(documentFragment);
    // documentFragment.children.length === 0;

    /**
     * This is an example of a simple debounce.  We don't care about all the things your mouse is hovering on top of,
     * what we really care about is where the mouse stops on.
     */
    var canvasDebounce;
    canvas.addEventListener('mousemove', function(event) {
      if (canvasDebounce) {
        clearTimeout(canvasDebounce);
      }

      canvasDebounce = setTimeout(function() {
        handleCurrentDocumentMouseMove(event);
      }, 10);
    });

    closeDiv.addEventListener('click', function() {
      document.body.removeChild(closeDiv);
      document.body.removeChild(canvas);

      // If we did have a "hovered" style, revert it back to its original background
      if (currentHoveredNode) {
        currentHoveredNode.style.backgroundColor = currentHoveredNodeBackgroundColor;
      }
    });

    /**
     * And now, to be extra fancy, we're going to use an observer to watch the
     * document for changes.
     *
     * More info: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
     * https://developers.google.com/web/updates/2012/02/Detect-DOM-changes-with-Mutation-Observers
     */

    var observer = new MutationObserver(function() {

      /**
       * Update all the previous instances of the treestack, rebuilding out DOMLikeObjects with new dimentions to
       * account for the added/removed nodes.
       */

      treeStack = treeStack.map(function(tree) {
        return createDOMLikeObject(tree.__nodeRef, 0, canvas.width);
      });

      /**
       * Re-create the tree that is currently displayed, calculating the new height/widths of the children.
       */
      currentTree = createDOMLikeObject(currentTree.__nodeRef, 0, canvas.width);
      drawDOM(canvas, currentTree);
    });

    /**
     * These two observerConfigs seem to be enough to catch the node changes that we want.
     * childList observes changes on the current target (document)'s children, and subtree
     * observes changes on the target's descendents as well
     */
    var observerConfig = {
      childList: true,
      subtree: true
    };

    observer.observe(document, observerConfig);
  }

  if (domToCanvasOpts) {
    renderCurrentDOM(domToCanvasOpts.width, domToCanvasOpts.height);
  }

  /**
   * Expose a drawDOM function, and a createDOMLikeObject function.
   */
  return {
    drawDOM: drawDOM,
    renderCurrentDOM: renderCurrentDOM,
    createDOMLikeObject: createDOMLikeObject
  };
})(null);