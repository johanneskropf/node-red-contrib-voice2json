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
    
    function Voice2JsonTrainingNode(config) {
        RED.nodes.createNode(this, config);
        this.sentences = config.sentences;
        this.inputField = config.inputField;
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
            let inputMsg = RED.util.getMessageProperty(msg, node.inputField);
            
            if(inputMsg !== "train"){
                node.warn('send a msg with a string of "train" as the the configured input msg property to train the selected profile');
                node_status("not a train payload, doing nothing","yellow","dot",1500);
                return;
            }
            
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
            
            node_status("training...","blue","dot",60000);
            
            const voice2json = "voice2json --profile " + node.profilePath + " train-profile";
            
            node.childProcess = exec(voice2json, (error, stdout, stderr) => {
                let outputValue;
                
                delete node.childProcess;
                
                if (error) {
                    node.error(error.message);
                    node_status("error","red","dot",1500);
                    return;
                }
                /*if (stderr) {
                    node.error(stderr);
                    node_status("stderr:error","red","dot",1500);
                    return;
                }*/
                
                outputValue = "result:\n" + stdout;
                if(stderr) outputValue += stderr; //voice2json sends ngram and kalditraining results to stderr even if successful
                
                try {
                    // Set the converted value in the specified message field (of the original input message)
                    RED.util.setMessageProperty(msg, node.outputField, outputValue, true);
                } catch(err) {
                    node.error("Error setting value in msg.payload: " + err.message);
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
    RED.nodes.registerType("voice2json-training", Voice2JsonTrainingNode);
}
