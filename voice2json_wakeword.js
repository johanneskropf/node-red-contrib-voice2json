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
        this.outputField = config.outputField;
        this.profilePath = "";
        this.statusTimer = false;
        this.statusTimer2 = false;
        this.pauseListen = false;
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
        
        function spawnWake(){
            
            let msg = {};
            
            try{
                node.waitWake = spawn("voice2json",["--profile",node.profilePath,"wait-wake","--audio-source","-"],{detached:true});
            } 
            catch (error) {
                node_status2("error starting","red","ring",1);
                node.error(error);
                return;
            }
            
            node_status2("listening to stream","blue","dot",1);
            
            node.waitWake.stderr.on('data', (data)=>{
                node.error("stderr: " + data.toString());
                node_status("error","red","dot",1500);
                return;
            });
            
            node.waitWake.on('close', function (code,signal) {
                
                node.warn("stopped");
                delete node.waitWake;
                node_status("stopped","grey","ring",1500);
                node_status2("waiting for audio","grey","ring",1600);
                return;
                
            });
            
            node.waitWake.stdout.on('data', (data)=>{
                if(!node.pauseListening){
                    node.pauseListening = true;
                } else {
                    node.warn("wake-word detetected but ignoring as as audio is already beeing forwarded");
                    return;
                }
                
                try {
                    node.outputValue = JSON.parse(data.toString());
                }
                catch(error) {
                    node.error("Error parsing json output : " + error.message);
                    node_status("error parsing json","red","dot",1500);
                    if(node.waitWake){
                        node_status2("listening to stream","blue","ring",1600);
                    }
                    return;
                }
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, node.outputValue, true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    node_status("error","red","dot",1500);
                    return;
                }
            
                node.send([msg,null]);
                
                node_status("wake word detetected","green","dot",1500);
                if(node.waitWake){
                    node_status2("forwarding audio","blue","ring",1600);
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
                node_status("error","red","dot",1500);
            }
            return;
            
        }
        
        // Retrieve the config node
        node.voice2JsonConfig = RED.nodes.getNode(config.voice2JsonConfig);
        
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
        
        node_status2("waiting for audio","grey","ring",1);

        node.on("input", function(msg) {
            
            node.inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            
            switch (node.inputMsg){
            
                case "stop":
                    
                    if(node.waitWake){
                        
                        process.kill(-node.waitWake.pid);
                        
                    } else {
                        node.warn("not started yet");
                    }
                    return;
                    
                case "listen":
                
                    if(node.pauseListening === true){
                        node.pauseListening = false;
                        node_status2("listening to stream","blue","dot",1);
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
            
            if(node.waitWake) {
                process.kill(-node.waitWake.pid);
            }
        });
    }
    RED.nodes.registerType("voice2json-wait-wake", Voice2JsonWakewordNode);
}
