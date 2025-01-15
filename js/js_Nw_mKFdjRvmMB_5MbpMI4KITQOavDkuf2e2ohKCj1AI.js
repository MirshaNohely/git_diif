/**
 * @file
 * Drupal Bootstrap object.
 */

/**
 * All Drupal Bootstrap JavaScript APIs are contained in this namespace.
 *
 * @param {underscore} _
 * @param {jQuery} $
 * @param {Drupal} Drupal
 * @param {drupalSettings} drupalSettings
 */
(function (_, $, Drupal, drupalSettings) {
  'use strict';

  /**
   * @typedef Drupal.bootstrap
   */
  var Bootstrap = {
    processedOnce: {},
    settings: drupalSettings.bootstrap || {}
  };

  /**
   * Wraps Drupal.checkPlain() to ensure value passed isn't empty.
   *
   * Encodes special characters in a plain-text string for display as HTML.
   *
   * @param {string} str
   *   The string to be encoded.
   *
   * @return {string}
   *   The encoded string.
   *
   * @ingroup sanitization
   */
  Bootstrap.checkPlain = function (str) {
    return str && Drupal.checkPlain(str) || '';
  };

  /**
   * Creates a jQuery plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.createPlugin = function (id, plugin, noConflict) {
    // Immediately return if plugin doesn't exist.
    if ($.fn[id] !== void 0) {
      return this.fatal('Specified jQuery plugin identifier already exists: @id. Use Drupal.bootstrap.replacePlugin() instead.', {'@id': id});
    }

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('You must provide a constructor function to create a jQuery plugin "@id": @plugin', {'@id': id, '@plugin':  plugin});
    }

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Diff object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of the first passed object that are not present
   *   in all other passed objects.
   */
  Bootstrap.diffObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.difference.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Map of supported events by regular expression.
   *
   * @type {Object<Event|MouseEvent|KeyboardEvent|TouchEvent,RegExp>}
   */
  Bootstrap.eventMap = {
    Event: /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    MouseEvent: /^(?:click|dblclick|mouse(?:down|enter|leave|up|over|move|out))$/,
    KeyboardEvent: /^(?:key(?:down|press|up))$/,
    TouchEvent: /^(?:touch(?:start|end|move|cancel))$/
  };

  /**
   * Extends a jQuery Plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A constructor function used to initialize the for the jQuery plugin.
   *
   * @return {Function|Boolean}
   *   The jQuery plugin constructor or FALSE if the plugin does not exist.
   */
  Bootstrap.extendPlugin = function (id, callback) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a callback function to extend the jQuery plugin "@id": @callback', {'@id': id, '@callback':  callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);
    if (!$.isPlainObject(plugin)) {
      return this.fatal('Returned value from callback is not a plain object that can be used to extend the jQuery plugin "@id": @obj', {'@obj':  plugin});
    }

    this.wrapPluginConstructor(constructor, plugin, true);

    return $.fn[id];
  };

  Bootstrap.superWrapper = function (parent, fn) {
    return function () {
      var previousSuper = this.super;
      this.super = parent;
      var ret = fn.apply(this, arguments);
      if (previousSuper) {
        this.super = previousSuper;
      }
      else {
        delete this.super;
      }
      return ret;
    };
  };

  /**
   * Provide a helper method for displaying when something is went wrong.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   An arguments to use in message.
   *
   * @return {Boolean}
   *   Always returns FALSE.
   */
  Bootstrap.fatal = function (message, args) {
    if (this.settings.dev && console.warn) {
      for (var name in args) {
        if (args.hasOwnProperty(name) && typeof args[name] === 'object') {
          args[name] = JSON.stringify(args[name]);
        }
      }
      Drupal.throwError(new Error(Drupal.formatString(message, args)));
    }
    return false;
  };

  /**
   * Intersects object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of first passed object that intersects with all
   *   other passed objects.
   */
  Bootstrap.intersectObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.intersection.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Normalizes an object's values.
   *
   * @param {Object} obj
   *   The object to normalize.
   *
   * @return {Object}
   *   The normalized object.
   */
  Bootstrap.normalizeObject = function (obj) {
    if (!$.isPlainObject(obj)) {
      return obj;
    }

    for (var k in obj) {
      if (typeof obj[k] === 'string') {
        if (obj[k] === 'true') {
          obj[k] = true;
        }
        else if (obj[k] === 'false') {
          obj[k] = false;
        }
        else if (obj[k].match(/^[\d-.]$/)) {
          obj[k] = parseFloat(obj[k]);
        }
      }
      else if ($.isPlainObject(obj[k])) {
        obj[k] = Bootstrap.normalizeObject(obj[k]);
      }
    }

    return obj;
  };

  /**
   * An object based once plugin (similar to jquery.once, but without the DOM).
   *
   * @param {String} id
   *   A unique identifier.
   * @param {Function} callback
   *   The callback to invoke if the identifier has not yet been seen.
   *
   * @return {Bootstrap}
   */
  Bootstrap.once = function (id, callback) {
    // Immediately return if identifier has already been processed.
    if (this.processedOnce[id]) {
      return this;
    }
    callback.call(this, this.settings);
    this.processedOnce[id] = true;
    return this;
  };

  /**
   * Provide jQuery UI like ability to get/set options for Bootstrap plugins.
   *
   * @param {string|object} key
   *   A string value of the option to set, can be dot like to a nested key.
   *   An object of key/value pairs.
   * @param {*} [value]
   *   (optional) A value to set for key.
   *
   * @returns {*}
   *   - Returns nothing if key is an object or both key and value parameters
   *   were provided to set an option.
   *   - Returns the a value for a specific setting if key was provided.
   *   - Returns an object of key/value pairs of all the options if no key or
   *   value parameter was provided.
   *
   * @see https://github.com/jquery/jquery-ui/blob/master/ui/widget.js
   */
  Bootstrap.option = function (key, value) {
    var options = $.isPlainObject(key) ? $.extend({}, key) : {};

    // Get all options (clone so it doesn't reference the internal object).
    if (arguments.length === 0) {
      return $.extend({}, this.options);
    }

    // Get/set single option.
    if (typeof key === "string") {
      // Handle nested keys in dot notation.
      // e.g., "foo.bar" => { foo: { bar: true } }
      var parts = key.split('.');
      key = parts.shift();
      var obj = options;
      if (parts.length) {
        for (var i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = obj[parts[i]] || {};
          obj = obj[parts[i]];
        }
        key = parts.pop();
      }

      // Get.
      if (arguments.length === 1) {
        return obj[key] === void 0 ? null : obj[key];
      }

      // Set.
      obj[key] = value;
    }

    // Set multiple options.
    $.extend(true, this.options, options);
  };

  /**
   * Adds a ".noConflict()" helper method if needed.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.pluginNoConflict = function (id, plugin, noConflict) {
    if (plugin.noConflict === void 0 && (noConflict === void 0 || noConflict)) {
      var old = $.fn[id];
      plugin.noConflict = function () {
        $.fn[id] = old;
        return this;
      };
    }
  };

  /**
   * Creates a handler that relays to another event name.
   *
   * @param {HTMLElement|jQuery} target
   *   A target element.
   * @param {String} name
   *   The name of the event to trigger.
   * @param {Boolean} [stopPropagation=true]
   *   Flag indicating whether to stop the propagation of the event, defaults
   *   to true.
   *
   * @return {Function}
   *   An even handler callback function.
   */
  Bootstrap.relayEvent = function (target, name, stopPropagation) {
    return function (e) {
      if (stopPropagation === void 0 || stopPropagation) {
        e.stopPropagation();
      }
      var $target = $(target);
      var parts = name.split('.').filter(Boolean);
      var type = parts.shift();
      e.target = $target[0];
      e.currentTarget = $target[0];
      e.namespace = parts.join('.');
      e.type = type;
      $target.trigger(e);
    };
  };

  /**
   * Replaces a Bootstrap jQuery plugin definition.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A callback function that is immediately invoked and must return a
   *   function that will be used as the plugin constructor.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.replacePlugin = function (id, callback, noConflict) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a valid callback function to replace a jQuery plugin: @callback', {'@callback': callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('Returned value from callback is not a usable function to replace a jQuery plugin "@id": @plugin', {'@id': id, '@plugin': plugin});
    }

    this.wrapPluginConstructor(constructor, plugin);

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Simulates a native event on an element in the browser.
   *
   * Note: This is a fairly complete modern implementation. If things aren't
   * working quite the way you intend (in older browsers), you may wish to use
   * the jQuery.simulate plugin. If it's available, this method will defer to
   * that plugin.
   *
   * @see https://github.com/jquery/jquery-simulate
   *
   * @param {HTMLElement|jQuery} element
   *   A DOM element to dispatch event on. Note: this may be a jQuery object,
   *   however be aware that this will trigger the same event for each element
   *   inside the jQuery collection; use with caution.
   * @param {String|String[]} type
   *   The type(s) of event to simulate.
   * @param {Object} [options]
   *   An object of options to pass to the event constructor. Typically, if
   *   an event is being proxied, you should just pass the original event
   *   object here. This allows, if the browser supports it, to be a truly
   *   simulated event.
   *
   * @return {Boolean}
   *   The return value is false if event is cancelable and at least one of the
   *   event handlers which handled this event called Event.preventDefault().
   *   Otherwise it returns true.
   */
  Bootstrap.simulate = function (element, type, options) {
    // Handle jQuery object wrappers so it triggers on each element.
    var ret = true;
    if (element instanceof $) {
      element.each(function () {
        if (!Bootstrap.simulate(this, type, options)) {
          ret = false;
        }
      });
      return ret;
    }

    if (!(element instanceof HTMLElement)) {
      this.fatal('Passed element must be an instance of HTMLElement, got "@type" instead.', {
        '@type': typeof element,
      });
    }

    // Defer to the jQuery.simulate plugin, if it's available.
    if (typeof $.simulate === 'function') {
      new $.simulate(element, type, options);
      return true;
    }

    var event;
    var ctor;
    var types = [].concat(type);
    for (var i = 0, l = types.length; i < l; i++) {
      type = types[i];
      for (var name in this.eventMap) {
        if (this.eventMap[name].test(type)) {
          ctor = name;
          break;
        }
      }
      if (!ctor) {
        throw new SyntaxError('Only rudimentary HTMLEvents, KeyboardEvents and MouseEvents are supported: ' + type);
      }
      var opts = {bubbles: true, cancelable: true};
      if (ctor === 'KeyboardEvent' || ctor === 'MouseEvent') {
        $.extend(opts, {ctrlKey: !1, altKey: !1, shiftKey: !1, metaKey: !1});
      }
      if (ctor === 'MouseEvent') {
        $.extend(opts, {button: 0, pointerX: 0, pointerY: 0, view: window});
      }
      if (options) {
        $.extend(opts, options);
      }
      if (typeof window[ctor] === 'function') {
        event = new window[ctor](type, opts);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (document.createEvent) {
        event = document.createEvent(ctor);
        event.initEvent(type, opts.bubbles, opts.cancelable);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (typeof element.fireEvent === 'function') {
        event = $.extend(document.createEventObject(), opts);
        if (!element.fireEvent('on' + type, event)) {
          ret = false;
        }
      }
      else if (typeof element[type]) {
        element[type]();
      }
    }
    return ret;
  };

  /**
   * Strips HTML and returns just text.
   *
   * @param {String|Element|jQuery} html
   *   A string of HTML content, an Element DOM object or a jQuery object.
   *
   * @return {String}
   *   The text without HTML tags.
   *
   * @todo Replace with http://locutus.io/php/strings/strip_tags/
   */
  Bootstrap.stripHtml = function (html) {
    if (html instanceof $) {
      html = html.html();
    }
    else if (html instanceof Element) {
      html = html.innerHTML;
    }
    var tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/^[\s\n\t]*|[\s\n\t]*$/, '');
  };

  /**
   * Provide a helper method for displaying when something is unsupported.
   *
   * @param {String} type
   *   The type of unsupported object, e.g. method or option.
   * @param {String} name
   *   The name of the unsupported object.
   * @param {*} [value]
   *   The value of the unsupported object.
   */
  Bootstrap.unsupported = function (type, name, value) {
    Bootstrap.warn('Unsupported by Drupal Bootstrap: (@type) @name -> @value', {
      '@type': type,
      '@name': name,
      '@value': typeof value === 'object' ? JSON.stringify(value) : value
    });
  };

  /**
   * Provide a helper method to display a warning.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   Arguments to use as replacements in Drupal.formatString.
   */
  Bootstrap.warn = function (message, args) {
    if (this.settings.dev && console.warn) {
      console.warn(Drupal.formatString(message, args));
    }
  };

  /**
   * Wraps a plugin with common functionality.
   *
   * @param {Function} constructor
   *   A plugin constructor being wrapped.
   * @param {Object|Function} plugin
   *   The plugin being wrapped.
   * @param {Boolean} [extend = false]
   *   Whether to add super extensibility.
   */
  Bootstrap.wrapPluginConstructor = function (constructor, plugin, extend) {
    var proto = constructor.prototype;

    // Add a jQuery UI like option getter/setter method.
    var option = this.option;
    if (proto.option === void(0)) {
      proto.option = function () {
        return option.apply(this, arguments);
      };
    }

    if (extend) {
      // Handle prototype properties separately.
      if (plugin.prototype !== void 0) {
        for (var key in plugin.prototype) {
          if (!plugin.prototype.hasOwnProperty(key)) continue;
          var value = plugin.prototype[key];
          if (typeof value === 'function') {
            proto[key] = this.superWrapper(proto[key] || function () {}, value);
          }
          else {
            proto[key] = $.isPlainObject(value) ? $.extend(true, {}, proto[key], value) : value;
          }
        }
      }
      delete plugin.prototype;

      // Handle static properties.
      for (key in plugin) {
        if (!plugin.hasOwnProperty(key)) continue;
        value = plugin[key];
        if (typeof value === 'function') {
          constructor[key] = this.superWrapper(constructor[key] || function () {}, value);
        }
        else {
          constructor[key] = $.isPlainObject(value) ? $.extend(true, {}, constructor[key], value) : value;
        }
      }
    }
  };

  // Add Bootstrap to the global Drupal object.
  Drupal.bootstrap = Drupal.bootstrap || Bootstrap;

})(window._, window.jQuery, window.Drupal, window.drupalSettings);
;
(function ($, _) {

  /**
   * @class Attributes
   *
   * Modifies attributes.
   *
   * @param {Object|Attributes} attributes
   *   An object to initialize attributes with.
   */
  var Attributes = function (attributes) {
    this.data = {};
    this.data['class'] = [];
    this.merge(attributes);
  };

  /**
   * Renders the attributes object as a string to inject into an HTML element.
   *
   * @return {String}
   *   A rendered string suitable for inclusion in HTML markup.
   */
  Attributes.prototype.toString = function () {
    var output = '';
    var name, value;
    var checkPlain = function (str) {
      return str && str.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '';
    };
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      output += ' ' + checkPlain(name) + '="' + checkPlain(value) + '"';
    }
    return output;
  };

  /**
   * Renders the Attributes object as a plain object.
   *
   * @return {Object}
   *   A plain object suitable for inclusion in DOM elements.
   */
  Attributes.prototype.toPlainObject = function () {
    var object = {};
    var name, value;
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      object[name] = value;
    }
    return object;
  };

  /**
   * Add class(es) to the array.
   *
   * @param {string|Array} value
   *   An individual class or an array of classes to add.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.addClass = function (value) {
    var args = Array.prototype.slice.call(arguments);
    this.data['class'] = this.sanitizeClasses(this.data['class'].concat(args));
    return this;
  };

  /**
   * Returns whether the requested attribute exists.
   *
   * @param {string} name
   *   An attribute name to check.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.exists = function (name) {
    return this.data[name] !== void(0) && this.data[name] !== null;
  };

  /**
   * Retrieve a specific attribute from the array.
   *
   * @param {string} name
   *   The specific attribute to retrieve.
   * @param {*} defaultValue
   *   (optional) The default value to set if the attribute does not exist.
   *
   * @return {*}
   *   A specific attribute value, passed by reference.
   */
  Attributes.prototype.get = function (name, defaultValue) {
    if (!this.exists(name)) this.data[name] = defaultValue;
    return this.data[name];
  };

  /**
   * Retrieves a cloned copy of the internal attributes data object.
   *
   * @return {Object}
   */
  Attributes.prototype.getData = function () {
    return _.extend({}, this.data);
  };

  /**
   * Retrieves classes from the array.
   *
   * @return {Array}
   *   The classes array.
   */
  Attributes.prototype.getClasses = function () {
    return this.get('class', []);
  };

  /**
   * Indicates whether a class is present in the array.
   *
   * @param {string|Array} className
   *   The class(es) to search for.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.hasClass = function (className) {
    className = this.sanitizeClasses(Array.prototype.slice.call(arguments));
    var classes = this.getClasses();
    for (var i = 0, l = className.length; i < l; i++) {
      // If one of the classes fails, immediately return false.
      if (_.indexOf(classes, className[i]) === -1) {
        return false;
      }
    }
    return true;
  };

  /**
   * Merges multiple values into the array.
   *
   * @param {Attributes|Node|jQuery|Object} object
   *   An Attributes object with existing data, a Node DOM element, a jQuery
   *   instance or a plain object where the key is the attribute name and the
   *   value is the attribute value.
   * @param {boolean} [recursive]
   *   Flag determining whether or not to recursively merge key/value pairs.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.merge = function (object, recursive) {
    // Immediately return if there is nothing to merge.
    if (!object) {
      return this;
    }

    // Get attributes from a jQuery element.
    if (object instanceof $) {
      object = object[0];
    }

    // Get attributes from a DOM element.
    if (object instanceof Node) {
      object = Array.prototype.slice.call(object.attributes).reduce(function (attributes, attribute) {
        attributes[attribute.name] = attribute.value;
        return attributes;
      }, {});
    }
    // Get attributes from an Attributes instance.
    else if (object instanceof Attributes) {
      object = object.getData();
    }
    // Otherwise, clone the object.
    else {
      object = _.extend({}, object);
    }

    // By this point, there should be a valid plain object.
    if (!$.isPlainObject(object)) {
      setTimeout(function () {
        throw new Error('Passed object is not supported: ' + object);
      });
      return this;
    }

    // Handle classes separately.
    if (object && object['class'] !== void 0) {
      this.addClass(object['class']);
      delete object['class'];
    }

    if (recursive === void 0 || recursive) {
      this.data = $.extend(true, {}, this.data, object);
    }
    else {
      this.data = $.extend({}, this.data, object);
    }

    return this;
  };

  /**
   * Removes an attribute from the array.
   *
   * @param {string} name
   *   The name of the attribute to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.remove = function (name) {
    if (this.exists(name)) delete this.data[name];
    return this;
  };

  /**
   * Removes a class from the attributes array.
   *
   * @param {...string|Array} className
   *   An individual class or an array of classes to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.removeClass = function (className) {
    var remove = this.sanitizeClasses(Array.prototype.slice.apply(arguments));
    this.data['class'] = _.without(this.getClasses(), remove);
    return this;
  };

  /**
   * Replaces a class in the attributes array.
   *
   * @param {string} oldValue
   *   The old class to remove.
   * @param {string} newValue
   *   The new class. It will not be added if the old class does not exist.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.replaceClass = function (oldValue, newValue) {
    var classes = this.getClasses();
    var i = _.indexOf(this.sanitizeClasses(oldValue), classes);
    if (i >= 0) {
      classes[i] = newValue;
      this.set('class', classes);
    }
    return this;
  };

  /**
   * Ensures classes are flattened into a single is an array and sanitized.
   *
   * @param {...String|Array} classes
   *   The class or classes to sanitize.
   *
   * @return {Array}
   *   A sanitized array of classes.
   */
  Attributes.prototype.sanitizeClasses = function (classes) {
    return _.chain(Array.prototype.slice.call(arguments))
      // Flatten in case there's a mix of strings and arrays.
      .flatten()

      // Split classes that may have been added with a space as a separator.
      .map(function (string) {
        return string.split(' ');
      })

      // Flatten again since it was just split into arrays.
      .flatten()

      // Filter out empty items.
      .filter()

      // Clean the class to ensure it's a valid class name.
      .map(function (value) {
        return Attributes.cleanClass(value);
      })

      // Ensure classes are unique.
      .uniq()

      // Retrieve the final value.
      .value();
  };

  /**
   * Sets an attribute on the array.
   *
   * @param {string} name
   *   The name of the attribute to set.
   * @param {*} value
   *   The value of the attribute to set.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.set = function (name, value) {
    var obj = $.isPlainObject(name) ? name : {};
    if (typeof name === 'string') {
      obj[name] = value;
    }
    return this.merge(obj);
  };

  /**
   * Prepares a string for use as a CSS identifier (element, class, or ID name).
   *
   * Note: this is essentially a direct copy from
   * \Drupal\Component\Utility\Html::cleanCssIdentifier
   *
   * @param {string} identifier
   *   The identifier to clean.
   * @param {Object} [filter]
   *   An object of string replacements to use on the identifier.
   *
   * @return {string}
   *   The cleaned identifier.
   */
  Attributes.cleanClass = function (identifier, filter) {
    filter = filter || {
      ' ': '-',
      '_': '-',
      '/': '-',
      '[': '-',
      ']': ''
    };

    identifier = identifier.toLowerCase();

    if (filter['__'] === void 0) {
      identifier = identifier.replace('__', '#DOUBLE_UNDERSCORE#');
    }

    identifier = identifier.replace(Object.keys(filter), Object.keys(filter).map(function(key) { return filter[key]; }));

    if (filter['__'] === void 0) {
      identifier = identifier.replace('#DOUBLE_UNDERSCORE#', '__');
    }

    identifier = identifier.replace(/[^\u002D\u0030-\u0039\u0041-\u005A\u005F\u0061-\u007A\u00A1-\uFFFF]/g, '');
    identifier = identifier.replace(['/^[0-9]/', '/^(-[0-9])|^(--)/'], ['_', '__']);

    return identifier;
  };

  /**
   * Creates an Attributes instance.
   *
   * @param {object|Attributes} [attributes]
   *   An object to initialize attributes with.
   *
   * @return {Attributes}
   *   An Attributes instance.
   *
   * @constructor
   */
  Attributes.create = function (attributes) {
    return new Attributes(attributes);
  };

  window.Attributes = Attributes;

})(window.jQuery, window._);
;
/**
 * @file
 * Theme hooks for the Drupal Bootstrap base theme.
 */
