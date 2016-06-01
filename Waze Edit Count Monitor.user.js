// ==UserScript==
// @name         Waze Edit Count Monitor
// @namespace    
// @version      0.7
// @description  Displays your daily edit count in the WME toolbar.  Warns if you might be throttled.
// @author       MapOMatic
// @include      https://editor-beta.waze.com/*editor/*
// @include      https://www.waze.com/*editor/*
// @exclude      https://www.waze.com/*user/editor/*
// @grant        none
// ==/UserScript==

(function() {
    var alertUpdate = true;
    var wecmVersion = "0.7";
    var wecmChangesHeader = "Waze Edit Count Monitor has been updated.\nv" + wecmVersion + "\n\nWhat's New\n-------------------------";
    var wecmChanges = wecmChangesHeader + "\n- Fixed bug that was causing WME Toolbox (and other scripts) to crash.";
    var debugLevel = 0;
    var $outputElem = null;
    var $outputElemContainer = null;
    var pollingTime = 1000;  // Time between checking for saves (msec).
    var lastEditCount = null;
    var lastCanSave = true;
    var userName = null;
    var savesWithoutIncrease = 0;
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
            $.ajax({url: 'https://www.waze.com/user/editor/' + userName,
                    success: function(data){
                        updateEditCount(getEditCountFromEditorData(data));
                    }
                   });
        }
        lastCanSave = canSave;
    }

    // This is a hack, because I haven't had time to figure out how to listen for a 'save' event yet.
    function loopCheck() {
        checkForSave();
        setTimeout(loopCheck, pollingTime);
    }

    function getEditCountFromEditorData(data) {
        var match = data.match(/W.EditorProfile.data\s=\sJSON.parse\(\'(.*)\'\)/i);
        var editingActivity = JSON.parse(match[1]).editingActivity;
        var editCount = editingActivity[editingActivity.length-1];
        return editCount;
    }

    function updateEditCount(editCount) {
        var textColor;
        var bgColor;
        var tooltipTextColor;

        log('edit count = ' + editCount, 1);
        if (lastEditCount !== editCount) {
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
        $outputElem.css('color', textColor);
        $outputElem.html('Edits:&nbsp;' + editCount);
        var additionalText = (savesWithoutIncrease > 0) ? "<div style='border-radius:8px;padding:3px;margin-top:8px;margin-bottom:5px;color:"+ tooltipTextColor + ";background-color:" + bgColor + "'>" + savesWithoutIncrease + ' consecutive saves without an increase. (Are you throttled?)</div>' : '';
        $outputElem.attr('data-original-title', tooltipText + additionalText);
        //if(savesWithoutIncrease === 0 && lastEditCount !== null) {
            //$outputElem.css('color','#00BB00');
            //$outputElem.animate({'color':'#59899e'}, 2000);
        //}
        lastEditCount = editCount;
    }

    function test() {
        console.log("saved!");
    }
    function init() {
        'use strict';

        /* Check version and alert on update */
        if (alertUpdate && ('undefined' === window.localStorage.wecmVersion ||
                            wecmVersion !== window.localStorage.wecmVersion)) {
            alert(wecmChanges);
            window.localStorage.wecmVersion = wecmVersion;
        }

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

        loopCheck();

        log('Initialized.',0);
    }

    function bootstrap()
    {
        if (window.W && window.W.loginManager &&
            window.W.loginManager.events.register &&
            window.W.map && window.W.loginManager.isLoggedIn()) {
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
})();

