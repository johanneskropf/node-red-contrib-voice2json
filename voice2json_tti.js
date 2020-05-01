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
    const { exec } = require("child_process");
    const fs = require("fs");
    
    function Voice2JsonTextToIntentNode(config) {
        RED.nodes.createNode(this, config);
        this.inputField  = config.inputField;
        this.outputField = config.outputField;
        this.profilePath = ""; //todo add check for length at execution
        this.validPath = false;
        this.statusTimer = false;
        var node = this;
     
        function node_status(text,color,shape,time){
            node.status({fill:color,shape:shape,text:text});
            if(node.statusTimer !== false){
                clearTimeout(node.statusTimer);
                node.statusTimer = false;
            }
            node.statusTimer = setTimeout(() => {
                node.status({});
                node.statusTimer = false;
            },time);
        }

        // Retrieve the config node
        node.voice2JsonConfig = RED.nodes.getNode(config.voice2JsonConfig);
        
        if (node.voice2JsonConfig) {
            // Use the profile path which has been specified in the config node
            node.profilePath = node.voice2JsonConfig.profilePath;
            //check path
            if (fs.existsSync(node.profilePath)){
                node.validPath = true;
            }
        }

        node.on("input", function(msg) {
            let textToAnalyze = {
                text:""
            };
            
            if(node.childProcess) {
                let warnmsg = "Ignoring input message because the previous message is not processed yet";
                console.log(warnmsg);
                node.warn(warnmsg);
                return;
            }
            
            if(!node.validPath){
                node.error("Profile path doesn't exist. Please check the profile path");
                node_status("profile path error","red","dot",1500);
                return;
            }
            
            try {
                // Get the (spoken) text to analyze from the specified message field
                textToAnalyze.text = RED.util.getMessageProperty(msg, node.inputField);
            } 
            catch(err) {
                node.error("Error getting text to analyze from msg." + node.inputField + " : " + err.message);
                node_status("error getting text from msg","red","dot",1500);
                return;
            }
            
            if (!textToAnalyze.text || textToAnalyze.text === "" || typeof textToAnalyze.text !== 'string') {
                node.error("The msg." + node.inputField + " should contain a string with text to analyze");
                node_status("error: msg did not contain valid text","red","dot",1500);
                return;
            }
                
            // Convert the text to a JSON string for voice2json
            textToAnalyze = "'" + JSON.stringify(textToAnalyze) + "'";
            
            node_status("processing...","blue","dot",15000);
            
            const voice2json = "voice2json --profile " + node.profilePath + " recognize-intent " + textToAnalyze;
            
            node.childProcess = exec(voice2json, (error, stdout, stderr) => {
                let outputValue;
                
                delete node.childProcess;
                
                if (error) {
                    node.error(error.message);
                    node_status("error","red","dot",1500);
                    return;
                }
                if (stderr) {
                    node.error(stderr);
                    node_status("stderr:error","red","dot",1500);
                    return;
                }
                
                try {
                    outputValue = JSON.parse(stdout);
                }
                catch(error) {
                    node.error("Error parsing json output : " + error.message);
                    node_status("error parsing json","red","dot",1500);
                    return;
                }
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, outputValue, true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    node_status("error","red","dot",1500);
                    return;
                }
            
                node.send(msg);
                node_status("success","green","dot",1500);
                return;
            });
        });
        
        node.on("close",function() {
            if(node.statusTimer !== false){
               clearTimeout(node.statusTimer);
               node.statusTimer = false;
               node.status({});
            }
            if(node.childProcess) {
                node.childProcess.kill();
                delete node.childProcess;
            }
        });
    }
    RED.nodes.registerType("voice2json-tti", Voice2JsonTextToIntentNode);
}
