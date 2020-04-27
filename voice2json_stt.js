/**
 * Copyright 2020 Bart Butenaers & Johannes Kropf
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 module.exports = function(RED) {
    var settings = RED.settings;
    
    function Voice2JsonSpeechToTextNode(config) {
        RED.nodes.createNode(this, config);
        
        var node = this;
        
        const { exec } = require("child_process");
        
        // Retrieve the config node
        node.voice2JsonConfig = RED.nodes.getNode(config.voice2JsonConfig);
        
        if (node.voice2JsonConfig) {
            const profilePath = node.voice2JsonConfig.profilePath;
        }

        node.on("input", function(msg) {
            const filePath = msg.payload;
            const voice2json = "voice2json --profile " + profilePath + " transcribe-wav " + filePath;
            exec(voice2json, (error, stdout, stderr) => {
                if (error) {
                    node.error(error.message);
                    node.status({fill:"red",shape:"dot",text:"error"});
                    setTimeout(function(){
                       node.status({});
                    },1000);
                    return;
                }
                if (stderr) {
                    node.error(stderr);
                    node.status({fill:"red",shape:"dot",text:"error"});
                    setTimeout(function(){
                       node.status({});
                    },1000);
                    return;
                }
                const output = JSON.parse(stdout);
                const msg = {payload: output};
                send(msg);
                node.status({fill:"green",shape:"dot",text:"success"});
                setTimeout(function(){
                    node.status({});
                },1000);
                return;
            });
        });
        
        node.on("close",function() { 
        });
    }
    RED.nodes.registerType("voice2json-stt", Voice2JsonSpeechToTextNode);
}
