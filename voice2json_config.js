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
    const path = require('path');
    const chmod = require('chmod');
    
    function Voice2JsonConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.sentences   = config.sentences;
        this.profilePath = config.profilePath;
        this.slots       = config.slots;
        this.removeSlots = config.removeSlots;
        
        var node = this;
       
        //bare bones save to file implementation if sentences.ini was loaded
        var sentencesFilePath = path.join(node.profilePath, "sentences.ini");

        // Only store the sentences if available, otherwise we risc to loose the original sentences.ini file
        if (node.sentences) {
            try{
                fs.writeFileSync(sentencesFilePath, node.sentences);
            }
            catch(err){
                console.log("Cannot write to sentences file (" + sentencesFilePath + "): " + err);
            }
        }
        
        // Directory 'slots' for all the slot files
        var slotsDirectory = path.join(node.profilePath, "slots");
        
        // Make sure the 'slots' directory always exists
        if (!fs.existsSync(slotsDirectory)) {
            try {
                fs.mkdirSync(slotsDirectory);
            } 
            catch (err) {
                node.error("Cannot create directory (" + slotsDirectory + "): " + err);
                return;
            }
        }
        
        if (node.removeSlots) {
            var currentSlotfiles;
            
            try {
                currentSlotfiles = fs.readdirSync(slotsDirectory);
            }
            catch (err) {
                node.error("Cannot read file list from slots directory (" + slotsDirectory + "): " + err);
                return;
            }
            
            currentSlotfiles.forEach(function (currentSlotFile, index) {
                var specifiedFiles = node.slots.filter(function(slot) {
                    return slot.fileName === currentSlotFile;
                });
                
                // Remove the file if it has not been specified anymore in the node.slots array
                if (specifiedFiles.length === 0) {
                    var slotFileToRemove = path.join(node.profilePath, "slots", currentSlotFile);
                    
                    try {
                        fs.unlinkSync(slotFileToRemove);
                    }
                    catch(err) {
                        node.error("Cannot remove slot file (" + slotFileToRemove + "): " + err);
                        return; // Process next slot file
                    }
                }
            })
        }
                
        node.slots.forEach(function (slot, index) {
            var slotFilePath = path.join(slotsDirectory, slot.fileName);
            
            //Create all the specified slot files, when they don't exist yet
            if (!fs.existsSync(slotFilePath)) {
                try {
                    fs.closeSync(fs.openSync(slotFilePath, 'w'));
                } 
                catch (err) {
                    node.error("Cannot create slot file (" + slotsDirectory + "): " + err);
                    return; // Process next slot file
                }
            }

            // Write the specified content to the slot files (only for files that are managed by Node-RED)
            if (slot.managedBy === "nodered") {
                try {
                    fs.writeFileSync(slotFilePath, slot.fileContent);
                } 
                catch (err) {
                    node.error("Cannot write content to slot file (" + slotsDirectory + "): " + err);
                    return; // Process next slot file
                }
            }
            
            // The slot file can be executable or not.
            // We only make it executable for the owner, not for the group or others.
            chmod(slotFilePath, {
                owner: {
                    execute: slot.executable
                }
            });
        });
        
        node.on('close', function(){
        });
    }
    
    RED.nodes.registerType("voice2json-config", Voice2JsonConfigNode);
    
    RED.httpAdmin.get("/voice2json-config/loadSentences", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        var filePath = path.join(req.query.profilePath, "sentences.ini");
        
        // Load the sentences file from the filesystem
        res.sendFile(filePath, {}, function(err) {
            if(err) {
                res.status(err.status).end()
            }
        });
    });
    
    RED.httpAdmin.get("/voice2json-config/loadSlot", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        var filePath = path.join(req.query.profilePath, "slots", req.query.fileName);
        
        // Load the specified slot file (managed by an EXTERNAL TOOL) from the filesystem.
        // For tht other slot files, Node-RED is the master (so Node-RED won't have to read those from here).
        res.sendFile(filePath, {}, function(err) {
            if(err) {
                res.status(err.status).end()
            }
        });
    });
}
