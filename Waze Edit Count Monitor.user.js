// ==UserScript==
// @name         Waze Edit Count Monitor
// @namespace    
// @version      0.4
// @description  Displays your daily edit count in the WME toolbar.
// @author       MapOMatic
// @include      https://editor-beta.waze.com/*editor/*
// @include      https://www.waze.com/*editor/*
// @exclude      https://www.waze.com/*user/editor/*
// @grant        none
// ==/UserScript==

function wecm_bootstrap()
{
    var bGreasemonkeyServiceDefined     = false;

    try
    {
        if ("object" === typeof Components.interfaces.gmIGreasemonkeyService)
        {
            bGreasemonkeyServiceDefined = true;
        }
    }
    catch (err)
    {
        //Ignore.
    }
    if ( "undefined" === typeof unsafeWindow  ||  ! bGreasemonkeyServiceDefined)
    {
        unsafeWindow    = ( function ()
                           {
            var dummyElem   = document.createElement('p');
            dummyElem.setAttribute ('onclick', 'return window;');
            return dummyElem.onclick ();
        } ) ();
    }
    /* begin running the code! */
    wecm_init();
}

function wecm_init() {
    'use strict';
	var debug = true;  // Set to true to log debug info to console.
		
    var $outputElem = null;
    var $outputElemContainer = null;
    var pollingTime = 1000;  // Time between checking for saves (msec).
    var lastEditCount = null;
    var lastCanSave = true;
    var userName = null;

    function getEditCountFromEditorData(data) {
        var match = data.match(/W.EditorProfile.data\s=\sJSON.parse\(\'(.*)\'\)/i);
        var editingActivity = JSON.parse(match[1]).editingActivity;
        var editCount = editingActivity[editingActivity.length-1];
        return editCount;
    }

    function updateEditCount(editCount) {
        logDebug('edit count=' + editCount);
        lastEditCount = editCount;
        $outputElem.html('Edits:&nbsp;' + editCount);
    }

    function checkForSave() {
        var canSave = W.model.actionManager.canSave();
        if (lastCanSave && !canSave) {
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
        setTimeout(function() { loopCheck(); }, pollingTime);
    }

    function logDebug(value) {
        if(debug) {
            console.log('[WECM]: ' + value);
        }
    }

    function showToolTip($elem, timeout) {
        $elem.tooltip('show');
        setTimeout(function() {$elem.tooltip('hide');}, timeout);
    }

    // Intentionally using window.addEventListener because $('document').ready() is triggered too soon -- at least in Chrome.
    window.addEventListener('load', function() {
        userName = W.loginManager.user.userName;
        $outputElemContainer = $('<div>', {style:'display: inline; float: right; padding-left: 5px; padding-right: 5px; margin-top: 9px; font-weight: bold; margin-right: 10px; margin-left: 10px; margin-bottom: 8px;font-size: medium;'});
        $outputElem = $('<a>', {id: 'wecm-count',
                                href:'javascript:void(null)',
                                style:'text-decoration:none',
                                'data-original-title': 'Your daily edit count from your profile.  Click to open your profile.'});
        //$outputElem.text('&nbsp;');
        $outputElem.click(function(){window.open('https://www.waze.com/user/editor/' + userName, '_blank');});
        $outputElemContainer.append($outputElem);
        $('.waze-icon-place').parent().prepend($outputElemContainer);
        $outputElem.tooltip({
            placement: 'auto top',
            delay: {show: 100, hide: 100},
            html: true,
            template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="my-tooltip-header"><b></b></div><div class="my-tooltip-body tooltip-inner" style="font-weight: 600; !important"></div></div>'
        });

        loopCheck();
        logDebug('loaded');
    }, false);
}


// then at the end of your script, call the bootstrap to get things started
wecm_bootstrap();