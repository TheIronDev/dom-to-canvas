/**
 * This file has two responsibilities:
 *  Convert a fetched document into an abstract DOM-like structure.
 *  Render a visual representation of the DOM-like structure.
 *
 *  For simplicity sake, I am polluting the global namespace with a drawDOM function, that is used in
 *  the /javascripts/app.js file.
 */

'use strict';


var drawDOM = (function() {

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
    endAngle = 2 * Math.PI;

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

    var newNode = {
      children: [],
      childElementCount: node.childElementCount,
      attributes: {},
      depth: depth,
      end: end,
      start: start,
      tagName: node.tagName,
      parentNode: parentNode
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
      childCount = node.childElementCount,
      width = (end - start) / childCount,
      child,
      childStart;

    for (var i = 0; i< node.childElementCount; i++) {

      childStart = start + (i * width);

      child = traverseDomLikeNode(node.children[i], newNode, childDepth, childStart, childStart + width, documentRef);
      newNode.children.push(child);
    }

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
  function createDOMLike(myDocument, start, end) {

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
      radius = 5,
      x = (node.start + (node.end - node.start) / 2),
      y = node.depth * height + 20;

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
   * Given a canvas and a HTMLDocument, render nodes onto our canvas
   * @param canvas {HTMLCanvasElement}
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
    var ctx = canvas.getContext('2d');


    var domLike = createDOMLike(myDocument, 0, canvas.width);
    var cellHeight = canvas.height / (domLike.largestDepth + 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ccc';
    drawNodes(ctx, domLike, cellHeight);
  }

  /**
   * The only function we really need to expose is drawDOM.
   * Everything else is an implementation detail that the rest of the app does not need to be aware of.
   */
  return drawDOM;
})();