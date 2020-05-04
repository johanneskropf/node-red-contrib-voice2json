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
    const fs = require("fs");
    let sentencesSave = ""; //initiated as empty so we know if it changed
    
    function Voice2JsonConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.profilePath = config.profilePath;
        
        var node = this;
       
        //bare bones save to file implementation if sentences.ini was loaded
        node.sentencesFilePath = node.profilePath + "/sentences.ini";
        if(sentencesSave.length !== 0){
	        try{
	            fs.writeFileSync(node.sentencesFilePath, sentencesSave);
	        } catch(err){
	            console.log('couldn\'t write to file: ' + err);
	        }
	    }
        sentencesSave = ""; //reset after deploy
        
        node.on('close', function(){
		});
    }
    
    RED.nodes.registerType("voice2json-config", Voice2JsonConfigNode);
    
    //load the file from fs
    RED.httpAdmin.get("/voice2json-config/loadSentences", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        let fileContent = fs.readFileSync(req.query.profilePath + "/sentences.ini", 'utf8');
        res.json(fileContent);
    });
    
    //get the internal copy if config gets opened again before redeploy
    RED.httpAdmin.get("/voice2json-config/getSentences", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        res.json(sentencesSave);
    });
    
    //save an internal copy of the edits made in the config
    RED.httpAdmin.get("/voice2json-config/saveSentences", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        sentencesSave = req.query.sentences;
        res.json("success");
    });
}
