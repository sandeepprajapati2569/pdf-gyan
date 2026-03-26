/**
 * PDF Gyan — Chat with Document Widget SDK
 *
 * Embed a chat widget on any website with a single script tag.
 *
 * Usage:
 *   <script src="https://your-domain.com/sdk/pgyan-chat-widget.js"></script>
 *   <script>
 *     PGyanChat.init({
 *       token: 'pgchat_xxxxxxxx',        // Required: embed token from PDF Gyan
 *       theme: 'dark',                     // Optional: 'dark' | 'light' (default: 'dark')
 *       position: 'bottom-right',          // Optional: 'bottom-right' | 'bottom-left'
 *       baseUrl: 'https://app.pdfgyan.com' // Optional: custom PDF Gyan URL
 *     });
 *   </script>
 *
 * Events:
 *   window.addEventListener('pgyan_chat_message', (e) => { ... })
 *
 * API:
 *   PGyanChat.open()    — Expand the widget
 *   PGyanChat.close()   — Collapse the widget
 *   PGyanChat.destroy() — Remove the widget completely
 */

(function (window, document) {
  'use strict';

  var PGyanChat = {};
  var iframe = null;
  var config = {};

  var defaults = {
    token: '',
    theme: 'dark',
    position: 'bottom-right',
    baseUrl: '',
  };

  PGyanChat.init = function (options) {
    config = Object.assign({}, defaults, options || {});

    if (!config.token) {
      console.error('[PGyanChat] Token is required. Get one from your PDF Gyan dashboard.');
      return;
    }

    var baseUrl = config.baseUrl || _detectBaseUrl();

    var widgetUrl = baseUrl + '/embed/chat?' +
      'token=' + encodeURIComponent(config.token) +
      '&theme=' + encodeURIComponent(config.theme) +
      '&position=' + encodeURIComponent(config.position);

    iframe = document.createElement('iframe');
    iframe.id = 'pgyan-chat-widget';
    iframe.src = widgetUrl;
    iframe.style.cssText = [
      'position: fixed',
      'bottom: 0',
      config.position === 'bottom-left' ? 'left: 0' : 'right: 0',
      'width: 420px',
      'height: 600px',
      'border: none',
      'z-index: 99998',
      'background: transparent',
      'pointer-events: auto',
    ].join('; ');

    document.body.appendChild(iframe);
    window.addEventListener('message', _handleMessage, false);
  };

  PGyanChat.open = function () {
    if (iframe) iframe.contentWindow.postMessage({ type: 'pgyan_open' }, '*');
  };

  PGyanChat.close = function () {
    if (iframe) iframe.contentWindow.postMessage({ type: 'pgyan_close' }, '*');
  };

  PGyanChat.destroy = function () {
    window.removeEventListener('message', _handleMessage, false);
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    iframe = null;
  };

  function _handleMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    var type = event.data.type;

    if (type === 'pgyan_chat_message') {
      window.dispatchEvent(new CustomEvent('pgyan_chat_message', { detail: event.data }));
    }

    if (type === 'pgyan_resize') {
      if (iframe) {
        iframe.style.width = event.data.width || '420px';
        iframe.style.height = event.data.height || '600px';
      }
    }
  }

  function _detectBaseUrl() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('pgyan-chat-widget.js') !== -1) {
        var url = new URL(src);
        return url.origin;
      }
    }
    return 'https://app.pdfgyan.com';
  }

  window.PGyanChat = PGyanChat;

})(window, document);
