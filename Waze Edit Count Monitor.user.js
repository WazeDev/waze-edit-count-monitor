// ==UserScript==
// @name         Waze Edit Count Monitor (beta)
// @namespace    
// @version      0.9.2.b0
// @description  Displays your daily edit count in the WME toolbar.  Warns if you might be throttled.
// @author       MapOMatic
// @include      https://beta.waze.com/*editor/*
// @include      https://www.waze.com/*editor/*
// @exclude      https://www.waze.com/*user/editor/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @grant        GM_xmlhttpRequest
// @connect      www.waze.com

// ==/UserScript==

function WECM_Injected() {
    var debugLevel = 0;
    var $outputElem = null;
    var $outputElemContainer = null;
    var pollingTime = 1000;  // Time between checking for saves (msec).
    var lastEditCount = null;
    var lastCanSave = true;
    var userName = null;
    var savesWithoutIncrease = 0;
    var lastURCount = null;
    var tooltipText = 'Your daily edit count from your profile.  Click to open your profile.';

    function log(message, level) {
        if (message && level <= debugLevel) {
            console.log('Edit Count Monitor: ' + message);
        }
    }

    function checkForSave() {
        var canSave = W.model.actionManager.canSave();
        var canRedo = W.model.actionManager.canRedo();
        if (lastCanSave && !canSave && !canRedo) {
            window.postMessage(JSON.stringify(['wecmGetCounts',userName]),'*');
        }
        lastCanSave = canSave;
    }

    // This is a hack, because I haven't had time to figure out how to listen for a 'save' event yet.
    function loopCheck() {
        checkForSave();
        setTimeout(loopCheck, pollingTime);
    }

    function updateEditCount(editCount, urCount) {
        var textColor;
        var bgColor;
        var tooltipTextColor;

        log('edit count = ' + editCount + ', UR count = ' + urCount.count, 1);
        if (lastEditCount !== editCount || lastURCount !== urCount.count) {
            savesWithoutIncrease = 0;
        } else {
            savesWithoutIncrease += 1;
        }

        switch (savesWithoutIncrease) {
            case 0:
            case 1:
                textColor = '';
                bgColor = '';
                tooltipTextColor = 'white';
                break;
            case 2:
                textColor = '';
                bgColor = 'yellow';
                tooltipTextColor = 'black';
                break;
            default:
                textColor = 'white';
                bgColor = 'red';
                tooltipTextColor = 'white';
        }
        $outputElemContainer.css('background-color', bgColor);
        $outputElem.css('color', textColor).html('Edits:&nbsp;' + editCount);
        var urCountText = "<div style='margin-top:8px;padding:3px;'>UR's&nbsp;Closed:&nbsp;" + urCount.count + "&nbsp;&nbsp;(since&nbsp;" + (new Date(urCount.since)).toLocaleDateString() + ")</div>";
        var warningText = (savesWithoutIncrease > 0) ? "<div style='border-radius:8px;padding:3px;margin-top:8px;margin-bottom:5px;color:"+ tooltipTextColor + ";background-color:" + bgColor + ";'>" + savesWithoutIncrease + ' consecutive saves without an increase. (Are you throttled?)</div>' : '';
        $outputElem.attr('data-original-title', tooltipText + urCountText + warningText);
        lastEditCount = editCount;
        lastURCount = urCount.count;
    }

    function receiveMessage(event) {
        var msg;
        try {
            msg = JSON.parse(event.data);
        }
        catch (err) {
            // Do nothing
        }

        if (msg && msg[0] === "wecmUpdateUi") {
            var editCount = msg[1][0];
            var urCount = msg[1][1];
            updateEditCount(editCount, urCount);
        }
    }

    function init() {
        'use strict';

        userName = W.loginManager.user.userName;
        $outputElemContainer = $('<div>', {style:'border-radius: 23px; height: 23px; display: inline; float: right; padding-left: 10px; padding-right: 10px; margin: 9px 5px 8px 5px; font-weight: bold; font-size: medium;'});
        $outputElem = $('<a>', {id: 'wecm-count',
                                href:'https://www.waze.com/user/editor/' + userName.toLowerCase(),
                                target: "_blank",
                                style:'text-decoration:none',
                                'data-original-title': tooltipText});
        $outputElemContainer.append($outputElem);
        $('.waze-icon-place').parent().prepend($outputElemContainer);
        $outputElem.tooltip({
            placement: 'auto top',
            delay: {show: 100, hide: 100},
            html: true,
            template: '<div class="tooltip" role="tooltip" style="opacity:0.95"><div class="tooltip-arrow"></div><div class="my-tooltip-header"><b></b></div><div class="my-tooltip-body tooltip-inner" style="font-weight: 600; !important"></div></div>'
        });

        window.addEventListener('message', receiveMessage);

        loopCheck();

        log('Initialized.',0);
    }

    function bootstrap()
    {
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
    var alertUpdate = true;
    var wecmVersion = GM_info.script.version;
    var wecmChangesHeader = "Waze Edit Count Monitor has been updated.\nv" + wecmVersion + "\n\nWhat's New\n-------------------------";
    var wecmChanges = wecmChangesHeader + "\n- Should now work in FF Greasemonkey and in WME beta.";

    function getEditorProfileFromSource(source) {
        var match = source.match(/W.EditorProfile.data\s=\s+JSON.parse\('(.*?)'\)/i);
        return JSON.parse(match[1]);
    }

    function getEditCountFromProfile(profile) {
        var editingActivity = profile.editingActivity;
        return editingActivity[editingActivity.length-1];
    }

    function getURCountFromProfile(profile) {
        var editsByType = profile.editsByType;
        for (i=0; i < editsByType.length; i++) {
            if (editsByType[i].key == 'mapUpdateRequest') {
                return editsByType[i].value;
            }
        }
        return -1;
    }

    // Listen for a message from the page.
    function receiveMessage(event) {
        var msg;
        try {
            msg = JSON.parse(event.data);
        }
        catch (err) {
            // Do nothing
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
        if (alertUpdate && ('undefined' === window.localStorage.wecmVersion ||
                            wecmVersion !== window.localStorage.wecmVersion)) {
            alert(wecmChanges);
            window.localStorage.wecmVersion = wecmVersion;
        }
    });

    var WECM_Injected_script = document.createElement("script");
    WECM_Injected_script.textContent = "" + WECM_Injected.toString() + " \n" + "WECM_Injected();";
    WECM_Injected_script.setAttribute("type", "application/javascript");
    document.body.appendChild(WECM_Injected_script);
    window.addEventListener('message', receiveMessage);

})();