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
    
    function Voice2JsonRecordCommandNode(config) {
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
        
        function notNowWait(){
            node.notNow = true;
            node.warn("timeout started");
            setTimeout(() => {
                node.notNow = false;
                node.warn("timeout finished");
            }, 3000);
        }
        
        function spawnRecord(){
            let msg = {};
            try{
                node.recordCommand = spawn("voice2json",["--profile",node.profilePath,"record-command","--audio-source","-","--wav-sink","-"]);
            } 
            catch (error) {
                node_status2("error starting","red","ring",1);
                node.error(error);
                return;
            }
            
            node_status2("recording from stream","blue","dot",1);
            
            node.recordCommand.stderr.on('data', (data)=>{
                node.error("stderr: " + data.toString());
                node_status("error","red","dot",1500);
                return;
            });
            
            node.recordCommand.on('close', function (code,signal) {
                
                node.outputBuffer = Buffer.concat(node.outputBufferArr);
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, node.outputBuffer, true);
                } catch(err) {
                    node.error("Error setting value in msg." + node.outputField + " : " + err.message);
                    node_status("error","red","dot",1500);
                    return;
                }
            
                node.send(msg);
                node.outputBufferArr = [];
                node_status("finished","green","dot",1500);
                node.warn("done");
                delete node.recordCommand;
                return;
                
            });
            
            node.recordCommand.stdout.on('data', (data)=>{
                
                if(!node.notNow) { notNowWait(); }
                node.outputBufferArr.push(data);
                
            });
            return;
            
        }
         
        function writeStdin(chunk){
            
            try {
                node.recordCommand.stdin.write(chunk);
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

        node.on("input", function(msg) {
            
            node.inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            
            if(!node.notNow){
	            if(!node.recordCommand){
	                node.warn("starting")
	                if(Buffer.isBuffer(node.inputMsg)){
	                    spawnRecord();
	                }
	            } else {
	                if(Buffer.isBuffer(node.inputMsg)){
	                    writeStdin(node.inputMsg);
	                }
	            }
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
            
            if(node.recordCommand) {
                node.recordCommand.kill();
                delete node.recordCommand;
            }
        });
    }
    RED.nodes.registerType("voice2json-record-command", Voice2JsonRecordCommandNode);
}
