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
    
    function Voice2JsonTranscribeStreamNode(config) {
        RED.nodes.createNode(this, config);
        this.inputField  = config.inputField;
        this.outputField = config.outputField;
        this.profilePath = "";
        this.statusTimer = false;
        this.statusTimer2 = false;
        this.processingNow = false;
        this.msgObj = {};
        this.outputBufferArr = [];
        this.outputBuffer = false;
        this.notNow = false;
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
        
        function notNowWait(){
            node.notNow = true;
            
            setTimeout(() => {
                node.notNow = false;
            }, 2000);
        }
        
        function spawnTranscribe(){
            let msg = {};
            try{
                node.transcribeStream = spawn("voice2json",["--profile",node.profilePath,"transcribe-stream","--audio-source","-","--exit-count","1"]);
            } 
            catch (error) {
                node_status(["error starting","red","ring"]);
                node.error(error);
                return;
            }
            
            node_status(["transcribing stream","blue","dot"]);
            
            node.transcribeStream.stderr.on('data', (data)=>{
                if (data.toString().match(/Ready/)) { return; }
                node.error("stderr: " + data.toString());
                node_status(["error","red","dot"]);
                return;
            });
            
            node.transcribeStream.on('close', function (code,signal) {
                
                node_status(["finished","green","dot"],1500);
                
                delete node.transcribeStream;
                return;
                
            });
            
            node.transcribeStream.stdout.on('data', (data)=>{
                
                if(!node.notNow) { notNowWait(); }
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, JSON.parse(data.toString()), true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    node_status(["error","red","dot"]);
                    return;
                }
            
                node.send(msg);
                
                //node.transcribeStream.kill();
                //delete node.transcribeStream;
                
            });
            return;
            
        }
         
        function writeStdin(chunk){
            
            try {
                node.transcribeStream.stdin.write(chunk);
            }
            catch (error){
                node.error("couldn't write to stdin: " + error);
                if (node.transcribeStream) {
                    node_status(["error writing chunk","red","dot"],1500,["transcribing stream","blue","dot"]);
                } else {
                    node_status(["error writing chunk","red","dot"],1500);
                }
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
                node_status(["profile path error","red","dot"]);
                return;
            }
        }

        node.on("input", function(msg) {
            
            node.inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            
            if(!node.notNow){
	            if(!node.transcribeStream){
	                if(Buffer.isBuffer(node.inputMsg)){
	                    spawnTranscribe();
	                }
	            } else {
	                if(Buffer.isBuffer(node.inputMsg)){
	                    writeStdin(node.inputMsg);
	                }
	            }
	        }
            
        });
        
        node.on("close",function() {
            node_status();
            
            if(node.transcribeStream) {
                node.transcribeStream.kill();
            }
        });
    }
    RED.nodes.registerType("voice2json-transcribe-stream", Voice2JsonTranscribeStreamNode);
}
