// GadgetFix Analytics - Trello Tracking
// Compatible with TechSpec Client Dashboard
(function() {
    var CONFIG = {
        trelloApiKey: '3ea0ef2b85773186d7ae30322ae1782d',
        trelloToken: 'ATTAde902321af1ec6600e16a0587516fb0b68cff7d5ce58997aa165fc08ba35568217827FB6',
        analyticsListId: '6984e1ddd3ae7596161a2863'
    };

    // Session & User tracking
    var SESSION_ID = sessionStorage.getItem('gf_session') || (function(){
        var s = 'sess_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('gf_session', s);
        return s;
    })();

    var VISITOR_ID = localStorage.getItem('gf_visitor') || (function(){
        var v = 'vis_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('gf_visitor', v);
        return v;
    })();

    var visitorCardId = sessionStorage.getItem('gf_visitor_card') || null;
    var pageStartTime = Date.now();
    var maxScrollDepth = 0;

    function getDeviceType() {
        return /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
    }

    function getBrowser() {
        var ua = navigator.userAgent;
        if (ua.indexOf('Firefox') > -1) return 'Firefox';
        if (ua.indexOf('Edg') > -1) return 'Edge';
        if (ua.indexOf('Chrome') > -1) return 'Chrome';
        if (ua.indexOf('Safari') > -1) return 'Safari';
        if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
        return 'Unknown';
    }

    function getOS() {
        var ua = navigator.userAgent;
        if (ua.indexOf('Windows') > -1) return 'Windows';
        if (ua.indexOf('Mac') > -1) return 'macOS';
        if (ua.indexOf('Linux') > -1) return 'Linux';
        if (ua.indexOf('Android') > -1) return 'Android';
        if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';
        return 'Unknown';
    }

    async function trackEvent(type, data) {
        data = data || {};
        try {
            var cardName = 'VISITOR: ' + VISITOR_ID;

            var event = {
                type: type,
                page: location.pathname,
                title: document.title,
                time: new Date().toISOString(),
                timestamp: Date.now()
            };

            if (type === 'click' && data.text) event.text = data.text.substring(0, 50);
            if (type === 'click' && data.href) event.href = data.href.substring(0, 100);
            if (type === 'form_submit' && data.formType) event.formType = data.formType;
            if (type === 'page_exit') {
                event.timeOnPage = data.timeOnPage;
                event.scrollDepth = data.scrollDepth;
            }

            // Find existing card
            if (!visitorCardId) {
                var listUrl = 'https://api.trello.com/1/lists/' + CONFIG.analyticsListId + '/cards?key=' + CONFIG.trelloApiKey + '&token=' + CONFIG.trelloToken;
                var res = await fetch(listUrl);
                if (!res.ok) return;

                var cards = await res.json();
                var existingCard = cards.find(function(c) { return c.name === cardName; });

                if (existingCard) {
                    visitorCardId = existingCard.id;
                    sessionStorage.setItem('gf_visitor_card', visitorCardId);
                }
            }

            var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';

            var visitorData = {
                visitorId: VISITOR_ID,
                sessionId: SESSION_ID,
                timezone: timezone,
                language: navigator.language,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                device: getDeviceType(),
                browser: getBrowser(),
                os: getOS(),
                screenRes: screen.width + 'x' + screen.height,
                referrer: document.referrer || 'Direct',
                entryPage: location.pathname,
                events: []
            };

            // If card exists, fetch its data
            if (visitorCardId) {
                try {
                    var cardRes = await fetch('https://api.trello.com/1/cards/' + visitorCardId + '?key=' + CONFIG.trelloApiKey + '&token=' + CONFIG.trelloToken);
                    if (cardRes.ok) {
                        var cardData = await cardRes.json();
                        var descMatch = cardData.desc.match(/```json\n([\s\S]*?)\n```/);
                        if (descMatch) {
                            visitorData = JSON.parse(descMatch[1]);
                        }
                    }
                } catch (e) {}
            }

            visitorData.lastSeen = new Date().toISOString();
            visitorData.events = visitorData.events || [];
            visitorData.events.push(event);

            // Cap at 100 events
            if (visitorData.events.length > 100) {
                visitorData.events = visitorData.events.slice(-100);
            }

            var desc = '```json\n' + JSON.stringify(visitorData, null, 2) + '\n```';

            if (visitorCardId) {
                await fetch('https://api.trello.com/1/cards/' + visitorCardId + '?key=' + CONFIG.trelloApiKey + '&token=' + CONFIG.trelloToken, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ desc: desc })
                });
            } else {
                var createRes = await fetch('https://api.trello.com/1/cards?key=' + CONFIG.trelloApiKey + '&token=' + CONFIG.trelloToken, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idList: CONFIG.analyticsListId,
                        name: cardName,
                        desc: desc
                    })
                });
                if (createRes.ok) {
                    var newCard = await createRes.json();
                    visitorCardId = newCard.id;
                    sessionStorage.setItem('gf_visitor_card', visitorCardId);
                }
            }
        } catch (e) {
            console.error('[GadgetFix Analytics] Error:', e);
        }
    }

    // Track page view on load
    trackEvent('pageview', { title: document.title });

    // Track clicks on links and buttons
    document.addEventListener('click', function(e) {
        var target = e.target.closest('a, button');
        if (!target) return;
        var text = (target.textContent || '').trim();
        var href = target.getAttribute('href') || '';
        if (text || href) {
            trackEvent('click', { text: text, href: href });
        }
    });

    // Track scroll depth
    window.addEventListener('scroll', function() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        if (docHeight > 0) {
            var depth = Math.round((scrollTop / docHeight) * 100);
            if (depth > maxScrollDepth) maxScrollDepth = depth;
        }
    });

    // Track page exit
    window.addEventListener('beforeunload', function() {
        var timeOnPage = Date.now() - pageStartTime;
        if (navigator.sendBeacon && visitorCardId) {
            var commentText = '[PAGE_EXIT] ' + location.pathname + ' | Time: ' + Math.round(timeOnPage / 1000) + 's | Scroll: ' + maxScrollDepth + '%';
            var url = 'https://api.trello.com/1/cards/' + visitorCardId + '/actions/comments?key=' + CONFIG.trelloApiKey + '&token=' + CONFIG.trelloToken;
            var formData = new FormData();
            formData.append('text', commentText);
            navigator.sendBeacon(url, formData);
        }
    });

    // Expose trackEvent globally for form submissions
    window.gfTrackEvent = trackEvent;

    console.log('[GadgetFix Analytics] Tracking initialized - Visitor:', VISITOR_ID, 'Session:', SESSION_ID);
})();
