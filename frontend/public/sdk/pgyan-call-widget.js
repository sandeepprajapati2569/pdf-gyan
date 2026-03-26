/**
 * PDF Gyan — Call with Document Widget SDK
 *
 * Embed a voice call widget on any website with a single script tag.
 *
 * Usage:
 *   <script src="https://your-domain.com/sdk/pgyan-call-widget.js"></script>
 *   <script>
 *     PGyanCall.init({
 *       token: 'pgcall_xxxxxxxx',        // Required: embed token from PDF Gyan
 *       theme: 'dark',                     // Optional: 'dark' | 'light' (default: 'dark')
 *       position: 'bottom-right',          // Optional: 'bottom-right' | 'bottom-left'
 *       autoStart: false,                  // Optional: auto-start call on load
 *       baseUrl: 'https://app.pdfgyan.com' // Optional: custom PDF Gyan URL
 *     });
 *   </script>
 *
 * Events:
 *   window.addEventListener('pgyan_call_started', (e) => { ... })
 *   window.addEventListener('pgyan_call_ended', (e) => { ... })
 *
 * API:
 *   PGyanCall.open()    — Expand the widget
 *   PGyanCall.close()   — Collapse the widget
 *   PGyanCall.destroy() — Remove the widget completely
 */

(function (window, document) {
  'use strict';

  var PGyanCall = {};
  var iframe = null;
  var config = {};

  // Default configuration
  var defaults = {
    token: '',
    theme: 'dark',
    position: 'bottom-right',
    autoStart: false,
    baseUrl: '',
  };

  /**
   * Initialize the widget.
   */
  PGyanCall.init = function (options) {
    config = Object.assign({}, defaults, options || {});

    if (!config.token) {
      console.error('[PGyanCall] Token is required. Get one from your PDF Gyan dashboard.');
      return;
    }

    // Determine base URL
    var baseUrl = config.baseUrl || _detectBaseUrl();

    // Build iframe URL
    var widgetUrl = baseUrl + '/embed/call?' +
      'token=' + encodeURIComponent(config.token) +
      '&theme=' + encodeURIComponent(config.theme) +
      '&position=' + encodeURIComponent(config.position) +
      '&autostart=' + (config.autoStart ? 'true' : 'false');

    // Create iframe
    iframe = document.createElement('iframe');
    iframe.id = 'pgyan-call-widget';
    iframe.src = widgetUrl;
    iframe.style.cssText = [
      'position: fixed',
      'bottom: 0',
      'right: 0',
      'width: 420px',
      'height: 640px',
      'border: none',
      'z-index: 99999',
      'background: transparent',
      'pointer-events: auto',
    ].join('; ');
    iframe.allow = 'microphone; autoplay';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');

    document.body.appendChild(iframe);

    // Listen for messages from the iframe
    window.addEventListener('message', _handleMessage, false);
  };

  /**
   * Open/expand the widget.
   */
  PGyanCall.open = function () {
    if (iframe) {
      iframe.contentWindow.postMessage({ type: 'pgyan_open' }, '*');
    }
  };

  /**
   * Close/collapse the widget.
   */
  PGyanCall.close = function () {
    if (iframe) {
      iframe.contentWindow.postMessage({ type: 'pgyan_close' }, '*');
    }
  };

  /**
   * Destroy the widget completely.
   */
  PGyanCall.destroy = function () {
    window.removeEventListener('message', _handleMessage, false);
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    iframe = null;
  };

  // ─── Internal ───────────────────────────────────────────────────

  function _handleMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    var type = event.data.type;

    if (type === 'pgyan_call_started') {
      window.dispatchEvent(new CustomEvent('pgyan_call_started', { detail: event.data }));
    }

    if (type === 'pgyan_call_ended') {
      window.dispatchEvent(new CustomEvent('pgyan_call_ended', { detail: event.data }));
    }

    if (type === 'pgyan_resize') {
      if (iframe) {
        iframe.style.width = event.data.width || '420px';
        iframe.style.height = event.data.height || '640px';
      }
    }
  }

  function _detectBaseUrl() {
    // Try to detect from the script src
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('pgyan-call-widget.js') !== -1) {
        var url = new URL(src);
        return url.origin;
      }
    }
    return 'https://app.pdfgyan.com';
  }

  // Expose to global
  window.PGyanCall = PGyanCall;

})(window, document);
