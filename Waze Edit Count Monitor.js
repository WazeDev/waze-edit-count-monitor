// ==UserScript==
// @name            Waze Edit Count Monitor
// @namespace       https://greasyfork.org/en/users/45389-mapomatic
// @version         2019.09.19.001
// @description     Displays your daily edit count in the WME toolbar.  Warns if you might be throttled.
// @author          MapOMatic
// @include         /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @require         https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @license         GNU GPLv3
// @contributionURL https://github.com/WazeDev/Thank-The-Authors
// @grant           GM_xmlhttpRequest
// @connect         www.waze.com

// ==/UserScript==

/* global W */
/* global toastr */
/* global $ */
/* global GM_xmlhttpRequest */

// This function is injected into the page to allow it to run in the page's context.
function wecmInjected() {
    const TOASTR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.js';
    const TOASTR_SETTINGS = {
        remindAtEditCount: 100,
        warnAtEditCount: 150,
        wasReminded: false,
        wasWarned: false
    };
    const TOOLTIP_TEXT = 'Your daily edit count from your profile. Click to open your profile.';

    let _$outputElem = null;
    let _$outputElemContainer = null;
    let _lastEditCount = null;
    let _userName = null;
    let _savesWithoutIncrease = 0;
    let _lastURCount = null;
    let _lastMPCount = null;

    function log(message) {
        console.log('Edit Count Monitor:', message);
    }

    function checkEditCount() {
        window.postMessage(JSON.stringify(['wecmGetCounts', _userName]), '*');
        TOASTR_SETTINGS.wasReminded = false;
        TOASTR_SETTINGS.wasWarned = false;
        toastr.remove();
    }

    function updateEditCount(editCount, urCount, mpCount, noIncrement) {
        // Add the counter div if it doesn't exist.
        if ($('#wecm-count').length === 0) {
            _$outputElemContainer = $('<div>', { class: 'toolbar-button', style: 'font-weight: bold; font-size: 16px; border-radius: 10px;' });
            const $innerDiv = $('<div>', { class: 'item-container', style: 'padding-left: 10px; padding-right: 10px; cursor: default;' });
            _$outputElem = $('<a>', {
                id: 'wecm-count',
                href: `${document.location.origin}/user/editor/${_userName.toLowerCase()}`,
                target: '_blank',
                style: 'text-decoration:none',
                'data-original-title': TOOLTIP_TEXT
            });
            $innerDiv.append(_$outputElem);
            _$outputElemContainer.append($innerDiv);
            $('#edit-buttons .waze-icon-trash').before(_$outputElemContainer);
            _$outputElem.tooltip({
                placement: 'auto top',
                delay: { show: 100, hide: 100 },
                html: true,
                template: '<div class="tooltip" role="tooltip" style="opacity:0.95"><div class="tooltip-arrow"></div>'
                    + '<div class="my-tooltip-header" style="display:block;"><b></b></div>'
                    + '<div class="my-tooltip-body tooltip-inner" style="display:block; font-weight:600; !important"></div></div>'
            });
        }

        // log('edit count = ' + editCount + ', UR count = ' + urCount.count);
        if (_lastEditCount !== editCount || _lastURCount.count !== urCount.count || _lastMPCount.count !== mpCount.count) {
            _savesWithoutIncrease = 0;
        } else if (!noIncrement) {
            _savesWithoutIncrease++;
        }

        let textColor;
        let bgColor;
        let tooltipTextColor;
        if (_savesWithoutIncrease < 5) {
            textColor = '#354148';
            bgColor = 'white';
            tooltipTextColor = 'white';
        } else if (_savesWithoutIncrease < 10) {
            textColor = '#354148';
            bgColor = 'yellow';
            tooltipTextColor = 'black';
        } else {
            textColor = 'white';
            bgColor = 'red';
            tooltipTextColor = 'white';
        }
        _$outputElemContainer.css('background-color', bgColor);
        _$outputElem.css('color', textColor).html(editCount);
        const urCountText = `<div style="margin-top:8px;padding:3px;">UR's&nbsp;Closed:&nbsp;${urCount.count}&nbsp;&nbsp;(since&nbsp;${
            (new Date(urCount.since)).toLocaleDateString()})</div>`;
        const mpCountText = `<div style="margin-top:0px;padding:0px 3px;">MP's&nbsp;Closed:&nbsp;${mpCount.count}&nbsp;&nbsp;(since&nbsp;${(
            new Date(mpCount.since)).toLocaleDateString()})</div>`;
        const warningText = (_savesWithoutIncrease > 0) ? `<div style="border-radius:8px;padding:3px;margin-top:8px;margin-bottom:5px;color:${
            tooltipTextColor};background-color:${bgColor};">${_savesWithoutIncrease} consecutive saves without an increase. (Are you throttled?)</div>` : '';
        _$outputElem.attr('data-original-title', TOOLTIP_TEXT + urCountText + mpCountText + warningText);
        _lastEditCount = editCount;
        _lastURCount = urCount;
        _lastMPCount = mpCount;
    }

    function receiveMessage(event) {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (err) {
            // Do nothing
        }

        if (msg && msg[0] === 'wecmUpdateUi') {
            const editCount = msg[1][0];
            const urCount = msg[1][1];
            const mpCount = msg[1][2];
            updateEditCount(editCount, urCount, mpCount);
        }
    }

    function errorHandler(callback) {
        try {
            callback();
        } catch (ex) {
            console.error('Edit Count Monitor:', ex);
        }
    }

    async function init() {
        _userName = W.loginManager.user.userName;
        // Listen for events from sandboxed code.
        window.addEventListener('message', receiveMessage);
        // Listen for Save events.

        $('head').append(
            $('<link/>', {
                rel: 'stylesheet',
                type: 'text/css',
                href: 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.css'
            }),
            $('<style type="text/css">#toast-container {position: absolute;} #toast-container > div {opacity: 0.95;} .toast-top-center {top: 30px;}</style>')
        );
        await $.getScript(TOASTR_URL);
        toastr.options = {
            target: '#map',
            timeOut: 9999999999,
            positionClass: 'toast-top-right',
            closeOnHover: false,
            closeDuration: 0,
            showDuration: 0,
            closeButton: true
            // preventDuplicates: true
        };
        W.model.actionManager.events.register('afterclearactions', null, () => errorHandler(checkEditCount));

        // Update the edit count first time.
        checkEditCount();
        log('Initialized.');
    }

    function bootstrap() {
        if (W && W.loginManager && W.loginManager.events && W.loginManager.events.register && W.map && W.loginManager.user) {
            log('Initializing...');
            init();
        } else {
            log('Bootstrap failed. Trying again...');
            setTimeout(bootstrap, 1000);
        }
    }

    bootstrap();
}


