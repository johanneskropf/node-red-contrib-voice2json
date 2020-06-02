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
    const { spawn } = require("child_process");
    const fs = require("fs");
    
    function Voice2JsonTextToIntentNode(config) {
        RED.nodes.createNode(this, config);
        this.inputField  = config.inputField;
        this.outputField = config.outputField;
        this.profilePath = "";
        this.inputText = "";
        this.inputMsg = null;
        this.statusTimer = false;
        this.statusTimer2 = false;
        this.processingNow = false;
        this.autoStart = config.autoStart;
        this.msgObj = {};
        var node = this;
     
        function node_status(state1 = [], timeout = 0, state2 = []){
            
            if (state1.length !== 0) {
                node.status({fill:state1[1],shape:state1[2],text:state1[0]});
            } else {
                node.status({});
            }
            
            if (node.statusTimer !== false) {
                clearTimeout(node.statusTimer);
                node.statusTimer = false;
            }
            
            if (timeout !== 0) {
                node.statusTimer = setTimeout(() => {
                
                    if (state2.length !== 0) {
                        node.status({fill:state2[1],shape:state2[2],text:state2[0]});
                    } else {
                        node.status({});
                    }
                    
                    node.statusTimer = false;
                    
                },timeout);
            }
            
        }
        
        function spawnRecognize(msg){
            try{
                node.recognizeIntent = spawn("voice2json",["--profile",node.profilePath,"recognize-intent","--text-input"],{detached:true});
            } 
            catch (error) {
                node_status(["error starting","red","ring"]);
                node.error(error);
                return;
            }
            
            node_status(["running","blue","ring"]);
            
            node.recognizeIntent.stderr.on('data', (data)=>{
                node.error("stderr: " + data.toString());
                if(node.recognizeIntent){
                    node_status(["error","red","dot"],1500,["running","blue","ring"]);
                } else {
                    node_status(["error","red","dot"]);
                }
                return;
            });
            
            node.recognizeIntent.on('close', function (code,signal) {
                node.processingNow = false;
                delete node.recognizeIntent;
                node.warn("stopped");
                node_status(["stopped","grey","ring"]);
                return;
            });
            
            node.recognizeIntent.stdout.on('data', (data)=>{
            
                node.processingNow = false;
                node.intent = data.toString();
                
                try {
                    node.outputValue = JSON.parse(node.intent);
                }
                catch(error) {
                    node.error("Error parsing json output : " + error.message);
                    if(node.recognizeIntent){
                        node_status(["error parsing json ","red","dot"],1500,["running","blue","ring"]);
                    } else {
                        node_status(["error prsing json","red","dot"]);
                    }
                    return;
                }
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, node.outputValue, true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    if(node.recognizeIntent){
                        node_status(["error","red","dot"],1500,["running","blue","ring"]);
                    } else {
                        node_status(["error","red","dot"]);
                    }
                    return;
                }
            
                node.send(msg);
                if(node.recognizeIntent){
                    node_status(["success","green","dot"],1500,["running","blue","ring"]);
                } else {
                    node_status(["success","green","dot"],1500);
                }
                return;
            });
            return;
            
        }
        
        function writeStdin(msg){
            
            node_status(["processing...","blue","dot"]);
           
            try {
                // Get the text to analyze from input
                node.inputText = RED.util.getMessageProperty(msg, node.inputField);
            } 
            catch(err) {
                node.error("Error getting text from msg." + node.inputField + " : " + err.message);
                if(node.recognizeIntent){
                    node_status(["error","red","dot"],1500,["running","blue","ring"]);
                } else {
                    node_status(["error","red","dot"]);
                }
                return;
            }
                
            if (!node.inputText || node.inputText === "" || typeof node.inputText !== 'string') {
                node.error("The msg." + node.inputField + " should contain a text to do intent recognition on");
                if(node.recognizeIntent){
                    node_status(["error","red","dot"],1500,["running","blue","ring"]);
                } else {
                    node_status(["error","red","dot"]);
                }
                return;
            }

            node.processingNow = true;
            node.inputText += "\n";
            try {
                node.recognizeIntent.stdin.write(node.inputText);
            }
            catch (error){
                node.error("couldn't write to stdin: " + error);
                node.processingNow = false;
                if(node.recognizeIntent){
                    node_status(["error","red","dot"],1500,["running","blue","ring"]);
                } else {
                    node_status(["error","red","dot"]);
                }
            }
            return;
            
        }

        // Retrieve the config node
        node.voice2JsonConfig = RED.nodes.getNode(config.voice2JsonConfig);
        node_status(["not started","grey","ring"]);
        
        if (node.voice2JsonConfig) {
            // Use the profile path which has been specified in the config node
            node.profilePath = node.voice2JsonConfig.profilePath;
            //check path
            if (!fs.existsSync(node.profilePath)){
                node.error("Profile path doesn't exist. Please check the profile path");
                node_status(["profile path error","red","dot"]);
                return;
            }
        }
        
        if(node.autoStart){
            node.warn("starting");
            setTimeout(()=>{
                spawnRecognize(node.msgObj);
                return;
            }, 1500);
        }

        node.on("input", function(msg) {
            
            node.inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            node.msgObj = msg;
            switch (node.inputMsg){
            
                case "start":
 
                    if(node.recognizeIntent){
                        node.warn("restarting");
                        node.recognizeIntent.kill();
                        delete node.recognizeIntent;
                        setTimeout(()=>{
                            spawnRecognize(node.msgObj);
                            return;
                        }, 1500);
                    } else {
                        node.warn("starting");
                        spawnRecognize(node.msgObj);
                    }
                    return;
                    
                case "stop":
                
                    if(node.recognizeIntent){
                        node.warn("stopping");
                        process.kill(-node.recognizeIntent.pid);
                    } else {
                        node.warn("not running, nothing to stop");
                    }
                    return;
                    
                default:
            
                    if(node.processingNow == true) {
                        let warnmsg = "Ignoring input message because the previous message is not processed yet";
                        node.warn(warnmsg);
                    } else if(!node.recognizeIntent){
                        node.warn("not started, starting now!");
                        spawnRecognize(node.msgObj);
                        setTimeout(()=>{
                            writeStdin(node.msgObj);
                            return;
                        }, 1000);
                    } else {
                        writeStdin(node.msgObj);
                    }
                    return;
                    
            }  
            
        });
        
        node.on("close",function() {
            node_status();
            
            if(node.recognizeIntent) {
                process.kill(-node.recognizeIntent.pid);
            }
        });
    }
    RED.nodes.registerType("voice2json-tti", Voice2JsonTextToIntentNode);
}
