/**
 * CausalFunnel Analytics Tracker SDK
 * Lightweight, zero-dependency client tracking script.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CausalTracker = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEFAULT_ENDPOINT = 'http://localhost:5005/api/events';
  var SESSION_STORAGE_KEY = 'cf_session_id';
  var SESSION_TIMESTAMP_KEY = 'cf_last_activity';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  var BATCH_INTERVAL_MS = 600;
  var BATCH_MAX_SIZE = 3;

  var config = {
    endpoint: DEFAULT_ENDPOINT,
    debug: true,
    autoTrackPageView: true,
    autoTrackClicks: true,
    sampleRate: 1.0
  };

  var eventQueue = [];
  var flushTimer = null;
  var initialized = false;

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  }

  function getSessionId() {
    var now = Date.now();
    var lastActivity = null;
    var sessionId = null;

    try {
      sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      lastActivity = parseInt(localStorage.getItem(SESSION_TIMESTAMP_KEY) || '0', 10);
    } catch (e) {
      sessionId = getCookie(SESSION_STORAGE_KEY);
      lastActivity = parseInt(getCookie(SESSION_TIMESTAMP_KEY) || '0', 10);
    }

    if (sessionId && lastActivity && (now - lastActivity < SESSION_TIMEOUT_MS)) {
      touchSession(sessionId, now);
      return sessionId;
    }

    sessionId = generateUUID();
    touchSession(sessionId, now);
    if (config.debug) {
      console.log('[CausalTracker] New Session Initialized:', sessionId);
    }
    return sessionId;
  }

  function touchSession(sessionId, timestamp) {
    var ts = timestamp || Date.now();
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      localStorage.setItem(SESSION_TIMESTAMP_KEY, ts.toString());
    } catch (e) {
      setCookie(SESSION_STORAGE_KEY, sessionId, 1);
      setCookie(SESSION_TIMESTAMP_KEY, ts.toString(), 1);
    }
  }

  function getElementSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    var parts = [];
    var curr = el;
    while (curr && curr.nodeType === 1 && parts.length < 3) {
      var name = curr.tagName.toLowerCase();
      if (curr.id) {
        name += '#' + curr.id;
        parts.unshift(name);
        break;
      } else if (curr.className && typeof curr.className === 'string') {
        var classes = curr.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (classes) name += '.' + classes;
      }
      parts.unshift(name);
      curr = curr.parentElement;
    }
    return parts.join(' > ');
  }

  function enqueue(eventPayload) {
    eventQueue.push(eventPayload);
    if (config.debug) {
      console.log('[CausalTracker] Event recorded:', eventPayload.event, eventPayload);
    }
    if (eventQueue.length >= BATCH_MAX_SIZE) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
    }
  }

  function flush(isUnload) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (eventQueue.length === 0) return;

    var payload = eventQueue.slice();
    eventQueue = [];

    var jsonString = JSON.stringify(payload.length === 1 ? payload[0] : payload);

    if (isUnload && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        var blob = new Blob([jsonString], { type: 'application/json' });
        if (navigator.sendBeacon(config.endpoint, blob)) {
          return;
        }
      } catch (e) {
      }
    }

    if (typeof fetch === 'function') {
      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonString,
        keepalive: true
      })
      .then(function(res) {
        if (config.debug) {
          console.log('[CausalTracker] Ingested ' + payload.length + ' event(s) to ' + config.endpoint);
        }
      })
      .catch(function (err) {
        console.warn('[CausalTracker] Failed to send events:', err);
      });
    }
  }

  function track(eventType, details) {
    if (Math.random() > config.sampleRate) return;

    var sessionId = getSessionId();
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;

    var payload = {
      session_id: sessionId,
      event: eventType,
      url: window.location.href,
      pathname: window.location.pathname || '/',
      timestamp: new Date().toISOString(),
      viewportWidth: vw,
      viewportHeight: vh
    };

    if (details) {
      for (var key in details) {
        if (details.hasOwnProperty(key)) {
          payload[key] = details[key];
        }
      }
    }

    enqueue(payload);
  }

  function handlePageView() {
    track('page_view', {
      title: document.title,
      referrer: document.referrer || ''
    });
  }

  function handleClick(e) {
    var target = e.target;
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;

    var x = e.clientX;
    var y = e.clientY;
    var pageX = e.pageX || (x + (window.scrollX || window.pageXOffset || 0));
    var pageY = e.pageY || (y + (window.scrollY || window.pageYOffset || 0));

    var xPercent = parseFloat(((x / vw) * 100).toFixed(2));
    var yPercent = parseFloat(((y / vh) * 100).toFixed(2));

    var targetTag = target && target.tagName ? target.tagName.toLowerCase() : '';
    var targetText = target ? (target.innerText || target.value || target.alt || '').trim().slice(0, 80) : '';
    var targetSelector = getElementSelector(target);

    track('click', {
      x: Math.round(x),
      y: Math.round(y),
      pageX: Math.round(pageX),
      pageY: Math.round(pageY),
      xPercent: xPercent,
      yPercent: yPercent,
      targetTag: targetTag,
      targetId: target && target.id ? target.id : '',
      targetClass: target && typeof target.className === 'string' ? target.className : '',
      targetText: targetText,
      targetSelector: targetSelector
    });
  }

  function setupSpaListeners() {
    var originalPushState = history.pushState;
    if (originalPushState) {
      history.pushState = function () {
        var result = originalPushState.apply(this, arguments);
        handlePageView();
        return result;
      };
    }

    var originalReplaceState = history.replaceState;
    if (originalReplaceState) {
      history.replaceState = function () {
        var result = originalReplaceState.apply(this, arguments);
        handlePageView();
        return result;
      };
    }

    window.addEventListener('popstate', handlePageView);
  }

  function setupLifecycleListeners() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        flush(true);
      }
    });

    window.addEventListener('beforeunload', function() {
      flush(true);
    });
    window.addEventListener('pagehide', function() {
      flush(true);
    });
  }

  function init(options) {
    if (initialized) return;
    initialized = true;

    if (options) {
      for (var k in options) {
        if (options.hasOwnProperty(k)) {
          config[k] = options[k];
        }
      }
    }

    setupLifecycleListeners();

    if (config.autoTrackClicks) {
      document.addEventListener('click', handleClick, true);
    }

    if (config.autoTrackPageView) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        handlePageView();
      } else {
        document.addEventListener('DOMContentLoaded', handlePageView);
      }
      setupSpaListeners();
    }

    if (config.debug) {
      console.log('[CausalTracker] Initialized with endpoint:', config.endpoint);
    }
  }

  if (typeof document !== 'undefined') {
    var currentScript = document.currentScript;
    if (currentScript) {
      var endpointAttr = currentScript.getAttribute('data-endpoint');
      var debugAttr = currentScript.getAttribute('data-debug');
      var autoInitAttr = currentScript.getAttribute('data-auto-init');

      if (autoInitAttr !== 'false') {
        init({
          endpoint: endpointAttr || DEFAULT_ENDPOINT,
          debug: debugAttr === 'true'
        });
      }
    }
  }

  return {
    init: init,
    track: track,
    getSessionId: getSessionId,
    flush: flush
  };
});
