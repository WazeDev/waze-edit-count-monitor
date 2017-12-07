// ==UserScript==
// @name         Waze Edit Count Monitor
// @namespace    https://greasyfork.org/en/users/45389-mapomatic
// @version      2017.12.07.001
// @description  Displays your daily edit count in the WME toolbar.  Warns if you might be throttled.
// @author       MapOMatic
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @license      GNU GPLv3
// @grant        GM_xmlhttpRequest
// @connect      www.waze.com

// ==/UserScript==

/* global W */
/* global GM_info */

// This function is injected into the page to allow it to run in the page's context.
function WECM_Injected() {
    "use strict";
    var debugLevel = 0;
    var $outputElem = null;
    var $outputElemContainer = null;
    var lastEditCount = null;
    var userName = null;
    var savesWithoutIncrease = 0;
    var lastURCount = null;
    var tooltipText = 'Your daily edit count from your profile.  Click to open your profile.';

    function log(message, level) {
        if (message && level <= debugLevel) {
            console.log('Edit Count Monitor: ' + message);
        }
    }

    function checkEditCount() {
        window.postMessage(JSON.stringify(['wecmGetCounts',userName]),'*');
    }

    function updateEditCount(editCount, urCount, noIncrement) {
        var textColor;
        var bgColor;
        var tooltipTextColor;

        // Add the counter div if it doesn't exist.
        if ($('#wecm-count').length === 0) {
            $outputElemContainer = $('<div>', {style:'position:relative; border-radius:23px; text-color:#354148; height:24px; padding-top:1px; padding-left:10px; padding-right:10px; display:block; float:right; margin-top:11px; font-weight:bold; font-size:medium;'});  //margin:9px 5px 8px 5px;  display:inline;
            $outputElem = $('<a>', {id: 'wecm-count',
                                    href:'https://www.waze.com/user/editor/' + userName.toLowerCase(),
                                    target: "_blank",
                                    style:'text-decoration:none',
                                    'data-original-title': tooltipText});
            $outputElemContainer.append($outputElem);
            $('#edit-buttons').children().first().append($outputElemContainer);
            $outputElem.tooltip({
                placement: 'auto top',
                delay: {show: 100, hide: 100},
                html: true,
                template: '<div class="tooltip" role="tooltip" style="opacity:0.95"><div class="tooltip-arrow"></div><div class="my-tooltip-header"><b></b></div><div class="my-tooltip-body tooltip-inner" style="font-weight:600; !important"></div></div>'
            });
        }

        log('edit count = ' + editCount + ', UR count = ' + urCount.count, 1);
        if (lastEditCount !== editCount || lastURCount.count !== urCount.count) {
            savesWithoutIncrease = 0;
        } else {
            if (!noIncrement) savesWithoutIncrease += 1;
        }

        switch (savesWithoutIncrease) {
            case 0:
            case 1:
                textColor = '#354148';
                bgColor = '';
                tooltipTextColor = 'white';
                break;
            case 2:
                textColor = '#354148';
                bgColor = 'yellow';
                tooltipTextColor = 'black';
                break;
            default:
                textColor = 'white';
                bgColor = 'red';
                tooltipTextColor = 'white';
        }
        $outputElemContainer.css('background-color', bgColor);
        $outputElem.css('color', textColor).html(editCount);
        var urCountText = "<div style='margin-top:8px;padding:3px;'>UR's&nbsp;Closed:&nbsp;" + urCount.count + "&nbsp;&nbsp;(since&nbsp;" + (new Date(urCount.since)).toLocaleDateString() + ")</div>";
        var warningText = (savesWithoutIncrease > 0) ? "<div style='border-radius:8px;padding:3px;margin-top:8px;margin-bottom:5px;color:"+ tooltipTextColor + ";background-color:" + bgColor + ";'>" + savesWithoutIncrease + ' consecutive saves without an increase. (Are you throttled?)</div>' : '';
        $outputElem.attr('data-original-title', tooltipText + urCountText + warningText);
        lastEditCount = editCount;
        lastURCount = urCount;
    }

    function receiveMessage(event) {
        var msg;
        try {
            msg = JSON.parse(event.data);
        } catch (err) {
            // Do nothing
        }

        if (msg && msg[0] === "wecmUpdateUi") {
            var editCount = msg[1][0];
            var urCount = msg[1][1];
            updateEditCount(editCount, urCount);
        }
    }

    function init() {
        userName = W.loginManager.user.userName;
        // Listen for events from sandboxed code.
        window.addEventListener('message', receiveMessage);
        // Listen for Save events.
        W.model.actionManager.events.register('afterclearactions', null, function(){ checkEditCount(); });
        // Update the edit count first time.
        checkEditCount();
        log('Initialized.',0);
    }

    function bootstrap() {
        if (W &&
            W.loginManager &&
            W.loginManager.events &&
            W.loginManager.events.register &&
            W.map &&
            W.loginManager.isLoggedIn()) {
            log('Initializing...', 0);
            init();
        } else {
            log('Bootstrap failed. Trying again...', 0);
            window.setTimeout(function () {
                bootstrap();
            }, 1000);
        }
    }

    bootstrap();
}


/* Code that is NOT injected into the page */
(function(){
    'use strict';

    var alertUpdate = false;
    var wecmVersion = GM_info.script.version;
    var wecmChangesHeader = "Waze Edit Count Monitor has been updated.\nv" + wecmVersion + "\n\nWhat's New\n-------------------------";
    var wecmChanges = wecmChangesHeader + "\n- Should now work in FF Greasemonkey and in WME beta.";

    function getEditorProfileFromSource(source) {
        var match = source.match(/gon.data=({.*?});gon.env=/i);
        return JSON.parse(match[1]);
    }

    function getEditCountFromProfile(profile) {
        var editingActivity = profile.editingActivity;
        return editingActivity[editingActivity.length-1];
    }

    function getURCountFromProfile(profile) {
        var editsByType = profile.editsByType;
        for (var i=0; i < editsByType.length; i++) {
            if (editsByType[i].key === 'mapUpdateRequest') {
                return editsByType[i].value;
            }
        }
        return -1;
    }

    // Handle messages from the page.
    function receiveMessage(event) {
        var msg;
        try {
            msg = JSON.parse(event.data);
        }
        catch (err) {
            // Ignore errors
        }

        if (msg && msg[0] === "wecmGetCounts") {
            var userName = msg[1];
            GM_xmlhttpRequest({
                method: "GET",
                url: 'https://www.waze.com/user/editor/' + userName,
                onload: function(res) {
                    var profile = getEditorProfileFromSource(res.responseText);
                    window.postMessage(JSON.stringify(['wecmUpdateUi',[getEditCountFromProfile(profile), getURCountFromProfile(profile)]]),'*');
                }
            });
        }
    }

    $(document).ready(function() {
        /* Check version and alert on update */
        if (alertUpdate && (!window.localStorage.wecmVersion || wecmVersion !== window.localStorage.wecmVersion)) {
            alert(wecmChanges);
            window.localStorage.wecmVersion = wecmVersion;
        }
    });

    // Inject the page script.
    $('head').append(
        $('<script>', {type:'application/javascript'}).html('(' + WECM_Injected.toString() + ')();')
    );

    // Listen for events coming from the page script.
    window.addEventListener('message', receiveMessage);
})();
