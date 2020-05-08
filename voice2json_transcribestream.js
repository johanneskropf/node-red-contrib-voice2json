  
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
        this.inputStream = config.inputStream;
        this.profilePath = "";
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
        
        function record_transcribe(msg){
            
            node_status("transcribing...","blue","dot",15000);
            
            //spawn both a sox rec and a transcribe-stream and pipe to each other
            node.rec = spawn('rec',['-r',16000,'-c',1,'-b',16,'-t','raw','-']);
            node.transcribe = spawn('voice2json',['--profile',node.profilePath,'transcribe-stream','--audio-source','-']);
            node.rec.stdout.pipe(node.transcribe.stdin);
            //wait for data
            node.transcribe.stdout.on('data', (data)=>{
                node.rec.kill('SIGINT');
                delete node.rec;
                node.transcribe.kill('SIGINT');
                delete node.transcribe;
                node.transcription = data.toString();
                try {
                    node.outputValue = JSON.parse(node.transcription);
                } catch(error) {
                    node.error("Error parsing json output : " + error.message);
                    node_status("error parsing json","red","dot",1500);
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
                return;
            });
            
            //rec stderr is just the sox rec progress output
            
            node.transcribe.stderr.on('data', (data)=>{
                node.error("transcribe error: " + data.toString());
                node_status("error","red","dot",1500);
                return;
            });
            
            //on exit for either would be triggered by killing above
        }
        
        function stream_transcribe(msg){
            let inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            
            //check if payload is a buffer
            if(!Buffer.isBuffer(inputMsg)){
                node.error("input msg needs to be a buffer")
                node_status("error","red","dot",1500);
                return;
            } 
            
            //check if were already runing
            if(!node.transcribe){
                
                node_status("transcribing...","blue","dot",15000);
                
                //spawn a new transcribe-stream process
                node.transcribe = spawn('voice2json',['--profile',node.profilePath,'transcribe-stream','--audio-source','-']);
                node.transcribe.stdin.write(inputMsg);
                //wait for the data
                node.transcribe.stdout.on('data', (data)=>{
                    
                    node.transcribe.kill('SIGINT');
                    delete node.transcribe;
                    node.transcription = data.toString();
                    
                    try {
                        node.outputValue = JSON.parse(node.transcription);
                    } catch(error) {
                        node.error("Error parsing json output : " + error.message);
                        node_status("error parsing json","red","dot",1500);
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
                    return;
                });
                
                node.transcribe.stderr.on('data', (data)=>{
                    node.error("transcribe error: " + data.toString());
                    node_status("error","red","dot",1500);
                    return;
                });
                
            } else if(node.transcribe){
                
                //as were already runnign feed directly to stdin
                node.transcribe.stdin.write(inputMsg);
                return
                
            } 
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

            if(!node.validPath){
                node.error("Profile path doesn't exist. Please check the profile path");
                node_status("profile path error","red","dot",1500);
                return;
            }
            //check in which mode were in
            if(!node.inputStream){
                record_transcribe(msg);
            } else {
                stream_transcribe(msg);
            }
            
            return;    
        });
        
        node.on("close",function() {
            if(node.statusTimer !== false){
               clearTimeout(node.statusTimer);
               node.statusTimer = false;
               node.status({});
            }
            if(node.rec) {
                node.rec.kill();
                delete node.rec;
            }
            if(node.transcribe) {
                node.transcribe.kill();
                delete node.transcribe;
            }
        });
    }
    RED.nodes.registerType("voice2json-transcribe-stream", Voice2JsonTranscribeStreamNode);
}