(function ($, Drupal, Bootstrap, Attributes) {

  /**
   * Fallback for theming an icon if the Icon API module is not installed.
   */
  if (!Drupal.icon) Drupal.icon = { bundles: {} };
  if (!Drupal.theme.icon || Drupal.theme.prototype.icon) {
    $.extend(Drupal.theme, /** @lends Drupal.theme */ {
      /**
       * Renders an icon.
       *
       * @param {string} bundle
       *   The bundle which the icon belongs to.
       * @param {string} icon
       *   The name of the icon to render.
       * @param {object|Attributes} [attributes]
       *   An object of attributes to also apply to the icon.
       *
       * @returns {string}
       */
      icon: function (bundle, icon, attributes) {
        if (!Drupal.icon.bundles[bundle]) return '';
        attributes = Attributes.create(attributes).addClass('icon').set('aria-hidden', 'true');
        icon = Drupal.icon.bundles[bundle](icon, attributes);
        return '<span' + attributes + '></span>';
      }
    });
  }

  /**
   * Callback for modifying an icon in the "bootstrap" icon bundle.
   *
   * @param {string} icon
   *   The icon being rendered.
   * @param {Attributes} attributes
   *   Attributes object for the icon.
   */
  Drupal.icon.bundles.bootstrap = function (icon, attributes) {
    attributes.addClass(['glyphicon', 'glyphicon-' + icon]);
  };

  /**
   * Add necessary theming hooks.
   */
  $.extend(Drupal.theme, /** @lends Drupal.theme */ {

    /**
     * Renders a Bootstrap AJAX glyphicon throbber.
     *
     * @returns {string}
     */
    ajaxThrobber: function () {
      return Drupal.theme('bootstrapIcon', 'refresh', {'class': ['ajax-throbber', 'glyphicon-spin'] });
    },

    /**
     * Renders a button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button. If it contains one of:
     *   - value: The label of the button.
     *   - context: The context type of Bootstrap button, can be one of:
     *     - default
     *     - primary
     *     - success
     *     - info
     *     - warning
     *     - danger
     *     - link
     *
     * @returns {string}
     */
    button: function (attributes) {
      attributes = Attributes.create(attributes).addClass('btn');
      var context = attributes.get('context', 'default');
      var label = attributes.get('value', '');
      attributes.remove('context').remove('value');
      if (!attributes.hasClass(['btn-default', 'btn-primary', 'btn-success', 'btn-info', 'btn-warning', 'btn-danger', 'btn-link'])) {
        attributes.addClass('btn-' + Bootstrap.checkPlain(context));
      }

      // Attempt to, intelligently, provide a default button "type".
      if (!attributes.exists('type')) {
        attributes.set('type', attributes.hasClass('form-submit') ? 'submit' : 'button');
      }

      return '<button' + attributes + '>' + label + '</button>';
    },

    /**
     * Alias for "button" theme hook.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    btn: function (attributes) {
      return Drupal.theme('button', attributes);
    },

    /**
     * Renders a button block element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-block': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-block'));
    },

    /**
     * Renders a large button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-lg': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-lg'));
    },

    /**
     * Renders a small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-sm': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-sm'));
    },

    /**
     * Renders an extra small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-xs': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-xs'));
    },

    /**
     * Renders a glyphicon.
     *
     * @param {string} name
     *   The name of the glyphicon.
     * @param {object|Attributes} [attributes]
     *   An object of attributes to apply to the icon.
     *
     * @returns {string}
     */
    bootstrapIcon: function (name, attributes) {
      return Drupal.theme('icon', 'bootstrap', name, attributes);
    }

  });

})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes);
;
'use strict';
(function($) {

	$('#web-search-button').click(function(event) {
		event.preventDefault();
		var palabra = $('#web-search').val();
		window.location.replace("/gw/#/sistema-de-consulta/sitios?q="+palabra);
	});

    $('#mobile-search-button').click(function(event) {
        event.preventDefault();
        var palabra = $('#mobile-search').val();
        window.location.replace("/gw/#/sistema-de-consulta/sitios?q="+palabra);
	});
})(jQuery);
;
'use strict'
jQuery(document).ready(function($){
    /* */
    $('.panel-collapse').on('show.bs.collapse', function () {
        $(this).siblings('.panel-heading').addClass('active');
    });
    $('.panel-collapse').on('hide.bs.collapse', function () {
        $(this).siblings('.panel-heading').removeClass('active');
    });
    /*
    Desplegamos cuando el foco está sobre todo el elemento.
    */
    $('.topic').on('mouseenter', function() {
        $(this).find('.collapse').collapse('show');
    });
    $('.topic').on('mouseleave', function() {
        $(this).find('.collapse').collapse('hide');
    });
    /*
    Desplegamos el elemento cuando el foco está sobre el enlace.
    */
   $('.topic .panel-group').each(function() {
       var $this = $(this);
        $this.find('.panel-heading > h2 > a').focus(function() {
            $this.find('.collapse').collapse('show');
        })
   });
});
;
'use strict';
jQuery(document).ready(function($){
	$(window).scroll(function() {
		var scroll = $(window).scrollTop();
		if (scroll >= 150) {
			$('#header-sticky').addClass('sticky');
			$('#header-sticky').removeClass('d-none');
			$('#header-sticky').addClass('d-block');
		} else {
			$('#header-sticky').removeClass('sticky');
			$('#header-sticky').addClass('d-none');
			$('#header-sticky').removeClass('d-block');
		}

	});
});
;
'use strict';
jQuery(document).ready(function($){
	$(window).scroll(function() {
		var scroll = $(window).scrollTop();
    if (scroll >= 200) {
      $('#social-network-sticky').removeClass('d-none');
      $('#social-network-sticky').addClass('sticky');
      $('#social-network-sticky').addClass('d-lg-block');
    } else {
      $('#social-network-sticky').addClass('d-none');
      $('#social-network-sticky').removeClass('sticky');
      $('#social-network-sticky').removeClass('d-lg-block');
    }
	});
});
;
/* ========================================================================
* Extends Bootstrap v3.1.1

* Copyright (c) <2015> PayPal

* All rights reserved.

* Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

* Neither the name of PayPal or any of its subsidiaries or affiliates nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

* ======================================================================== */


