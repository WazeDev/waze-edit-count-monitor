// ==UserScript==
// @name            Waze Edit Count Monitor
// @namespace       https://greasyfork.org/en/users/45389-mapomatic
// @version         2024.10.27.000
// @description     Displays your daily edit count in the WME toolbar.  Warns if you might be throttled.
// @author          MapOMatic
// @include         /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @require         https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @require         https://update.greasyfork.org/scripts/509664/WME%20Utils%20-%20Bootstrap.js
// @license         GNU GPLv3
// @contributionURL https://github.com/WazeDev/Thank-The-Authors
// @grant           GM_xmlhttpRequest
// @grant           GM_addElement
// @grant           GM_addStyle
// @connect         www.waze.com
// @connect         greasyfork.org
// ==/UserScript==

/* global bootstrap */

(async function main() {
    'use strict';

    const downloadUrl = 'https://greasyfork.org/scripts/40313-waze-edit-count-monitor/code/Waze%20Edit%20Count%20Monitor.user.js';
    const sdk = await bootstrap({ scriptUpdateMonitor: { downloadUrl } });

    const TOOLTIP_TEXT = 'Your daily edit count from your profile. Click to open your profile.';

    let $outputElem = null;
    let $outputElemContainer = null;
    let userName;
    let savesWithoutIncrease = 0;
    let lastProfile;

    function log(message) {
        console.log('Edit Count Monitor:', message);
    }

    function updateEditCount() {
        sdk.DataModel.Users.getUserProfile({ userName }).then(profile => {
        // Add the counter div if it doesn't exist.
            if ($('#wecm-count').length === 0) {
                $outputElemContainer = $('<div>', { class: 'toolbar-button', style: 'font-weight: bold; font-size: 16px; border-radius: 10px; margin-left: 4px;' });
                const $innerDiv = $('<div>', { class: 'item-container', style: 'padding-left: 10px; padding-right: 10px; cursor: default;' });
                $outputElem = $('<a>', {
                    id: 'wecm-count',
                    href: sdk.DataModel.Users.getUserProfileLink({ userName }),
                    target: '_blank',
                    style: 'text-decoration:none',
                    'data-original-title': TOOLTIP_TEXT
                });
                $innerDiv.append($outputElem);
                $outputElemContainer.append($innerDiv);
                if ($('#toolbar > div > div.secondary-toolbar > div.secondary-toolbar-actions > div.secondary-toolbar-actions-edit').length) {
                // Production WME, as of 4/25/2023
                    $('#toolbar > div > div.secondary-toolbar > div.secondary-toolbar-actions > div.secondary-toolbar-actions-edit').after($outputElemContainer);
                } else {
                // Beta WME, as of 4/25/2023
                    $('#toolbar > div > div.secondary-toolbar > div:nth-child(1)').after($outputElemContainer);
                }
                $outputElem.tooltip({
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
                savesWithoutIncrease = 0;
            } else {
                savesWithoutIncrease++;
            }

            let textColor;
            let bgColor;
            let warningStyleClass;
            if (savesWithoutIncrease < 5) {
                textColor = '#354148';
                bgColor = 'white';
                warningStyleClass = '';
            } else if (savesWithoutIncrease < 10) {
                textColor = '#354148';
                bgColor = 'yellow';
                warningStyleClass = 'yellow';
            } else {
                textColor = 'white';
                bgColor = 'red';
                warningStyleClass = 'red';
            }
            $outputElemContainer.css('background-color', bgColor);

            $outputElem.css('color', textColor).html(profile.dailyEditCount[profile.dailyEditCount.length - 1].toLocaleString());
            const totalEditCountText = `<li>Total&nbsp;edits:&nbsp;${profile.totalEditCount.toLocaleString()}</li>`;
            const urCountText = `<li>URs&nbsp;closed:&nbsp;${profile.editCountByType.updateRequests.toLocaleString()}</li>`;
            const purCountText = `<li>PURs&nbsp;closed:&nbsp;${profile.editCountByType.placeUpdateRequests.toLocaleString()}</li>`;
            const mpCountText = `<li>MPs&nbsp;closed:&nbsp;${profile.editCountByType.mapProblems.toLocaleString()}</li>`;
            const segmentEditCountText = `<li>Segment&nbsp;edits:&nbsp;${profile.editCountByType.segments.toLocaleString()}</li>`;
            const placeEditCountText = `<li>Place&nbsp;edits:&nbsp;${profile.editCountByType.venues.toLocaleString()}</li>`;
            const hnEditCountText = `<li>Segment&nbsp;HN&nbsp;edits:&nbsp;${profile.editCountByType.segmentHouseNumbers.toLocaleString()}</li>`;
            let warningText = '';
            if (savesWithoutIncrease) {
                warningText = `<div class="wecm-warning ${warningStyleClass}">${savesWithoutIncrease} ${
                    (savesWithoutIncrease > 1) ? 'consecutive saves' : 'save'} without an increase. ${
                    (savesWithoutIncrease >= 5) ? '(Are you throttled?)' : ''}</div>`;
            }
            $outputElem.attr('data-original-title', `${
                TOOLTIP_TEXT}<ul>${
                totalEditCountText}${
                urCountText}${
                purCountText}${
                mpCountText}${
                segmentEditCountText}${
                hnEditCountText}${
                placeEditCountText}</ul>${
                warningText}`);
            lastProfile = profile;
        });
    }

    async function init() {
        userName = sdk.State.getUserInfo().userName;

        GM_addStyle(`
            .wecm-tooltip li {text-align: left;}
            .wecm-tooltip .wecm-warning {border-radius:8px; padding:3px; margin-top:8px; margin-bottom:5px;}
            .wecm-tooltip .wecm-warning.yellow {background-color:yellow; color:black;}
            .wecm-tooltip .wecm-warning.red {background-color:red; color:white;}
        `);

        sdk.Events.on({ eventName: 'wme-save-finished', eventHandler: onSaveFinished });
        // Update the edit count first time.
        updateEditCount();
        log('Initialized.');
    }

    function onSaveFinished(result) {
        if (result.success) updateEditCount();
    }

    init();
})();
