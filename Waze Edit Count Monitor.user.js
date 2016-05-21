// ==UserScript==
// @name         Waze Edit Count Monitor
// @namespace    
// @version      0.1
// @description  Displays your daily edit count in the WME footer.
// @author       MapOMatic
// @include      https://www.waze.com/editor/*
// @include      https://www.waze.com/*/editor/*
// @include      https://editor-beta.waze.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var debug = true;

    window.addEventListener('load', function() {
        var userNameElement = getElementsByTagName('H3')[0];
        var userName = userNameElement.innerHTML.trim();
        var outputElement = null;
        runIt();

        function runIt() {
            $.ajax({url: "https://www.waze.com/user/editor/" + userName,
                    type: "GET",
                    success: function(data) {
                        var editCount = getEditCountFromEditorData(data);
                        if (outputElement === null) {
                            var footer = getElementsByClassName('WazeMapFooter')[0];
                            outputElement = document.createTextNode(editCount);
                            footer.insertBefore(outputElement, footer.firstElementChild);
                        }
                        else {
                            outputElement.nodeValue = editCount;
                        }
                    }
                   });
            setTimeout(runIt, 3000);
        }


        function getEditCountFromEditorData(data) {
            var pattern = /W.EditorProfile.data\s=\sJSON.parse\(\'(.*)\'\)/i;
            var match = data.match(pattern);
            var editorProfileData = JSON.parse(match[1]);
            var editCount = editorProfileData.editingActivity[editorProfileData.editingActivity.length-1];
            return editCount;
        }

        function getElementsByClassName (className) {
            var nodeList = [];
            function test(node) {
                if (node.classList){
                    if (node.classList.contains(className)) {
                        nodeList.push(node);
                    }
                }
                for (var index = 0; index < node.childNodes.length; index++) {
                    test(node.childNodes[index]);
                }
            }
            test(document.body);
            return nodeList;
        }

        function getElementsByTagName (tagName) {
            var nodeList = [];
            function test(node) {
                if (node.tagName == tagName) {
                    nodeList.push(node);
                }
                for (var index = 0; index < node.childNodes.length; index++) {
                    test(node.childNodes[index]);
                }
            }
            test(document.body);
            return nodeList;
        }
    }, false);
})();