// Code that is NOT injected into the page.
// Note that jQuery may or may not be available, so don't rely on it in this part of the script.

function getEditorProfileFromSource(source) {
    const match = source.match(/gon.data=({.*?});gon.env=/i);
    return JSON.parse(match[1]);
}

function getEditCountFromProfile(profile) {
    const editingActivity = profile.editingActivity;
    return editingActivity[editingActivity.length - 1];
}

function getEditCountByTypeFromProfile(profile, type) {
    const edits = profile.editsByType.find(editsEntry => editsEntry.key === type);
    return edits ? edits.value : -1;
}

// Handle messages from the page.
function receivePageMessage(event) {
    let msg;
    try {
        msg = JSON.parse(event.data);
    } catch (err) {
        // Ignore errors
    }

    if (msg && msg[0] === 'wecmGetCounts') {
        const userName = msg[1];
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://www.waze.com/user/editor/${userName}`,
            onload: res => {
                const profile = getEditorProfileFromSource(res.responseText);
                window.postMessage(JSON.stringify(['wecmUpdateUi', [
                    getEditCountFromProfile(profile),
                    getEditCountByTypeFromProfile(profile, 'mapUpdateRequest'),
                    getEditCountByTypeFromProfile(profile, 'machineMapProblem')
                ]]), '*');
            }
        });
    }
}

const wecmInjectedScript = document.createElement('script');
wecmInjectedScript.textContent = `${wecmInjected.toString()} \nwecmInjected();`;
wecmInjectedScript.setAttribute('type', 'application/javascript');
document.body.appendChild(wecmInjectedScript);

// Listen for events coming from the page script.
window.addEventListener('message', receivePageMessage);
