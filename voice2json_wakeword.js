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
    
    function Voice2JsonWakewordNode(config) {
        RED.nodes.createNode(this, config);
        this.inputField  = config.inputField;
        this.controlField = config.controlField;
        this.outputField = config.outputField;
		this.nonContinousListen = config.nonContinousListen;
        this.profilePath = "";
        this.statusTimer = false;
        this.statusTimer2 = false;
        this.pauseListen = false;
        this.initialTimeout = false;
        this.initialTimeoutTimer = false;
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
        
        function initialTimeoutFunction() {
            
            node.initialTimeout = true;
            if (node.initialTimeoutTimer) {
                clearTimeout(node.initialTimeoutTimer);
                node.initialTimeoutTimer = false;
            }
            node.initialTimeoutTimer = setTimeout(() => {
                node.initialTimeout = false;
                node.initialTimeoutTimer = false;
            }, 2000);
            
        }
        
        function spawnWake(){
            
            let msg = {};
            
            try{
                node.waitWake = spawn("voice2json",["--profile",node.profilePath,"wait-wake","--audio-source","-"],{detached:true});
            } 
            catch (error) {
                node_status(["error starting","red","ring"],1500);
                node.error(error);
                return;
            }
            
            node_status(["listening to stream","blue","dot"]);
            
            node.waitWake.stderr.on('data', (data)=>{
                node.error("stderr: " + data.toString());
                node_status(["error","red","dot"],1500);
                return;
            });
            
            node.waitWake.on('close', function (code,signal) {
                
                node.warn("stopped");
                delete node.waitWake;
                node_status(["stopped","grey","ring"],1500,["waiting for audio","grey","ring"]);
                return;
                
            });
            
            node.waitWake.stdout.on('data', (data)=>{
                if (!node.pauseListening && node.nonContinousListen) {
                    node.pauseListening = true;
                } else if (node.pauseListening && node.nonContinousListen) {
                    node.warn("wake-word detetected but ignoring as as audio is already beeing forwarded");
                    return;
                }
                
                try {
                    node.outputValue = JSON.parse(data.toString());
                }
                catch(error) {
                    node.error("Error parsing json output : " + error.message);
                    if(node.waitWake){
                        node_status(["error parsing json","red","dot"],1500,["listening to stream","blue","dot"]);
                    } else {
                        node_status(["error parsing json","red","dot"],1500);
                    }
                    return;
                }
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, node.outputValue, true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    if(node.waitWake){
                        node_status(["error","red","dot"],1500,["listening to stream","blue","dot"]);
                    } else {
                        node_status(["error","red","dot"],1500);
                    }
                    return;
                }
            
                node.send([msg,null]);
                
                if (node.nonContinousListen) {
                   node_status(["wake word detetected","green","dot"],1000,["forwarding audio","blue","ring"]);
                } else {
                    node_status(["wake word detetected","green","dot"],1000,["listening to stream","blue","dot"]);
                }
                
            });
            return;
            
        }
         
        function writeStdin(chunk){
            
            try {
                node.waitWake.stdin.write(chunk);
            }
            catch (error){
                node.error("couldn't write to stdin: " + error);
                if(node.waitWake){
                    node_status(["error writing chunk","red","dot"],1500,["listening to stream","blue","ring"]);
                } else {
                    node_status(["error writing chunk","red","dot"],1500);
                }
            }
            return;
            
        }
        
        initialTimeoutFunction();
        
        node_status(["waiting for audio","grey","ring"]);
        
        // Retrieve the config node
        node.voice2JsonConfig = RED.nodes.getNode(config.voice2JsonConfig);
        
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
        
        
        node.on("input", function(msg) {
            
            if (node.initialTimeout) { return; }
            
            node.inputMsg = (node.controlField in msg) ? RED.util.getMessageProperty(msg, node.controlField) : RED.util.getMessageProperty(msg, node.inputField);
            
            switch (node.inputMsg){
            
                case "stop":
                    
                    if(node.waitWake){
                        
                        initialTimeoutFunction();
                        process.kill(-node.waitWake.pid);
                        
                    } else {
                        node.warn("not started yet");
                    }
                    return;
                    
                case "listen":
                
                    if(node.pauseListening === true){
                        node.pauseListening = false;
                        node_status(["listening to stream","blue","dot"]);
                    } else {
                        node.warn("already listening");
                    }
                    return;
                    
                default:
            
                    if(node.pauseListening) { node.send([null,msg]) } 
	                if(!node.waitWake){
	                    node.warn("starting")
	                    spawnWake();
	                } else {
	                    if(Buffer.isBuffer(node.inputMsg)) { writeStdin(node.inputMsg) }
	                }
			        return;
			        
			}
            
        });
        
        node.on("close",function() {
            
            node_status();
            
            if (node.initialTimeoutTimer) {
                clearTimeout(node.initialTimeoutTimer);
                node.initialTimeoutTimer = false;
            }
            
            if(node.waitWake) {
                process.kill(-node.waitWake.pid);
            }
            
        });
    }
    RED.nodes.registerType("voice2json-wait-wake", Voice2JsonWakewordNode);
}
