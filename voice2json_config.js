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
    
    // List all files in a directory recursively (synchronous).
    // The file path will be relative to the 'slots' or 'slot_programs' folders.
    function getFilesSync(rootPath, relativePath, filelist) {
        var fullPath = path.join(rootPath, relativePath);
        var files = fs.readdirSync(fullPath);
        filelist = filelist || [];
        files.forEach(function(file) {
            var newRelativePath = path.join(relativePath, file);
            if (fs.statSync(path.join(fullPath, file)).isDirectory()) {
                filelist = getFilesSync(rootPath, newRelativePath, filelist);
            }
            else {
                filelist.push(newRelativePath);
            }
        });
        return filelist;
    }
    
    function removeSlots(directory, node) {
        var currentSlotfiles = [];
        
        try {
            getFilesSync(directory, "" , currentSlotfiles);
        }
        catch (err) {
            node.error("Cannot read file list from slots directory (" + directory + "): " + err);
            return;
        }
        
        currentSlotfiles.forEach(function (currentSlotFile, index) {
            var specifiedFiles = node.slots.filter(function(slot) {
                return slot.fileName === currentSlotFile;
            });
            
            // Remove the file if it has not been specified anymore in the node.slots array
            if (specifiedFiles.length === 0) {
                var slotFileToRemove = path.join(directory, currentSlotFile);
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
    
    function Voice2JsonConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.sentences   = config.sentences;
        this.profilePath = config.profilePath;
        this.slots       = config.slots;
        this.removeSlots = config.removeSlots;
        this.profile    = config.profile;
        
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
        
        //bare bones save to file implementation if profile.yml was loaded
        var profileFilePath = path.join(node.profilePath, "profile.yml");

        // Only store the profile if available, otherwise we risc to loose the original profile.yml file
        if (node.profile) {
            try{
                fs.writeFileSync(profileFilePath, node.profile);
            }
            catch(err){
                console.log("Cannot write to profile file (" + profile FilePath + "): " + err);
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
        
        // Directory 'slot_programs' for all the slot files
        var slotProgramsDirectory = path.join(node.profilePath, "slot_programs");
        
        // Make sure the 'slot_programs' directory always exists
        if (!fs.existsSync(slotProgramsDirectory)) {
            try {
                fs.mkdirSync(slotProgramsDirectory);
            } 
            catch (err) {
                node.error("Cannot create directory (" + slotProgramsDirectory + "): " + err);
                return;
            }
        }
        
        // When required, remove all slot files that are not specified on the config screen
        if (node.removeSlots) {
            removeSlots(slotsDirectory, node);
            removeSlots(slotProgramsDirectory, node);
        }
        
        node.slots.forEach(function (slot, index) {
            var directory;
            var checkDirectory;

            if (slot.executable) {
                directory = slotProgramsDirectory;
                checkDirectory = slotsDirectory;
            }
            else {
                directory = slotsDirectory;
                checkDirectory = slotProgramsDirectory;
            }
            
            var slotFilePath = path.join(directory, slot.fileName);
            var checkSlotFilePath = path.join(checkDirectory, slot.fileName);
            
            //Create all the specified slot files, when they don't exist yet
            if (!fs.existsSync(slotFilePath)) {
                var errorCount = 0;
                
                // Check whether directories are specified in the filename (by ignoring the filename itself)
                var directories = slot.fileName.split(path.sep);
                directories.pop();
                
                // Create the directory structure if it doesn't exist yet.
                for (var i = 0; i < directories.length; i++) {
                    directory = path.join(directory, directories[i]);
                    
                    if (!fs.existsSync(directory)) {
                        try {
                            // Create the subdirectory with read/write permissions for owner/group/others
                            fs.mkdirSync(directory, 0o755, true);
                        } 
                        catch (err) {
                            errorCount++;
                            node.error("Cannot create directory (" + directory + "): " + err);
                            break; // No use to create subdirectories
                        }
                    }
                }
                
                if (errorCount === 0) {
                    try {
                        // Create the slot file itself
                        fs.closeSync(fs.openSync(slotFilePath, 'w'));
                    } 
                    catch (err) {
                        node.error("Cannot create slot file (" + slotFilePath + "): " + err);
                        return; // Process next slot file
                    }
                }
            }
            
            if (fs.existsSync(checkSlotFilePath)) {
                try {
                    fs.unlinkSync(checkSlotFilePath);
                }
                catch(err) {
                    node.error('Cannot remove ' + checkSlotFilePath + ' that was in wrong subfolder: ' + err);
                    return; // Process next slot file
                }
                
            }

            // Write the specified content to the slot files (only for files that are managed by Node-RED)
            if (slot.managedBy === "nodered") {
                
                try {
                    fs.writeFileSync(slotFilePath, slot.fileContent);
                } 
                catch (err) {
                    node.error("Cannot write content to slot file (" + slotFilePath + "): " + err);
                    return; // Process next slot file
                }
            }
            
            // The slot file can be executable or not.
            // We make it executable/readable/writable (777) for the owner/group/others.
            fs.chmodSync(slotFilePath, 0o777);
        
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
        var directory;
        
        // The root folder depends on whether the slot file is an executable script
        if (req.query.executable === "true") {
            directory = "slot_programs";
        }
        else {
            directory = "slots";
        }
        
        var filePath = path.join(req.query.profilePath, directory, req.query.fileName);
        
        // Load the specified slot file (managed by an EXTERNAL TOOL) from the filesystem.
        // For tht other slot files, Node-RED is the master (so Node-RED won't have to read those from here).
        res.sendFile(filePath, {}, function(err) {
            if(err) {
                res.status(err.status).end()
            }
        });
    });
    
    RED.httpAdmin.get("/voice2json-config/loadSlotNames", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        var slotDirectory = path.join(req.query.profilePath, "slots");
        var slotProgramsDirectory = path.join(req.query.profilePath, "slot_programs");
        
        var slotNames = [];
        var slotProgramNames = [];
        
        if (fs.existsSync(slotDirectory)) {
            getFilesSync(slotDirectory, "" ,slotNames);
        }
        
        if (fs.existsSync(slotProgramsDirectory)) {
            getFilesSync(slotProgramsDirectory, "", slotProgramNames);
        }
        
        // Send both arrays to the client
        res.send({slotNames:slotNames, slotProgramNames:slotProgramNames}, {}, function(err) {
            if(err) {
                res.status(err.status).end()
            }
        });
    });
    
    RED.httpAdmin.get("/voice2json-config/loadProfile", RED.auth.needsPermission('voice2json-config.read'), function(req, res){
        var filePath = path.join(req.query.profilePath, "profile.yml");
        
        // Load the profile file from the filesystem
        res.sendFile(filePath, {}, function(err) {
            if(err) {
                res.status(err.status).end()
            }
        });
    });
}
