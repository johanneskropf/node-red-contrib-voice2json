  
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
    const { spawn } = require("child_process");
    const fs = require("fs");
    
    function Voice2JsonSpeechToTextNode(config) {
        RED.nodes.createNode(this, config);
        this.inputField  = config.inputField;
        this.inputType = config.inputType;
        this.outputField = config.outputField;
        this.profilePath = ""; //todo add check for length at execution
        this.validPath = false;
        this.statusTimer = false;
        this.statusTimer2 = false;
        this.processingNow = false;
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
        
        function spawnTranscribe(msg){
            try{
                node.transcribeWav = spawn("voice2json",["--profile",node.profilePath,"transcribe-wav","--stdin-file"]);
            } 
            catch (error) {
                node_status2("error strating","red","ring",1);
                node.error(error);
            }
            
            node_status2("running","blue","ring",1);
            
            node.transcribeWav.stderr.on('data', (data)=>{
                node.processingNow = false;
                node.error(data.toString());
                node_status("error","red","dot",1500);
                node_status2("stopped","grey","ring",1500);
                return;
            });
            
            node.transcribeWav.on('close', function (code,signal) {
                node_status2("stopped","grey","ring",1);
            });
            
            node.transcribeWav.stdout.on('data', (data)=>{
            
                node.processingNow = false;
                node.transcription = data.toString();
                
                try {
                    node.outputValue = JSON.parse(node.transcription);
                }
                catch(error) {
                    node.error("Error parsing json output : " + error.message);
                    node_status("error parsing json","red","dot",1500);
                    node_status2("running","blue","ring",1500);
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
            
                node.send(msg);
                node_status("success","green","dot",1500);
                node_status2("running","blue","ring",1500);
                return;
            });
            return;
            
        }
        
        function writeStdin(msg){
            
            node_status("processing...","blue","dot",15000);
            node.processingNow = true;
            
            if (node.inputType === "msg") {
                try {
                    // Get the file path from the specified message field
                    node.filePath = RED.util.getMessageProperty(msg, node.inputField);
                } 
                catch(err) {
                    node.error("Error getting file path from msg." + node.inputField + " : " + err.message);
                    node_status("couldn't get file path from msg","red","dot",1500);
                    node_status2("running","blue","ring",1500);
                    return;
                }
                
                if (!node.filePath || node.filePath === "" || typeof node.filePath !== 'string') {
                    node.error("The msg." + node.inputField + " should contain a file path");
                    node_status("file path format is not valid","red","dot",1500);
                    node_status2("running","blue","ring",1500);
                    return;
                }
            }
            else { // str
                node.filePath = node.inputField;
            }

            if (!fs.existsSync(node.filePath)){
                node.error("The file path does not exist");
                node_status("file path does not exist","red","dot",1500);
                node_status2("not started","grey","ring",1500);
                return;
            }
            
            node.filePath += "\n";
            node.transcribeWav.stdin.write(node.filePath);
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

        node.on("input", function(msg) {
        
            let inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            
            if(inputMsg === "start"){
                if(node.transcribeWav){
                    node.warn("restarting");
                    node.transcribeWav.kill();
                    delete node.transcribeWav;
                } else {
                    node.warn("starting");
                }
                spawnTranscribe(msg);
                return;
            } else if(inputMsg === "stop" && node.transcribeWav){
                node.transcribeWav.kill();
                delete node.transcribeWav;
                return;
            } 
            
            if(node.processingNow == true) {
                let warnmsg = "Ignoring input message because the previous message is not processed yet";
                console.log(warnmsg);
                node.warn(warnmsg);
                return;
            }
            
            writeStdin(msg);  
            return;           
            
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
            
            if(node.transcribeWav) {
                node.transcribeWav.kill();
                delete node.transcribeWav;
            }
        });
    }
    RED.nodes.registerType("voice2json-stt", Voice2JsonSpeechToTextNode);
}
