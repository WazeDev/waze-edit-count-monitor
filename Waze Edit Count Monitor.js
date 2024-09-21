// ==UserScript==
// @name            Waze Edit Count Monitor
// @namespace       https://greasyfork.org/en/users/45389-mapomatic
// @version         2024.08.11.001
// @description     Displays your daily edit count in the WME toolbar.  Warns if you might be throttled.
// @author          MapOMatic
// @include         /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @require         https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @require         https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.js
// @license         GNU GPLv3
// @contributionURL https://github.com/WazeDev/Thank-The-Authors
// @grant           GM_xmlhttpRequest
// @grant           GM_addElement
// @grant           GM_addStyle
// @connect         www.waze.com
// @connect         greasyfork.org
// ==/UserScript==

/* global toastr */
/* global WazeWrap */
/* global getWmeSdk */

(function main() {
    'use strict';

    const scriptName = GM_info.script.name;
    const scriptId = 'wazeEditCountMonitor';
    const SCRIPT_VERSION = GM_info.script.version;
    const DOWNLOAD_URL = 'https://greasyfork.org/scripts/40313-waze-edit-count-monitor/code/Waze%20Edit%20Count%20Monitor.user.js';
    let sdk;

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
    let userName;
    let _savesWithoutIncrease = 0;
    let lastProfile;

    function log(message) {
        console.log('Edit Count Monitor:', message);
    }

    function updateEditCount() {
        sdk.DataModel.Users.getUserProfile({ userName }).then(profile => {
        // Add the counter div if it doesn't exist.
            if ($('#wecm-count').length === 0) {
                _$outputElemContainer = $('<div>', { class: 'toolbar-button', style: 'font-weight: bold; font-size: 16px; border-radius: 10px; margin-left: 4px;' });
                const $innerDiv = $('<div>', { class: 'item-container', style: 'padding-left: 10px; padding-right: 10px; cursor: default;' });
                _$outputElem = $('<a>', {
                    id: 'wecm-count',
                    href: `https://www.waze.com/user/editor/${userName.toLowerCase()}`,
                    target: '_blank',
                    style: 'text-decoration:none',
                    'data-original-title': TOOLTIP_TEXT
                });
                $innerDiv.append(_$outputElem);
                _$outputElemContainer.append($innerDiv);
                if ($('#toolbar > div > div.secondary-toolbar > div.secondary-toolbar-actions > div.secondary-toolbar-actions-edit').length) {
                // Production WME, as of 4/25/2023
                    $('#toolbar > div > div.secondary-toolbar > div.secondary-toolbar-actions > div.secondary-toolbar-actions-edit').after(_$outputElemContainer);
                } else {
                // Beta WME, as of 4/25/2023
                    $('#toolbar > div > div.secondary-toolbar > div:nth-child(1)').after(_$outputElemContainer);
                }
                _$outputElem.tooltip({
                    placement: 'auto top',
                    delay: { show: 100, hide: 100 },
                    html: true,
                    template: '<div class="tooltip wecm-tooltip" role="tooltip"><div class="tooltip-arrow"></div>'
                        + '<div class="wecm-tooltip-header"><b></b></div>'
                        + '<div class="wecm-tooltip-body tooltip-inner""></div></div>'
                });
            }

            // log('edit count = ' + editCount + ', UR count = ' + urCount.count);
            // TODO: check all editCountByType values here?
            if (!lastProfile) {
                lastProfile = profile;
            } else if (lastProfile.editCount !== profile.editCount
                    || lastProfile.editCountByType.updateRequests !== profile.editCountByType.updateRequests
                    || lastProfile.editCountByType.mapProblems !== profile.editCountByType.mapProblems
                    || lastProfile.editCountByType.placeUpdateRequests !== profile.editCountByType.placeUpdateRequests) {
                _savesWithoutIncrease = 0;
            } else {
                _savesWithoutIncrease++;
            }

            let textColor;
            let bgColor;
            let tooltipTextColor;
            if (_savesWithoutIncrease < 5) {
                textColor = '#354148';
                bgColor = 'white';
                tooltipTextColor = 'black';
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
            // SDK: This doesn't work. Need the daily edit count, not the total edit count.
            // Also note that editCount does not appear to reliably update before the wme-save-finished event.
            // This could be a problem if the daily edit count also does not reliable update in time.
            _$outputElem.css('color', textColor).html(profile.editCount);
            const urCountText = `<div style="margin-top:8px;padding:3px;">URs&nbsp;Closed:&nbsp;${
                profile.editCountByType.updateRequests.toLocaleString()}</div>`;
            const purCountText = `<div style="margin-top:0px;padding:0px 3px;">PURs&nbsp;Closed:&nbsp;${
                profile.editCountByType.placeUpdateRequests.toLocaleString()}</div>`;
            const mpCountText = `<div style="margin-top:0px;padding:0px 3px;">MPs&nbsp;Closed:&nbsp;${
                profile.editCountByType.mapProblems.toLocaleString()}</div>`;
            // const urCountText = `<div style="margin-top:8px;padding:3px;">URs&nbsp;Closed:&nbsp;${
            //     profile.updateRequests.toLocaleString()}&nbsp;&nbsp;(since&nbsp;${
            //     (new Date(urCount.since)).toLocaleDateString()})</div>`;
            // const purCountText = `<div style="margin-top:0px;padding:0px 3px;">PURs&nbsp;Closed:&nbsp;${
            //     purCount.count.toLocaleString()}&nbsp;&nbsp;(since&nbsp;${(
            //     new Date(purCount.since)).toLocaleDateString()})</div>`;
            // const mpCountText = `<div style="margin-top:0px;padding:0px 3px;">MPs&nbsp;Closed:&nbsp;${
            //     mpCount.count.toLocaleString()}&nbsp;&nbsp;(since&nbsp;${(
            //     new Date(mpCount.since)).toLocaleDateString()})</div>`;
            let warningText = '';
            if (_savesWithoutIncrease) {
                warningText = `<div style="border-radius:8px;padding:3px;margin-top:8px;margin-bottom:5px;color:${
                    tooltipTextColor};background-color:${bgColor};">${_savesWithoutIncrease} ${
                    (_savesWithoutIncrease > 1) ? 'consecutive saves' : 'save'} without an increase. ${
                    (_savesWithoutIncrease >= 5) ? '(Are you throttled?)' : ''}</div>`;
            }
            _$outputElem.attr('data-original-title', TOOLTIP_TEXT + urCountText + purCountText + mpCountText + warningText);
            lastProfile = profile;
        });
    }

    // function receiveMessage(event) {
    //     let msg;
    //     try {
    //         msg = JSON.parse(event.data);
    //     } catch (err) {
    //         // Do nothing
    //     }

    //     if (msg && msg[0] === 'wecmUpdateUi') {
    //         const editCount = msg[1][0];
    //         const urCount = msg[1][1];
    //         const purCount = msg[1][2];
    //         const mpCount = msg[1][3];
    //         updateEditCount(editCount, urCount, purCount, mpCount);
    //     }
    // }

    function errorHandler(callback) {
        try {
            callback();
        } catch (ex) {
            console.error('Edit Count Monitor:', ex);
        }
    }

    function loadScriptUpdateMonitor() {
        let updateMonitor;
        try {
            updateMonitor = new WazeWrap.Alerts.ScriptUpdateMonitor(scriptName, SCRIPT_VERSION, DOWNLOAD_URL, GM_xmlhttpRequest);
            updateMonitor.start();
        } catch (ex) {
            // Report, but don't stop if ScriptUpdateMonitor fails.
            console.error(`${scriptName}:`, ex);
        }
    }

    async function init() {
        loadScriptUpdateMonitor();
        //GM_addStyle('.wecm-tooltip-body { max-width: 230px; }');
        userName = sdk.State.getUserInfo().userName;

        // SDK: Testing ways to get daily editing data. These don't work in the script context.
        // Fetch throws a CSP error, and GM_xmlhttpRequest returns a "not logged in" error
        // If they can't add the daily edit count to the profile, or if the returned values
        // aren't updated in time when wme-save-finished fires, need to revert back to
        // injecting the script into the page context like it was before. If they do add it
        // but timing is an issue, look into a setTimeout function that checks a few times
        // after the wme-save-finished event. If injecting, can probably just inject code
        // to get the sdk, wait for wme-save-finished event, and post a message. Then receive
        // the message in the script.

        // fetch(`https://www.waze.com/Descartes/app/UserProfile/Profile?username=${userName}`).then(res => {
        //     debugger;
        //     const profile = JSON.parse(res.responseText);
        // });

        // GM_xmlhttpRequest({
        //     method: 'GET',
        //     url: `https://www.waze.com/Descartes/app/UserProfile/Profile?username=${userName}`,
        //     onload: res => {
        //         debugger;
        //         const profile = JSON.parse(res.responseText);

        //         // window.postMessage(JSON.stringify(['wecmUpdateUi', [
        //             // getEditCountFromProfile(profile),
        //             // getEditCountByTypeFromProfile(profile, 'mapUpdateRequest'),
        //             // getEditCountByTypeFromProfile(profile, 'venueUpdateRequest'),
        //             // getEditCountByTypeFromProfile(profile, 'machineMapProblem')
        //         // ]]), '*');
        //     }
        // });

        $('head').append(
            $('<link/>', {
                rel: 'stylesheet',
                type: 'text/css',
                href: 'https://cdnjs.cloudflare.com/ajax/libs/toastr.js/2.1.4/toastr.min.css'
            }),
            $('<style type="text/css">#toast-container {position: absolute;} #toast-container > div {opacity: 0.95;} .toast-top-center {top: 30px;}</style>')
        );
        // await $.getScript(TOASTR_URL);
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

        sdk.Events.on('wme-save-finished', onSaveFinished);
        // Update the edit count first time.
        updateEditCount();
        log('Initialized.');
    }

    function onSaveFinished(result) {
        if (result.success) updateEditCount();
    }

    function wazeWrapReady() {
        return new Promise(resolve => {
            (function checkWazeWrapReady(tries = 0) {
                if (WazeWrap.Ready) {
                    resolve();
                } else if (tries < 1000) {
                    setTimeout(checkWazeWrapReady, 200, ++tries);
                }
            })();
        });
    }

    function wmeReady() {
        sdk = getWmeSdk({ scriptName, scriptId });
        return new Promise(resolve => {
            if (sdk.State.isReady()) resolve();
            sdk.Events.once('wme-ready').then(resolve);
        });
    }

    async function bootstrap() {
        // SDK: Remove this when fixed
        if (!window.SDK_INITIALIZED) {
            window.SDK_INITIALIZED = new Promise(resolve => {
                document.body.addEventListener('sdk-initialized', () => resolve());
            });
        }
        // --------

        await window.SDK_INITIALIZED;
        await wmeReady();
        await wazeWrapReady();
        init();
    }

    bootstrap();

    // Handle messages from the page.
    // function receivePageMessage(event) {
    //     let msg;
    //     try {
    //         msg = JSON.parse(event.data);
    //     } catch (err) {
    //         // Ignore errors
    //     }

    //     if (msg && msg[0] === 'wecmGetCounts') {
    //         const userName = msg[1];
    //         GM_xmlhttpRequest({
    //             method: 'GET',
    //             url: `https://www.waze.com/Descartes/app/UserProfile/Profile?username=${userName}`,
    //             onload: res => {
    //                 const profile = JSON.parse(res.responseText);
    //                 window.postMessage(JSON.stringify(['wecmUpdateUi', [
    //                     getEditCountFromProfile(profile),
    //                     getEditCountByTypeFromProfile(profile, 'mapUpdateRequest'),
    //                     getEditCountByTypeFromProfile(profile, 'venueUpdateRequest'),
    //                     getEditCountByTypeFromProfile(profile, 'machineMapProblem')
    //                 ]]), '*');
    //             }
    //         });
    //     }
    // }
})();
