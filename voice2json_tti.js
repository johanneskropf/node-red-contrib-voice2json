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
        
        function node_status2(text,color,shape,time){
            if(node.statusTimer2 !== false){
                clearTimeout(node.statusTimer2);
                node.statusTimer2 = false;
            }
            node.statusTimer2 = setTimeout(() => {
                node.status({fill:color,shape:shape,text:text});
                node.statusTimer2 = false;
            },time);
        }
        
        function spawnRecognize(msg){
            try{
                node.recognizeIntent = spawn("voice2json",["--profile",node.profilePath,"recognize-intent","--text-input"],{detached:true});
            } 
            catch (error) {
                node_status2("error starting","red","ring",1);
                node.error(error);
                return;
            }
            
            node_status2("running","blue","ring",1);
            
            node.recognizeIntent.stderr.on('data', (data)=>{
                node.error("stderr: " + data.toString());
                node_status("error","red","dot",1500);
                if(node.recognizeIntent){
                    node_status2("running","blue","ring",1600);
                }
                return;
            });
            
            node.recognizeIntent.on('close', function (code,signal) {
                node.processingNow = false;
                delete node.recognizeIntent;
                node.warn("stopped");
                node_status2("stopped","grey","ring",1);
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
                    node_status("error parsing json","red","dot",1500);
                    if(node.recognizeIntent){
                        node_status2("running","blue","ring",1600);
                    }
                    return;
                }
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, node.outputValue, true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    node_status("error","red","dot",1500);
                    if(node.recognizeIntent){
                        node_status2("running","blue","ring",1600);
                    }
                    return;
                }
            
                node.send(msg);
                node_status("success","green","dot",1500);
                if(node.recognizeIntent){
                    node_status2("running","blue","ring",1600);
                }
                return;
            });
            return;
            
        }
        
        function writeStdin(msg){
            
            node_status("processing...","blue","dot",15000);
           
            try {
                // Get the text to analyze from input
                node.inputText = RED.util.getMessageProperty(msg, node.inputField);
            } 
            catch(err) {
                node.error("Error getting text from msg." + node.inputField + " : " + err.message);
                node_status("couldn't text from msg","red","dot",1500);
                if(node.recognizeIntent){
                    node_status2("running","blue","ring",1600);
                }
                return;
            }
                
            if (!node.inputText || node.inputText === "" || typeof node.inputText !== 'string') {
                node.error("The msg." + node.inputField + " should contain a text to do intent recognition on");
                node_status("input text format is not valid","red","dot",1500);
                if(node.recognizeIntent){
                    node_status2("running","blue","ring",1600);
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
                node_status("error","red","dot",1500);
                node.processingNow = false;
                if(node.recognizeIntent){
                    node_status2("running","blue","ring",1600);
                }
            }
            return;
            
        }

        // Retrieve the config node
        node.voice2JsonConfig = RED.nodes.getNode(config.voice2JsonConfig);
        node_status2("not started","grey","ring",1);
        
        if (node.voice2JsonConfig) {
            // Use the profile path which has been specified in the config node
            node.profilePath = node.voice2JsonConfig.profilePath;
            //check path
            if (!fs.existsSync(node.profilePath)){
                node.error("Profile path doesn't exist. Please check the profile path");
                node_status("profile path error","red","dot",1500);
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
            if(node.statusTimer !== false){
               clearTimeout(node.statusTimer);
               node.statusTimer = false;
               node.status({});
            }
            
            if(node.statusTimer2 !== false){
               clearTimeout(node.statusTimer2);
               node.statusTimer2 = false;
               node.status({});
            }
            
            if(node.recognizeIntent) {
                process.kill(-node.recognizeIntent.pid);
            }
        });
    }
    RED.nodes.registerType("voice2json-tti", Voice2JsonTextToIntentNode);
}