(function ($) {
    "use strict";

    // GENERAL UTILITY FUNCTIONS
    // ===============================

    var uniqueId = function (prefix) {
        return (prefix || 'ui-id') + '-' + Math.floor((Math.random() * 1000) + 1)
    }


    var removeMultiValAttributes = function (el, attr, val) {
        var describedby = (el.attr(attr) || "").split(/\s+/)
            , index = $.inArray(val, describedby)
        if (index !== -1) {
            describedby.splice(index, 1)
        }
        describedby = $.trim(describedby.join(" "))
        if (describedby) {
            el.attr(attr, describedby)
        } else {
            el.removeAttr(attr)
        }
    }

    // selectors  Courtesy: https://github.com/jquery/jquery-ui/blob/master/ui/core.js
    var focusable = function (element, isTabIndexNotNaN) {
        var map, mapName, img,
            nodeName = element.nodeName.toLowerCase();
        if ("area" === nodeName) {
            map = element.parentNode;
            mapName = map.name;
            if (!element.href || !mapName || map.nodeName.toLowerCase() !== "map") {
                return false;
            }
            img = $("img[usemap='#" + mapName + "']")[0];
            return !!img && visible(img);
        }
        return (/input|select|textarea|button|object/.test(nodeName) ?
            !element.disabled :
            "a" === nodeName ?
                element.href || isTabIndexNotNaN : isTabIndexNotNaN) && visible(element); // the element and all of its ancestors must be visible
    }
    var visible = function (element) {
        return $.expr.filters.visible(element) &&
            !$(element).parents().addBack().filter(function () {
                return $.css(this, "visibility") === "hidden";
            }).length;
    }

    $.extend($.expr[":"], {
        data: $.expr.createPseudo ?
            $.expr.createPseudo(function (dataName) {
                return function (elem) {
                    return !!$.data(elem, dataName);
                };
            }) :
            // support: jQuery <1.8
            function (elem, i, match) {
                return !!$.data(elem, match[3]);
            },

        focusable: function (element) {
            return focusable(element, !isNaN($.attr(element, "tabindex")));
        },

        tabbable: function (element) {
            var tabIndex = $.attr(element, "tabindex"),
                isTabIndexNaN = isNaN(tabIndex);
            return (isTabIndexNaN || tabIndex >= 0) && focusable(element, !isTabIndexNaN);
        }
    });

    // Popover Extension
    // ===============================

    var showPopover = $.fn.popover.Constructor.prototype.setContent
        , hidePopover = $.fn.popover.Constructor.prototype.hide

    $.fn.popover.Constructor.prototype.setContent = function () {
        showPopover.apply(this, arguments)
        var $tip = this.tip()
            , tooltipID = $tip.attr('id') || uniqueId('ui-tooltip')
        $tip.attr({ 'role': 'alert', 'id': tooltipID })
        this.$element.attr('aria-describedby', tooltipID)
        this.$element.focus()
    }
    $.fn.popover.Constructor.prototype.hide = function () {
        hidePopover.apply(this, arguments)
        removeMultiValAttributes(this.$element, 'aria-describedby', this.tip().attr('id'))
        return this
    }

    // Modal Extension
    // ===============================

    $('.modal-dialog').attr({ 'role': 'document' })
    var modalhide = $.fn.modal.Constructor.prototype.hide
    $.fn.modal.Constructor.prototype.hide = function () {
        modalhide.apply(this, arguments)
        $(document).off('keydown.bs.modal')
    }

    var modalfocus = $.fn.modal.Constructor.prototype.enforceFocus
    $.fn.modal.Constructor.prototype.enforceFocus = function () {
        var $content = this.$element.find(".modal-content")
        var focEls = $content.find(":tabbable")
            , $lastEl = $(focEls[focEls.length - 1])
            , $firstEl = $(focEls[0])
        $lastEl.on('keydown.bs.modal', $.proxy(function (ev) {
            if (ev.keyCode === 9 && !(ev.shiftKey | ev.ctrlKey | ev.metaKey | ev.altKey)) { // TAB pressed
                ev.preventDefault();
                $firstEl.focus();
            }
        }, this))
        $firstEl.on('keydown.bs.modal', $.proxy(function (ev) {
            if (ev.keyCode === 9 && ev.shiftKey) { // SHIFT-TAB pressed
                ev.preventDefault();
                $lastEl.focus();
            }
        }, this))
        modalfocus.apply(this, arguments)
    }

    // DROPDOWN Extension
    // ===============================

    var toggle = '[data-toggle=dropdown]'
        , $par
        , firstItem
        , focusDelay = 200
        , menus = $(toggle).parent().find('ul').attr('role', 'menubar')
        , lis = menus.find('li').attr('role', 'none')

    // add menuitem role and tabIndex to dropdown links
    lis.find('a').attr({ 'role': 'menuitem', 'tabIndex': '-1' })
    // add aria attributes to dropdown toggle
    $(toggle).attr({ 'aria-haspopup': 'true', 'aria-expanded': 'false' })

    $(toggle).parent()
        // Update aria-expanded when open
        .on('shown.bs.dropdown', function (e) {
            $par = $(this)
            var $toggle = $par.find(toggle)
            $toggle.attr('aria-expanded', 'true')
            $toggle.on('keydown.bs.dropdown', $.proxy(function (ev) {
                setTimeout(function () {
                    firstItem = $('.dropdown-menu [role=menuitem]:visible', $par)[0]
                    try { firstItem.focus() } catch (ex) { }
                }, focusDelay)
            }, this))

        })
        // Update aria-expanded when closed
        .on('hidden.bs.dropdown', function (e) {
            $par = $(this)
            var $toggle = $par.find(toggle)
            $toggle.attr('aria-expanded', 'false')
        })

    // Close the dropdown if tabbed away from
    $(document)
        .on('focusout.dropdown.data-api', '.dropdown-menu', function (e) {
            var $this = $(this)
                , that = this;
            // since we're trying to close when appropriate,
            // make sure the dropdown is open
            if (!$this.parent().hasClass('open')) {
                return;
            }
            setTimeout(function () {
                if (!$.contains(that, document.activeElement)) {
                    $this.parent().find('[data-toggle=dropdown]').dropdown('toggle')
                }
            }, 150)
        })
        .on('keydown.bs.dropdown.data-api', toggle + ', [role=menu]', $.fn.dropdown.Constructor.prototype.keydown);

    // Tab Extension
    // ===============================

    var $tablist = $('.nav-tabs, .nav-pills')
        , $lis = $tablist.children('li')
        , $tabs = $tablist.find('[data-toggle="tab"], [data-toggle="pill"]')

    if ($tabs) {
        $tablist.attr('role', 'tablist')
        $lis.attr('role', 'presentation')
        $tabs.attr('role', 'tab')
    }

    $tabs.each(function (index) {
        var tabpanel = $($(this).attr('href'))
            , tab = $(this)
            , tabid = tab.attr('id') || uniqueId('ui-tab')

        tab.attr('id', tabid)

        if (tab.parent().hasClass('active')) {
            tab.attr({ 'tabIndex': '0', 'aria-selected': 'true', 'aria-controls': tab.attr('href').substr(1) })
            tabpanel.attr({ 'tabIndex': '0', 'aria-hidden': 'false', 'aria-labelledby': tabid })
        } else {
            tab.attr({ 'tabIndex': '-1', 'aria-selected': 'false', 'aria-controls': tab.attr('href').substr(1) })
            tabpanel.attr({'tabIndex': '-1', 'aria-hidden': 'true', 'aria-labelledby': tabid })
        }
    })

    $.fn.tab.Constructor.prototype.keydown = function (e) {
        var $this = $(this)
            , $items
            , $ul = $this.closest('ul[role=tablist] ')
            , index
            , k = e.which || e.keyCode

        $this = $(this)
        if (!/(37|38|39|40)/.test(k)) return

        $items = $ul.find('[role=tab]:visible')
        index = $items.index($items.filter(':focus'))

        if (k == 38 || k == 37) index--                         // up & left
        if (k == 39 || k == 40) index++                        // down & right


        if (index < 0) index = $items.length - 1
        if (index == $items.length) index = 0

        var nextTab = $items.eq(index)
        if (nextTab.attr('role') === 'tab') {

            nextTab.tab('show')      //Comment this line for dynamically loaded tabPabels, to save Ajax requests on arrow key navigation
                .focus()
        }
        // nextTab.focus()

        e.preventDefault()
        e.stopPropagation()
    }

    $(document).on('keydown.tab.data-api', '[data-toggle="tab"], [data-toggle="pill"]', $.fn.tab.Constructor.prototype.keydown)

    var tabactivate = $.fn.tab.Constructor.prototype.activate;
    $.fn.tab.Constructor.prototype.activate = function (element, container, callback) {
        var $active = container.find('> .active')
        $active.find('[data-toggle=tab], [data-toggle=pill]').attr({ 'tabIndex': '-1', 'aria-selected': false })
        $active.filter('.tab-pane').attr({ 'aria-hidden': true, 'tabIndex': '-1' })

        tabactivate.apply(this, arguments)

        element.addClass('active')
        element.find('[data-toggle=tab], [data-toggle=pill]').attr({ 'tabIndex': '0', 'aria-selected': true })
        element.filter('.tab-pane').attr({ 'aria-hidden': false, 'tabIndex': '0' })
    }

    // Collapse Extension
    // ===============================

    var $colltabs = $('[data-toggle="collapse"]')
    $colltabs.each(function (index) {
        var colltab = $(this)
            , collpanel = (colltab.attr('data-target')) ? $(colltab.attr('data-target')) : $(colltab.attr('href'))
            , parent = colltab.attr('data-parent')
            , collparent = parent && $(parent)
            , collid = colltab.attr('id') || uniqueId('ui-collapse')

        colltab.attr('id', collid)

        if (collparent) {
            colltab.attr({ 'role': 'tab', 'aria-selected': 'false', 'aria-expanded': 'false' })
            // $(collparent).find('div:not(.collapse,.panel-body), h4').attr('role', 'presentation')
            collparent.attr({ 'role': 'tablist', 'aria-multiselectable': 'true' })

            if (collpanel.hasClass('in')) {
                colltab.attr({ 'aria-controls': collpanel.attr('id'), 'aria-selected': 'true', 'aria-expanded': 'true', 'tabindex': '0' })
                collpanel.attr({ 'tabindex': '0', 'aria-labelledby': collid, 'aria-hidden': 'false' })
            } else {
                colltab.attr({ 'aria-controls': collpanel.attr('id'), 'tabindex': '-1' })
                collpanel.attr({  'tabindex': '-1', 'aria-labelledby': collid, 'aria-hidden': 'true' })
            }
        }
    })

    var collToggle = $.fn.collapse.Constructor.prototype.toggle
    $.fn.collapse.Constructor.prototype.toggle = function () {
        var prevTab = this.$parent && this.$parent.find('[aria-expanded="true"]'), href

        if (prevTab) {
            var prevPanel = prevTab.attr('data-target') || (href = prevTab.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')
                , $prevPanel = $(prevPanel)
                , $curPanel = this.$element
                , par = this.$parent
                , curTab

            if (this.$parent) curTab = this.$parent.find('[data-toggle=collapse][href="#' + this.$element.attr('id') + '"]')

            collToggle.apply(this, arguments)

            if ($.support.transition) {
                this.$element.one($.support.transition.end, function () {

                    prevTab.attr({ 'aria-selected': 'false', 'aria-expanded': 'false', 'tabIndex': '-1' })
                    $prevPanel.attr({ 'aria-hidden': 'true', 'tabIndex': '-1' })

                    curTab.attr({ 'aria-selected': 'true', 'aria-expanded': 'true', 'tabIndex': '0' })

                    if ($curPanel.hasClass('in')) {
                        $curPanel.attr({ 'aria-hidden': 'false', 'tabIndex': '0' })
                    } else {
                        curTab.attr({ 'aria-selected': 'false', 'aria-expanded': 'false' })
                        $curPanel.attr({ 'aria-hidden': 'true', 'tabIndex': '-1' })
                    }
                })
            }
        } else {
            collToggle.apply(this, arguments)
        }
    }

    $.fn.collapse.Constructor.prototype.keydown = function (e) {
        var $this = $(this)
            , $items
            , $tablist = $this.closest('div[role=tablist] ')
            , index
            , k = e.which || e.keyCode

        $this = $(this)
        if (!/(32|37|38|39|40)/.test(k)) return
        if (k == 32) $this.click()

        $items = $tablist.find('[role=tab]')
        index = $items.index($items.filter(':focus'))

        if (k == 38 || k == 37) index--                                        // up & left
        if (k == 39 || k == 40) index++                        // down & right
        if (index < 0) index = $items.length - 1
        if (index == $items.length) index = 0

        $items.eq(index).focus()

        e.preventDefault()
        e.stopPropagation()

    }

    $(document).on('keydown.collapse.data-api', '[data-toggle="collapse"]', $.fn.collapse.Constructor.prototype.keydown);


    // ==========================
    // Carousel Extension
    // ===============================

    $('.carousel').each(function (index) {

        // This function positions a highlight box around the tabs in the tablist to use in focus styling

        function setTablistHighlightBox() {

            var $tab
                , offset
                , height
                , width
                , highlightBox = {}

            highlightBox.top = 0
            highlightBox.left = 32000
            highlightBox.height = 0
            highlightBox.width = 0

            for (var i = 0; i < $tabs.length; i++) {
                $tab = $tabs[i]
                offset = $($tab).offset()
                height = $($tab).height()
                width = $($tab).width()

                // console.log(" Top: " + offset.top + " Left: " + offset.left + " Height: " + height + " Width: " + width)

                if (highlightBox.top < offset.top) {
                    highlightBox.top = Math.round(offset.top)
                }

                if (highlightBox.height < height) {
                    highlightBox.height = Math.round(height)
                }

                if (highlightBox.left > offset.left) {
                    highlightBox.left = Math.round(offset.left)
                }

                var w = (offset.left - highlightBox.left) + Math.round(width)

                if (highlightBox.width < w) {
                    highlightBox.width = w
                }
            } // end for

            // console.log("[HIGHLIGHT]  Top: " +  highlightBox.top + " Left: " +  highlightBox.left + " Height: " +  highlightBox.height + " Width: " +  highlightBox.width)

            $tablistHighlight.style.top = (highlightBox.top - 2) + 'px'
            $tablistHighlight.style.left = (highlightBox.left - 2) + 'px'
            $tablistHighlight.style.height = (highlightBox.height + 7) + 'px'
            $tablistHighlight.style.width = (highlightBox.width + 8) + 'px'

        } // end function

        // get view id
        var view_id = $(this).attr('id');

        var $this = $(this)
            , $prev = $this.find('[data-slide="prev"]')
            , $next = $this.find('[data-slide="next"]')
            , $tablist = $this.find('.carousel-indicators')
            , $tabs = $this.find('.carousel-indicators li')
            , $tabpanels = $this.find('.item')
            , $tabpanel
            , $tablistHighlight
            , $pauseCarousel
            , $complementaryLandmark
            , $tab
            , $is_paused = false
            , offset
            , height
            , width
            , i
            , id_title = view_id + '-id-title'
            , id_desc = view_id + '-id-desc'


        //$tablist.attr('role', 'tablist')

        $tabs.focus(function () {
            $this.carousel('pause')
            $is_paused = true
            //$pauseCarousel.innerHTML = "Activa el carrusel de imágenes"
            $(this).parent().addClass('active');
            // $(this).addClass('focus')
            setTablistHighlightBox()
            $($tablistHighlight).addClass('focus')
            $(this).parents('.carousel').addClass('contrast')
        })

        $tabs.blur(function (event) {
            $(this).parent().removeClass('active');
            // $(this).removeClass('focus')
            $($tablistHighlight).removeClass('focus')
            $(this).parents('.carousel').removeClass('contrast')
        })


        for (i = 0; i < $tabpanels.length; i++) {
            $tabpanel = $tabpanels[i]
            //$tabpanel.setAttribute('role', 'tabpanel')
            $tabpanel.setAttribute('id', 'tabpanel-' + index + '-' + i)
            $tabpanel.setAttribute('aria-labelledby', 'tab-' + index + '-' + i)
        }

        if (typeof $this.attr('role') !== 'string') {
            $this.attr('role', 'complementary');
            $this.attr('aria-labelledby', id_title);
            $this.attr('aria-describedby', id_desc);
        }


        for (i = 0; i < $tabs.length; i++) {
            $tab = $tabs[i]

            $tab.setAttribute('role', 'tab')
            $tab.setAttribute('id', 'tab-' + index + '-' + i)
            $tab.setAttribute('aria-controls', 'tabpanel-' + index + '-' + i)

            var tpId = '#tabpanel-' + index + '-' + i
            var caption = $this.find(tpId).find('h1').text()

            if ((typeof caption !== 'string') || (caption.length === 0)) caption = $this.find(tpId).text()
            if ((typeof caption !== 'string') || (caption.length === 0)) caption = $this.find(tpId).find('h3').text()
            if ((typeof caption !== 'string') || (caption.length === 0)) caption = $this.find(tpId).find('h4').text()
            if ((typeof caption !== 'string') || (caption.length === 0)) caption = $this.find(tpId).find('h5').text()
            if ((typeof caption !== 'string') || (caption.length === 0)) caption = $this.find(tpId).find('h6').text()
            if ((typeof caption !== 'string') || (caption.length === 0)) caption = "no title";

            // console.log("CAPTION: " + caption )

            var tabName = document.createElement('span')
            tabName.setAttribute('class', 'sr-only')
            tabName.innerHTML = 'diapositiva ' + (i + 1)
            if (caption) tabName.innerHTML += ": " + caption
            $tab.appendChild(tabName)
        }

        // create div for focus styling of tablist
        $tablistHighlight = document.createElement('div')
        $tablistHighlight.className = 'carousel-tablist-highlight'
        document.body.appendChild($tablistHighlight)

        // create button for screen reader users to stop rotation of carousel

        /* create button for screen reader users to pause carousel for virtual mode review
        $complementaryLandmark = document.createElement('aside')
        $complementaryLandmark.setAttribute('class', 'carousel-aside-pause')
        $complementaryLandmark.setAttribute('aria-label', 'Control de pausa y avance de diapositivas del Carrusel')
        $this.prepend($complementaryLandmark)

        $pauseCarousel = document.createElement('button')
        $pauseCarousel.className = "carousel-pause-button"
        $pauseCarousel.innerHTML = "Detener el carrusel de diapositivas"
        $pauseCarousel.setAttribute('title', "botón de iniciar y detener carrusel puede ser utilizado por los usuarios de lectores de pantalla para detener las animaciones de carrusel")
        $($complementaryLandmark).append($pauseCarousel)

        $($pauseCarousel).click(function () {
            if ($is_paused) {
                $pauseCarousel.innerHTML = "Detener el carrusel de diapositivas"
                $this.carousel('cycle')
                $is_paused = false
            }
            else {
                $pauseCarousel.innerHTML = "Iniciar el carrusel de diapositivas"
                $this.carousel('pause')
                $is_paused = true
            }
        })
        $($pauseCarousel).focus(function () {
            $(this).addClass('focus')
        })

        $($pauseCarousel).blur(function () {
            $(this).removeClass('focus')
        })

        setTablistHighlightBox()

        $(window).resize(function () {
            setTablistHighlightBox()
        })
        */

        // Add space bar behavior to prev and next buttons for SR compatibility
        $prev.attr('aria-label', 'diapositiva anterior')
        $prev.keydown(function (e) {
            var k = e.which || e.keyCode
            if (/(13|32)/.test(k)) {
                e.preventDefault()
                e.stopPropagation()
                $prev.trigger('click');
            }
        });

        $prev.focus(function () {
            $(this).parents('.carousel').addClass('contrast')
        })

        $prev.blur(function () {
            $(this).parents('.carousel').removeClass('contrast')
        })

        $next.attr('aria-label', 'diapositiva siguiente')
        $next.keydown(function (e) {
            var k = e.which || e.keyCode
            if (/(13|32)/.test(k)) {
                e.preventDefault()
                e.stopPropagation()
                $next.trigger('click');
            }
        });

        $next.focus(function () {
            $(this).parents('.carousel').addClass('contrast')
        })

        $next.blur(function () {
            $(this).parents('.carousel').removeClass('contrast')
        })

        $('.carousel-inner a').focus(function () {
            $(this).parents('.carousel').addClass('contrast')
        })

        $('.carousel-inner a').blur(function () {
            $(this).parents('.carousel').removeClass('contrast')
        })

        $tabs.each(function () {
            var item = $(this)
            if (item.hasClass('active')) {
                item.attr({ 'aria-selected': 'true', 'tabindex': '0' })
            } else {
                item.attr({ 'aria-selected': 'false', 'tabindex': '-1' })
            }
        })
    })

    var slideCarousel = $.fn.carousel.Constructor.prototype.slide
    $.fn.carousel.Constructor.prototype.slide = function (type, next) {
        var $element = this.$element
            , $active = $element.find('[role=group].active')
            , $next = next || $active[type]()
            , $tab
            , $tab_count = $element.find('[role=group]').length
            , $prev_side = $element.find('[data-slide="prev"]')
            , $next_side = $element.find('[data-slide="next"]')
            , $index = 0
            , $prev_index = $tab_count - 1
            , $next_index = 1
            , $id

        if ($next && $next.attr('id')) {
            $id = $next.attr('id')
            $index = $id.lastIndexOf("-")
            if ($index >= 0) $index = parseInt($id.substring($index + 1), 10)

            $prev_index = $index - 1
            if ($prev_index < 1) $prev_index = $tab_count - 1

            $next_index = $index + 1
            if ($next_index >= $tab_count) $next_index = 0
        }

        $prev_side.attr('aria-label', 'Mostrar noticia ' + ($prev_index + 1) + ' de ' + $tab_count)
        $next_side.attr('aria-label', 'Mostrar noticia  ' + ($next_index + 1) + ' de ' + $tab_count)


        slideCarousel.apply(this, arguments)

        $active
            .one('bsTransitionEnd', function () {
                var $tab

                $tab = $element.find('li[aria-controls="' + $active.attr('id') + '"]')
                if ($tab) $tab.attr({ 'aria-selected': false, 'tabIndex': '-1' })

                $tab = $element.find('li[aria-controls="' + $next.attr('id') + '"]')
                if ($tab) $tab.attr({ 'aria-selected': true, 'tabIndex': '0' })

            })
    }

    var $this;
    $.fn.carousel.Constructor.prototype.keydown = function (e) {

        $this = $this || $(this)
        if (this instanceof Node) $this = $(this)

        function selectTab(index) {
            if (index >= $tabs.length) return
            if (index < 0) return

            $carousel.carousel(index)
            setTimeout(function () {
                $tabs[index].focus()
                // $this.prev().focus()
            }, 150)
        }

        var $carousel = $(e.target).closest('.carousel')
            , $tabs = $carousel.find('[role=tab]')
            , k = e.which || e.keyCode
            , index

        if (!/(37|38|39|40)/.test(k)) return

        index = $tabs.index($tabs.filter('.active'))
        if (k == 37 || k == 38) {                           //  Up
            index--
            selectTab(index);
        }

        if (k == 39 || k == 40) {                          // Down
            index++
            selectTab(index);
        }

        e.preventDefault()
        e.stopPropagation()
    }
    $(document).on('keydown.carousel.data-api', 'li[role=tab]', $.fn.carousel.Constructor.prototype.keydown);

})(jQuery);
;

var fileExtensionsArray = new Object();

fileExtensionsArray['pdf'] = {
    "color" : ' list-icons ',
    "icon" : ' icon-pdf ',
    "typeFile": ' Archivo Pdf '
};

fileExtensionsArray['doc'] = {
    "color" : ' word-icons ',
    "icon" : ' icon-doc-word ',
    "typeFile": 'Archivo Word '
};

fileExtensionsArray['docx'] = {
    "color" : ' word-icons ',
    "icon" : ' icon-doc-word ',
    "typeFile": ' Archivo Word '
};

fileExtensionsArray['rtf'] = {
    "color" : ' word-icons ',
    "icon" : ' icon-doc-word ',
    "typeFile": ' Archivo Word '
};

fileExtensionsArray['xls'] = {
    "color" : ' excel-icons ',
    "icon" : ' icon-excel ',
    "typeFile": 'Archivo Excel '
};

fileExtensionsArray['xlsx'] = {
    "color" : ' excel-icons ',
    "icon" : ' icon-excel ',
    "typeFile": ' Archivo Excel '
};

fileExtensionsArray['avi'] = {
    "color" : ' list-blue-icons ',
    "icon" : ' icon-videos ',
    "typeFile": ' Archivo Avi '
};

fileExtensionsArray['mp4'] = {
    "color" : ' list-blue-icons ',
    "icon" : ' icon-videos ',
    "typeFile": ' Archivo Mp4 '
};

fileExtensionsArray['mp3'] = {
    "color" : ' list-blue-icons ',
    "icon" : ' icon-audio ',
    "typeFile": ' Archivo Mp3 '
};

fileExtensionsArray['rar'] = {
    "color" : ' list-blue-icons ',
    "icon" : ' icon-zip ',
    "typeFile": ' Archivo rar '
};

fileExtensionsArray['zip'] = {
    "color" : ' list-blue-icons ',
    "icon" : ' icon-zip ',
    "typeFile": ' Archivo zip '
};

function fileExtension(file) {
    return file.substr((file.lastIndexOf('.') +1)).toLowerCase();
}

function composeLink(extension, filepath, texttospeech){
    color = ' list-icons ';
    icon = ' icon-pdf';
    typeFile = ' Archivo ';
    if (fileExtensionsArray.hasOwnProperty(extension)){
        color = fileExtensionsArray[extension].color;
        icon = fileExtensionsArray[extension].icon;
        typeFile = fileExtensionsArray[extension].typeFile;
    }

    return '<a href="'+filepath+'" aria-label="Se abrirá el '+typeFile+' correspondiente a '+texttospeech+' en una ventana nueva" class="scjn-icon-file">'+
        '<div class="media-left '+color+'">'+
            '<em class="icons-vdos '+icon+'">&nbsp;</em>'+
        '</div>'+
    '</a>';

};
'use strict';
(function($) {

  $(window).scroll(function(){
		if ($(this).scrollTop() > 100) {
			$('#scroll-to-top').fadeIn();
		} else {
			$('#scroll-to-top').fadeOut();
		}
	});

	// Click event to scroll to top
	$('#scroll-to-top').click(function(event){
		$('html, body').stop().animate({ scrollTop : 0 }, 600);
	});

})(jQuery);
;
"use strict"
jQuery(document).ready(function($){
	$("nav").removeAttr("role");
	// $('.menu a[target="_blank"]').parent().removeAttr("aria-label");
	// $('.menu a[target="_blank"]').attr('aria-label', 'Este enlace se abrirá en una nueva ventana');
	$('#formulario_busqueda').validator();
    $('#contact-message-feedback-form').validator();
    
    $.each($('#contact-message-feedback-form input'), function(key,value){
        $(value).after("<div class=\"help-block with-errors\"></div>");
    });

	$.each($('#contact-message-feedback-form textarea'), function(key,value){
		$(value).after("<div class=\"help-block with-errors\"></div>");
	});

	$('#contact-message-feedback-form').before("<div class=\"row \"><p class=\"bg-info informative\">Las entradas con <strong>*</strong> son requeridas</p></div>");
	$('#contact-message-feedback-form #edit-name').attr('data-error','Por favor, llene el campo Nombre, por ejemplo: Martín López');
	$('#contact-message-feedback-form #edit-mail').attr('data-error','Por favor, llene el campo Correo Electrónico, por ejemplo: martinlopez@correo.com');
	$('#contact-message-feedback-form #edit-message-0-value').attr('data-error','Por favor, llene el campo Mensaje con sus comentarios hacia este Alto Tribunal');
	$('#contact-message-feedback-form').wrapInner('<fieldset id="field_wrapper"></fieldset>');
    $('#field_wrapper').append('<legend>Queremos conocer su opinión</legend>');
    
	$.each($('.table span.accesible_id'),function(key,value){
		$(value).parent().attr('id',$(value).attr('id'));
		$(value).removeAttr('id');
	});

	// Change behavior for table's file listing
	$(".tabla-listado-archivos caption").text("Tabla de archivos relacionados con " + $('h1:first').text());
	$(".tabla-listado-archivos tr:empty").remove();
	$.each($(".tabla-listado-archivos tbody tr"),function(){
		if( $(this).find("td").length  < 2 ){
			$(this).append('<td><p class="sr-only">No hay un archivo para esta entrada</p></td>')
		}
	});
	$.each($(".tabla-listado-archivos span.file a "), function(){
		var filepath = $(this).attr('href');
		var extension = fileExtension(filepath);
		var texttospeech = $(this).parents().eq(2).prev().text();
		var htmlCompose = composeLink(extension,filepath, texttospeech);
		
		$(this).parent().parent().replaceWith('<div>'+htmlCompose+'</div>');
	});
	// Change text for dropdown /pleno/secretaria-general-de-acuerdos/circulares-emitidas-por-la-secretaria-general-de-acuerdos
	$("#edit-field-c8ssga-tipo-target-id option[value=All]").text('Tipo de Circular');


});

;
jQuery(document).ready(function($){
  //Nombre del campo en la vista
  // .views-field-field-anexo-est-documento - Anexo Estadistico
  // .views-field-field-c1ss4n-documentos - Convocatorias para Sesion
  // .views-field-field-p12sc10n-documento - Procedimientos de Contratación
  // .views-field-field-c9sgentrab-documento-word - Condiciones Generales de Trabajo
  // .views-field-field-i6st11a-documento-anual - Informes de Transparencia
  // .views-field-field-h7oi9na12a-archivo - Histórico de Información Otorgada a Particulares - Administrativa
  // .views-field-field-e5on12s-resolucion -Estrado electrónico de notificaciones a peticionarios
  // .media-switch - Clase genérica para cambio de icono
  $('.views-field-field-anexo-est-documento .media, .views-field-field-c1ss4n-documentos .media, .views-field-field-p12sc10n-documento .media, .views-field-field-c9sgentrab-documento-word .media, .views-field-field-i6st11a-documento-anual .media, .views-field-field-h7oi9na12a-archivo .media, .views-field-field-e5on12s-resolucion .media, .media.switch').each(function () {
    // Añadimos una clase al vínculo como referencia
    $(this).find('a[href$=".pdf"]').addClass("pdf");
    $(this).find('a[href$=".xls"]').addClass("xls");
    $(this).find('a[href$=".xlsx"]').addClass("xls");
    $(this).find('a[href$=".doc"]').addClass("doc");
    $(this).find('a[href$=".docx"]').addClass("doc");
    $(this).find('a[href$=".zip"]').addClass("zip");
    $(this).find('a[href$=".mp4"]').addClass("mp4");
    $(this).find('a[href$=".avi"]').addClass("avi");

    //Si el vinculo tiene la clase determinada eliminamos color e icono y añadimos nuevo aria (Accesibilidad)
    if($(this).find('a').hasClass("xls")) {
      $(this).find('a').attr("aria-describedby", "nota_excel");
      $(this).find('.media-left').removeClass('list-icons').addClass('excel-icons');
      $(this).find('.icons-vdos').removeClass('icon-pdf').addClass('icon-excel');
    }
    else if ($(this).find('a').hasClass("doc")) {
      $(this).find('a').attr("aria-describedby", "nota_word");
      $(this).find('.media-left').removeClass('list-icons').addClass('word-icons');
      $(this).find('.icons-vdos').removeClass('icon-pdf').addClass('icon-doc-word');
    }
    else if ($(this).find('a').hasClass("zip")) {
      $(this).find('a').attr("aria-describedby", "nota_zip");
      $(this).find('.media-left').removeClass('list-icons').addClass('list-blue-icons');
      $(this).find('.icons-vdos').removeClass('icon-pdf').addClass('icon-zip');
    }
    else if ($(this).find('a').hasClass("mp4")) {
      $(this).find('a').attr("aria-describedby", "nota_video");
      $(this).find('.media-left').removeClass('list-icons').addClass('list-blue-icons');
      $(this).find('.icons-vdos').removeClass('icon-pdf').addClass('icon-videos');
    }
    else if ($(this).find('a').hasClass("avi")) {
      $(this).find('a').attr("aria-describedby", "nota_video_avi");
      $(this).find('.media-left').removeClass('list-icons').addClass('list-blue-icons');
      $(this).find('.icons-vdos').removeClass('icon-pdf').addClass('icon-videos');
    }
  });

});
;
"use strict"
jQuery(document).ready(function($){

	$('.multi-item-carousel').carousel({
	    interval: 5000
	});

	$('.multi-item-carousel .item').each(function(){
	    var next = $(this).next();
	    if (!next.length) {
	        next = $(this).siblings(':first');
	    }
	    next.children(':first-child').clone().appendTo($(this));

	    if (next.next().length>0) {
	        next.next().children(':first-child').clone().appendTo($(this));
	    } else {
	  	    $(this).siblings(':first').children(':first-child').clone().appendTo($(this));
	    }
	});
});
;
jQuery(document).ready(function($){

  var extension='';
  var color='';
  var icon='';
  var label='';
  var typeFile='';
  var newLabel='';

  $('.media.accesibillity, .tabla-listado-archivos.file-link').each(function () {
    // Obtenemos extensión de cada enlace
    extension = fileExtension($(this).find('a').attr('href'));
    // Buscamos anchoy añadimos la clase según la extensión
    $(this).find('a').addClass(extension);
    // Añadimos color, tipo de icono y atributos aria
    $(this).find('.media-left').removeClass('list-icons');
    $(this).find('.icons-vdos').removeClass('icon-pdf');

    switch ($(this).find('a').attr('class')) {
      case 'pdf':
        color = 'list-icons';
        icon ='icon-pdf';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Pdf";
        newLabel = label.concat(typeFile);
      break;
      case 'doc':
      case 'docx':
        color = 'word-icons';
        icon ='icon-doc-word';
        label = $(this).find('a').attr('aria-label');
        typeFile = "Archivo Word";
        newLabel = label.concat(typeFile);
      break;
      case 'rtf':
        color = 'word-icons';
        icon ='icon-doc-word';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Rtf";
        newLabel = label.concat(typeFile);
      break;
      case 'xls':
      case 'xlsx':
        color = 'excel-icons';
        icon ='icon-excel';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Excel";
        newLabel = label.concat(typeFile);
      break;
      case 'avi':
        color = 'list-blue-icons';
        icon ='icon-videos';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Avi";
        newLabel = label.concat(typeFile);
      break;
      case 'mp4':
        color = 'list-blue-icons';
        icon ='icon-videos';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Mp4";
        newLabel = label.concat(typeFile);
      break;
      case 'mp3':
        color = 'list-blue-icons';
        icon ='icon-audio';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Mp3";
        newLabel = label.concat(typeFile);
      break;
      case 'rar':
        color = 'list-blue-icons';
        icon ='icon-zip';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Rar";
        newLabel = label.concat(typeFile);
      break;
      case 'zip':
        color = 'list-blue-icons';
        icon ='icon-zip';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Zip";
        newLabel = label.concat(typeFile);
      break;
      default:
        color = 'list-icons';
        icon ='icon-pdf';
        label = $(this).find('a').attr('aria-label');
        typeFile = " Archivo Pdf";
      break;
    }
    $(this).find('.media-left').addClass(color);
    $(this).find('.icons-vdos').addClass(icon);
    $(this).find('a').attr('aria-label', newLabel);
  });
  function fileExtension(file) {
    return file.substr((file.lastIndexOf('.') +1)).toLowerCase();
  }

});
;
/* ========================================================================
 * Bootstrap (plugin): validator.js v0.11.5
 * ========================================================================
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Cina Saffary.
 * Made by @1000hz in the style of Bootstrap 3 era @fat
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * ======================================================================== */


+function ($) {
  'use strict';

  // VALIDATOR CLASS DEFINITION
  // ==========================

  function getValue($el) {
    return $el.is('[type="checkbox"]') ? $el.prop('checked')                                     :
           $el.is('[type="radio"]')    ? !!$('[name="' + $el.attr('name') + '"]:checked').length :
                                         $el.val()
  }

  var Validator = function (element, options) {
    this.options    = options
    this.validators = $.extend({}, Validator.VALIDATORS, options.custom)
    this.$element   = $(element)
    this.$btn       = $('button[type="submit"], input[type="submit"]')
                        .filter('[form="' + this.$element.attr('id') + '"]')
                        .add(this.$element.find('input[type="submit"], button[type="submit"]'))

    this.update()

    this.$element.on('input.bs.validator change.bs.validator focusout.bs.validator', $.proxy(this.onInput, this))
    this.$element.on('submit.bs.validator', $.proxy(this.onSubmit, this))
    this.$element.on('reset.bs.validator', $.proxy(this.reset, this))

    this.$element.find('[data-match]').each(function () {
      var $this  = $(this)
      var target = $this.data('match')

      $(target).on('input.bs.validator', function (e) {
        getValue($this) && $this.trigger('input.bs.validator')
      })
    })

    this.$inputs.filter(function () { return getValue($(this)) }).trigger('focusout')

    this.$element.attr('novalidate', true) // disable automatic native validation
    this.toggleSubmit()
  }

  Validator.VERSION = '0.11.5'

  Validator.INPUT_SELECTOR = ':input:not([type="hidden"], [type="submit"], [type="reset"], button)'

  Validator.FOCUS_OFFSET = 20

  Validator.DEFAULTS = {
    delay: 500,
    html: false,
    disable: true,
    focus: true,
    custom: {},
    errors: {
      match: 'Does not match',
      minlength: 'Not long enough'
    },
    feedback: {
      success: 'glyphicon-ok',
      error: 'glyphicon-remove'
    }
  }

  Validator.VALIDATORS = {
    'native': function ($el) {
      var el = $el[0]
      if (el.checkValidity) {
        return !el.checkValidity() && !el.validity.valid && (el.validationMessage || "error!")
      }
    },
    'match': function ($el) {
      var target = $el.data('match')
      return $el.val() !== $(target).val() && Validator.DEFAULTS.errors.match
    },
    'minlength': function ($el) {
      var minlength = $el.data('minlength')
      return $el.val().length < minlength && Validator.DEFAULTS.errors.minlength
    }
  }

  Validator.prototype.update = function () {
    this.$inputs = this.$element.find(Validator.INPUT_SELECTOR)
      .add(this.$element.find('[data-validate="true"]'))
      .not(this.$element.find('[data-validate="false"]'))

    return this
  }

  Validator.prototype.onInput = function (e) {
    var self        = this
    var $el         = $(e.target)
    var deferErrors = e.type !== 'focusout'

    if (!this.$inputs.is($el)) return

    this.validateInput($el, deferErrors).done(function () {
      self.toggleSubmit()
    })
  }

  Validator.prototype.validateInput = function ($el, deferErrors) {
    var value      = getValue($el)
    var prevErrors = $el.data('bs.validator.errors')
    var errors

    if ($el.is('[type="radio"]')) $el = this.$element.find('input[name="' + $el.attr('name') + '"]')

    var e = $.Event('validate.bs.validator', {relatedTarget: $el[0]})
    this.$element.trigger(e)
    if (e.isDefaultPrevented()) return

    var self = this

    return this.runValidators($el).done(function (errors) {
      $el.data('bs.validator.errors', errors)

      errors.length
        ? deferErrors ? self.defer($el, self.showErrors) : self.showErrors($el)
        : self.clearErrors($el)

      if (!prevErrors || errors.toString() !== prevErrors.toString()) {
        e = errors.length
          ? $.Event('invalid.bs.validator', {relatedTarget: $el[0], detail: errors})
          : $.Event('valid.bs.validator', {relatedTarget: $el[0], detail: prevErrors})

        self.$element.trigger(e)
      }

      self.toggleSubmit()

      self.$element.trigger($.Event('validated.bs.validator', {relatedTarget: $el[0]}))
    })
  }


  Validator.prototype.runValidators = function ($el) {
    var errors   = []
    var deferred = $.Deferred()

    $el.data('bs.validator.deferred') && $el.data('bs.validator.deferred').reject()
    $el.data('bs.validator.deferred', deferred)

    function getValidatorSpecificError(key) {
      return $el.data(key + '-error')
    }

    function getValidityStateError() {
      var validity = $el[0].validity
      return validity.typeMismatch    ? $el.data('type-error')
           : validity.patternMismatch ? $el.data('pattern-error')
           : validity.stepMismatch    ? $el.data('step-error')
           : validity.rangeOverflow   ? $el.data('max-error')
           : validity.rangeUnderflow  ? $el.data('min-error')
           : validity.valueMissing    ? $el.data('required-error')
           :                            null
    }

    function getGenericError() {
      return $el.data('error')
    }

    function getErrorMessage(key) {
      return getValidatorSpecificError(key)
          || getValidityStateError()
          || getGenericError()
    }

    $.each(this.validators, $.proxy(function (key, validator) {
      var error = null
      if ((getValue($el) || $el.attr('required')) &&
          ($el.data(key) || key == 'native') &&
          (error = validator.call(this, $el))) {
         error = getErrorMessage(key) || error
        !~errors.indexOf(error) && errors.push(error)
      }
    }, this))

    if (!errors.length && getValue($el) && $el.data('remote')) {
      this.defer($el, function () {
        var data = {}
        data[$el.attr('name')] = getValue($el)
        $.get($el.data('remote'), data)
          .fail(function (jqXHR, textStatus, error) { errors.push(getErrorMessage('remote') || error) })
          .always(function () { deferred.resolve(errors)})
      })
    } else deferred.resolve(errors)

    return deferred.promise()
  }

  Validator.prototype.validate = function () {
    var self = this

    $.when(this.$inputs.map(function (el) {
      return self.validateInput($(this), false)
    })).then(function () {
      self.toggleSubmit()
      self.focusError()
    })

    return this
  }

  Validator.prototype.focusError = function () {
    if (!this.options.focus) return

    var $input = this.$element.find(".has-error:first :input")
    if ($input.length === 0) return

    $('html, body').animate({scrollTop: $input.offset().top - Validator.FOCUS_OFFSET}, 250)
    $input.focus()
  }

  Validator.prototype.showErrors = function ($el) {
    var method = this.options.html ? 'html' : 'text'
    var errors = $el.data('bs.validator.errors')
    var $group = $el.closest('.form-group')
    var $block = $group.find('.help-block.with-errors')
    var $feedback = $group.find('.form-control-feedback')

    if (!errors.length) return

    errors = $('<ul/>')
      .addClass('list-unstyled')
      .append($.map(errors, function (error) { return $('<li/>')[method](error) }))

    $block.data('bs.validator.originalContent') === undefined && $block.data('bs.validator.originalContent', $block.html())
    $block.empty().append(errors)
    $group.addClass('has-error has-danger')

    $group.hasClass('has-feedback')
      && $feedback.removeClass(this.options.feedback.success)
      && $feedback.addClass(this.options.feedback.error)
      && $group.removeClass('has-success')
  }

  Validator.prototype.clearErrors = function ($el) {
    var $group = $el.closest('.form-group')
    var $block = $group.find('.help-block.with-errors')
    var $feedback = $group.find('.form-control-feedback')

    $block.html($block.data('bs.validator.originalContent'))
    $group.removeClass('has-error has-danger has-success')

    $group.hasClass('has-feedback')
      && $feedback.removeClass(this.options.feedback.error)
      && $feedback.removeClass(this.options.feedback.success)
      && getValue($el)
      && $feedback.addClass(this.options.feedback.success)
      && $group.addClass('has-success')
  }

  Validator.prototype.hasErrors = function () {
    function fieldErrors() {
      return !!($(this).data('bs.validator.errors') || []).length
    }

    return !!this.$inputs.filter(fieldErrors).length
  }

  Validator.prototype.isIncomplete = function () {
    function fieldIncomplete() {
      var value = getValue($(this))
      return !(typeof value == "string" ? $.trim(value) : value)
    }

    return !!this.$inputs.filter('[required]').filter(fieldIncomplete).length
  }

  Validator.prototype.onSubmit = function (e) {
    this.validate()
    if (this.isIncomplete() || this.hasErrors()) e.preventDefault()
  }

  Validator.prototype.toggleSubmit = function () {
    if (!this.options.disable) return
    this.$btn.toggleClass('disabled', this.isIncomplete() || this.hasErrors())
  }

  Validator.prototype.defer = function ($el, callback) {
    callback = $.proxy(callback, this, $el)
    if (!this.options.delay) return callback()
    window.clearTimeout($el.data('bs.validator.timeout'))
    $el.data('bs.validator.timeout', window.setTimeout(callback, this.options.delay))
  }

  Validator.prototype.reset = function () {
    this.$element.find('.form-control-feedback')
      .removeClass(this.options.feedback.error)
      .removeClass(this.options.feedback.success)

    this.$inputs
      .removeData(['bs.validator.errors', 'bs.validator.deferred'])
      .each(function () {
        var $this = $(this)
        var timeout = $this.data('bs.validator.timeout')
        window.clearTimeout(timeout) && $this.removeData('bs.validator.timeout')
      })

    this.$element.find('.help-block.with-errors')
      .each(function () {
        var $this = $(this)
        var originalContent = $this.data('bs.validator.originalContent')

        $this
          .removeData('bs.validator.originalContent')
          .html(originalContent)
      })

    this.$btn.removeClass('disabled')

    this.$element.find('.has-error, .has-danger, .has-success').removeClass('has-error has-danger has-success')

    return this
  }

  Validator.prototype.destroy = function () {
    this.reset()

    this.$element
      .removeAttr('novalidate')
      .removeData('bs.validator')
      .off('.bs.validator')

    this.$inputs
      .off('.bs.validator')

    this.options    = null
    this.validators = null
    this.$element   = null
    this.$btn       = null

    return this
  }

  // VALIDATOR PLUGIN DEFINITION
  // ===========================


  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var options = $.extend({}, Validator.DEFAULTS, $this.data(), typeof option == 'object' && option)
      var data    = $this.data('bs.validator')

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.validator', (data = new Validator(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.validator

  $.fn.validator             = Plugin
  $.fn.validator.Constructor = Validator


  // VALIDATOR NO CONFLICT
  // =====================

  $.fn.validator.noConflict = function () {
    $.fn.validator = old
    return this
  }


  // VALIDATOR DATA-API
  // ==================

  $(window).on('load', function () {
    $('form[data-toggle="validator"]').each(function () {
      var $form = $(this)
      Plugin.call($form, $form.data())
    })
  })

}(jQuery);
;
/*! For license information please see webchat.js.LICENSE.txt */
document.addEventListener('DOMContentLoaded', function load() {
    if (!window.jQuery) return setTimeout(load, 50);

    jQuery(document).ready(function($) {
        const chatbot = $('#chatbot-container');
        const chatbotButton = $('#chatbot-button');

        $('#chatbot-button').click(function() {
            if (chatbot.hasClass('hidden')) {
                chatbot.removeClass('hidden');
                chatbotButton.addClass('hidden');

                // Código para renderizar el chat
                const styleOptions = {
                    accent: '#003A70',
                    backgroundColor: '#FFFFFF',
                    botAvatarInitials: 'SC',
                    botAvatarImage: '/themes/internet_subtheme/images/scjn-icono-chatbot.svg',
                    bubbleBackground: '#f2f2f2',
                    bubbleBorderRadius: 5,
                    bubbleBorderStyle: 'solid',
                    bubbleBorderWidth: 1,
                    bubbleBorderColor: '#003A70',

                    userAvatarInitials: 'US',
                    userAvatarImage: '/themes/internet_subtheme/images/usuario-icono-chatbot.svg',
                    bubbleFromUserBackground: '#bbd9f0',
                    bubbleFromUserBorderRadius: 5,
                    bubbleFromUserBorderStyle: 'solid',
                    bubbleFromUserBorderWidth: 1,
                    bubbleFromUserBorderColor: '#487495',
                    hideUploadButton: true,
                    sendBoxButtonColor: '#FFFFFF',
                    sendBoxButtonColorOnDisabled: '#003A70',
                    sendBoxButtonColorOnFocus: '#01274F',
                    sendBoxButtonColorOnHover: '#01274F',
                    sendBoxBackground: '#487495',
                    sendBoxTextColor: '#FFFFFF',
                    sendBoxPlaceholderColor: '#f2f2f2',
                    markdownExternalLinkIconImage: null,
                    suggestedActionLayout: 'stacked',
                    suggestedActionBorderColor: '#003A70',
                    suggestedActionBorderRadius: 5,
                    suggestedActionBorderStyle: 'solid',
                    suggestedActionBorderWidth: 1,
                    suggestedActionHeight: 30,
                }

                var theURL = "https://default0c06ec01e5aa4e548811bb99870b0c.77.environment.api.powerplatform.com/powervirtualagents/bots/fd71094e-e373-4aa5-8346-cfe343d5b812/directline/token?api-version=2022-03-01-preview";
                var environmentEndPoint = theURL.slice(0,theURL.indexOf('/powervirtualagents'));
                var apiVersion = theURL.slice(theURL.indexOf('api-version')).split('=')[1];
                var regionalChannelSettingsURL = `${environmentEndPoint}/powervirtualagents/regionalchannelsettings?api-version=${apiVersion}`;
                var directline;

                fetch(regionalChannelSettingsURL)
                    .then((response) => {
                        return response.json();
                        })
                    .then((data) => {
                        directline = data.channelUrlsById.directline;
                        })
                    .catch(err => console.error("An error occurred: " + err));

                fetch(theURL)
                    .then(response => response.json())
                    .then(conversationInfo => {
                        window.WebChat.renderWebChat({
                            directLine: window.WebChat.createDirectLine({
                                token: conversationInfo.token
                            }),
                            styleOptions
                        },
                        document.getElementById('webchat')
                        );
                    })
                    .catch(err => console.error("An error occurred: " + err));
            }
        });
        // Evento para cerrar el chatbot
        $('#chatbot-close-button').click(function() {
            if (!chatbot.hasClass('hidden')) {
                chatbot.addClass('hidden');
                chatbotButton.removeClass('hidden');
            }
        });
    });
}, false);
;
/**
 * @file
 * Bootstrap Popovers.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  var $document = $(document);

  /**
   * Extend the Bootstrap Popover plugin constructor class.
   */
  Bootstrap.extendPlugin('popover', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.popover_animation,
        autoClose: !!settings.popover_auto_close,
        enabled: settings.popover_enabled,
        html: !!settings.popover_html,
        placement: settings.popover_placement,
        selector: settings.popover_selector,
        trigger: settings.popover_trigger,
        title: settings.popover_title,
        content: settings.popover_content,
        delay: parseInt(settings.popover_delay, 10),
        container: settings.popover_container
      }
    };
  });

  /**
   * Bootstrap Popovers.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapPopovers = {
    $activePopover: null,
    attach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      var _this = this;

      $document
        .on('show.bs.popover', '[data-toggle=popover]', function () {
          var $trigger = $(this);
          var popover = $trigger.data('bs.popover');

          // Only keep track of clicked triggers that we're manually handling.
          if (popover.options.originalTrigger === 'click') {
            if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($trigger)) {
              _this.$activePopover.popover('hide');
            }
            _this.$activePopover = $trigger;
          }
        })
        // Unfortunately, :focusable is only made available when using jQuery
        // UI. While this would be the most semantic pseudo selector to use
        // here, jQuery UI may not always be loaded. Instead, just use :visible
        // here as this just needs some sort of selector here. This activates
        // delegate binding to elements in jQuery so it can work it's bubbling
        // focus magic since elements don't really propagate their focus events.
        // @see https://www.drupal.org/project/bootstrap/issues/3013236
        .on('focus.bs.popover', ':visible', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($target) && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('click.bs.popover', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !$target.is('[data-toggle=popover]') && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('keyup.bs.popover', function (e) {
          if (_this.$activePopover && _this.getOption('autoClose') && e.which === 27) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
      ;

      var elements = $(context).find('[data-toggle=popover]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.popover.Constructor.DEFAULTS, $element.data());

        // Store the original trigger.
        options.originalTrigger = options.trigger;

        // If the trigger is "click", then we'll handle it manually here.
        if (options.trigger === 'click') {
          options.trigger = 'manual';
        }

        // Retrieve content from a target element.
        var target = options.target || $element.is('a[href^="#"]') && $element.attr('href');
        var $target = $document.find(target).clone();
        if (!options.content && $target[0]) {
          $target.removeClass('visually-hidden hidden').removeAttr('aria-hidden');
          options.content = $target.wrap('<div/>').parent()[options.html ? 'html' : 'text']() || '';
        }

        // Initialize the popover.
        $element.popover(options);

        // Handle clicks manually.
        if (options.originalTrigger === 'click') {
          // To ensure the element is bound multiple times, remove any
          // previously set event handler before adding another one.
          $element
            .off('click.drupal.bootstrap.popover')
            .on('click.drupal.bootstrap.popover', function (e) {
              $(this).popover('toggle');
              e.preventDefault();
              e.stopPropagation();
            })
          ;
        }
      }
    },
    detach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all popovers.
      $(context).find('[data-toggle="popover"]')
        .off('click.drupal.bootstrap.popover')
        .popover('destroy')
      ;
    },
    getOption: function(name, defaultValue, element) {
      var $element = element ? $(element) : this.$activePopover;
      var options = $.extend(true, {}, $.fn.popover.Constructor.DEFAULTS, ($element && $element.data('bs.popover') || {}).options);
      if (options[name] !== void 0) {
        return options[name];
      }
      return defaultValue !== void 0 ? defaultValue : void 0;
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
 * @file
 * Bootstrap Tooltips.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  /**
   * Extend the Bootstrap Tooltip plugin constructor class.
   */
  Bootstrap.extendPlugin('tooltip', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.tooltip_animation,
        enabled: settings.tooltip_enabled,
        html: !!settings.tooltip_html,
        placement: settings.tooltip_placement,
        selector: settings.tooltip_selector,
        trigger: settings.tooltip_trigger,
        delay: parseInt(settings.tooltip_delay, 10),
        container: settings.tooltip_container
      }
    };
  });

  /**
   * Bootstrap Tooltips.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapTooltips = {
    attach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      var elements = $(context).find('[data-toggle="tooltip"]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, $element.data());
        $element.tooltip(options);
      }
    },
    detach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all tooltips.
      $(context).find('[data-toggle="tooltip"]').tooltip('destroy');
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;