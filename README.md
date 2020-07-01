# node-red-contrib-voice2json

`!!!This is very much wip, so please use carefully. The nodes will only work with the latest version of voice2json and are not backwards compatible with voice2json 1.0.0!!!`

Node-RED nodes that provide a simple wrapper for local speech and intent recognition on linux via [voice2json](http://voice2json.org/).

The [voice2json](http://voice2json.org/) project offers a collection of command line speech and intent recognition tools on Linux or in a Docker container.

Thanks to [Bart Butenaers](https://github.com/bartbutenaers), my partner in crime for this node!  He came up with the crazy idea that I should get involved in this business of node-red node development, and without his knowledge and his huge contribution to this node it wouldn't be here today.

***:warning: Have a look at the [step by step tutorial](https://github.com/johanneskropf/node-red-contrib-voice2json/wiki/Getting-started---Step-by-step-tutorial) on our wiki page to get started with these nodes!***

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install johanneskropf/node-red-contrib-voice2json
```

### Voice2Json installation
Install voice2json on the same machine as nodered. Detailed instructions can be found in the [voice2json documentation](http://voice2json.org/install.html), too install Voice2Json in one of the following ways:

1. As a (pre-compiled) Debian package.
2. As a Docker container.

### Language profile installation
To be able to start voice recognition, a language profile needs to be installed.  Download the profile of your preferred language, from the [list of supported languages](http://voice2json.org/#supported-languages).  The directory - where the language profile is stored - needs to be entered in the config node screen (see further).

Remark: When using the Voice2Json Docker container, make sure the language profile is stored somewhere in your home directory.  Otherwise Voice2Json will not be able to access it from its Docker container.  If that is not possible, you will need to make the path accessible for the Docker container, by adding an additional `-v` argument in the above Voice2Json Docker run bash script.

## Node Usage

This suite offers 5 Node-RED nodes in the Node-RED palette, located in the *"Voice2Json"* section:

![Palette](https://user-images.githubusercontent.com/14224149/84941338-85f86480-b0e1-11ea-830c-c9950c1456c3.png)

Those nodes can be combined to create a complete local voice setup:

![Overview](https://user-images.githubusercontent.com/14224149/85172001-6fccde80-b270-11ea-9bc1-938267e00f8b.png)

+ The left side contains all the sources that produce a ***raw stream of pcm audio buffers***.  Each chunk contains a number of audio samples e.g. captured from a microphone.  Because raw pcm audio chunks don’t have any headers (containing information about the audio), the receiver cannot determine which audio format has arrived.  Therefore the Wait-Wake node and the Record-Command node require that the raw audio format is:
   * Little Endian
   * signed-integer
   * 1 channel mono
   * 16000 Hz
   * 16 bit
+ The ***Wait-Wake*** node acts as a gate: It listens to the raw audio stream and looks for the wake word in it. If it finds the wake word, it will open the gate and start forwarding the raw audio stream until told otherwise (via the *"listen"* command).
+ The ***Record-Command*** node starts listening to the stream.  As soon as it assumes that a specified command is being spoken, it sends all the received raw audio as a single wav buffer (with proper headers) to its output.  Note that it only sends raw audio which it classifies as voice.
+ Beside the Record-Command node, there are also other sources (see the top side) that can offer a wav buffer.  For example the node-red-contrib-ui-microphone node, a wav file loaded from the file system, ...  Note that all those wav buffers need to have the following audio format again:
   * Little Endian
   * signed-integer
   * 1 channel mono
   * 16000 Hz
   * 16 bit
+ The ***STT-node*** expects wav audio (as buffer or as a file path), and will try to convert the speech signal to a plain text sentence.
+ The ***TTI-node*** requires text as input, and it will try to find information in that text.  That text can be delivered by the SST-node, but it can also from a large variety of other sources.
+ The JSON output from the TTI-node can be used to trigger other nodes in the Node-RED flow...

Note that all the example flows from this page can easily be installed via the Node-RED *"Import"* menu:

![Import menu](https://user-images.githubusercontent.com/14224149/84938505-a7efe800-b0dd-11ea-8926-c0df710b872a.png)

As a prerequisite for the example flows to work please install voice2json and download the [en-us kaldi profile](https://github.com/synesthesiam/en-us_kaldi-zamia/archive/v2.0.tar.gz). Once you have everything downloaded and set up import the example flow and go into the config and change the profile path to your download location of the profile.

## Nodes

### Config node

Create a config node for each installed voice2json language profile.  In most cases a single language profile will be sufficient.

The config node contains the following information:

<img src="https://user-images.githubusercontent.com/46578064/85868634-dc912d00-b7ca-11ea-944d-188a6c2b2359.jpeg" width="400"><img src="https://user-images.githubusercontent.com/46578064/85868642-e024b400-b7ca-11ea-87aa-24f64437dcc4.jpeg" width="400">

+ The ***path*** to the directory where the voice2json [language profile](http://voice2json.org/#supported-languages) has been installed (see section *"Language profile installation"* above).

+ A series of ***sentences*** that needs to be recognized.  These sentences will be stored in the *sentences.ini* file (in the language profile directory).  A button is available to load - once at startup -  the default sentences from that file, to get started quickly...

   The [grammar](http://voice2json.org/sentences.html) for sentences is quite extensive, for example:
   ```
   [Weather]
   day = (today | tomorrow | now){time}
   how is the weather
   what is the weather [like]
   (what | how) is the weather <day>
   ```
   
   Some explanation about this snippet:
   + `[Weather]` marks the start of one intent and defines its name as it will show up in the parsed intent.
   + `day = (today | tomorrow | now)` is a ***rule*** that can be used in sentences like `<day>`.
   + `{time}` is a ***tag*** which will show up in the parsed intent as the name of this value when it was recognized. 
   + `|` is used to separate a series of possible values, which means we expect either one of these values.
   + `how is the weather` is just a simple fixed sentence.
   + `[like]` is an optional word.

   This will result in the following sentences that can be recognized:
   ```
   what is the weather today
   what is the weather tomorrow
   what is the weather now
   how is the weather today
   how is the weather tomorrow
   how is the weather now
   Will result in the following sentences:
   ```
+ A series of ***slots*** which are similar to rules, and can be used inside the sentences.  Each of those slots corresponds to a separate slot file, which has one value per line.  Using slots (instead of rules) will keep the content of the sentences.ini file cleaner.  Moreover a slot file can be updated by an external background program or it can be an executable, to be able to build dynamically a list of values (e.g. to create an up-to-date movie list from your mediacenter).

   A slot has a number of properties:

   + A slot ***name***, which needs to be unique.  The slot name is in fact a file name (without extension).
   
   + Whether the slot is ***managed from the config screen*** or ***some where else***.  In the latter case, the slot content will be read-only in the config screen since it will be updated / created by some other means than handwriting it in the config.
   An example of this would be a slot that is created from a flow within nodered and than written to the profile/slots folder with a file node. This could be triggered by schedule or some external trigger to automatically update a slot that contains dynamic content. A simple example is this:
   
      <img src="https://user-images.githubusercontent.com/46578064/85833250-b69b6680-b791-11ea-8dad-ed4625c0b1b5.jpeg" width="500">
   
      ```
      [{"id":"72efe1bf.a0fce8","type":"voice2json-training","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","outputField":"payload","loadedProfile":"","x":330,"y":1260,"wires":[["71e9a746.3ba92","bf6c13ea.37af88"]]},{"id":"e5d1f674.546938","type":"inject","z":"6417ff5b.9a455","name":"","topic":"","payload":"train","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":150,"y":1260,"wires":[["72efe1bf.a0fce8"]]},{"id":"71e9a746.3ba92","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":530,"y":1260,"wires":[]},{"id":"1546a2dd.8db285","type":"comment","z":"6417ff5b.9a455","name":"build a slot with a file node from nodered","info":"This example flow builds a slot with a file node from nodered. The slot needs to be written with the file node before starting training\nWhen training finished you can try it by injecting the provided example wav into an stt node.\nFor this example to work please download the en-us kaldi profile from voice2json.org to your home folder and when necessary adapt the path to the profile in the config node and the path that the file node points to to the slots folder within. Than click the train button. ","x":380,"y":1140,"wires":[]},{"id":"b76c0a79.164708","type":"inject","z":"6417ff5b.9a455","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":160,"y":1380,"wires":[["6c933536.8001cc"]]},{"id":"3413788e.4b29d","type":"voice2json-stt","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","controlField":"control","outputField":"payload","autoStart":true,"x":520,"y":1380,"wires":[["b9f846b6.48f258"]]},{"id":"b9f846b6.48f258","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":710,"y":1380,"wires":[]},{"id":"6c933536.8001cc","type":"http request","z":"6417ff5b.9a455","name":"","method":"GET","ret":"bin","paytoqs":false,"url":"https://github.com/johanneskropf/node-red-contrib-voice2json/raw/master/wav/color.wav","tls":"","persist":false,"proxy":"","authType":"","x":330,"y":1380,"wires":[["3413788e.4b29d"]]},{"id":"597fedfb.537b14","type":"file","z":"6417ff5b.9a455","name":"","filename":"/home/pi/en-us_kaldi-zamia-2.0/slots/color","appendNewline":false,"createDir":true,"overwriteFile":"true","encoding":"none","x":570,"y":1200,"wires":[[]]},{"id":"ca242248.28d35","type":"inject","z":"6417ff5b.9a455","name":"","topic":"","payload":"","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":150,"y":1200,"wires":[["3d86e8d9.99f99"]]},{"id":"3d86e8d9.99f99","type":"template","z":"6417ff5b.9a455","name":"color","field":"payload","fieldType":"msg","format":"text","syntax":"plain","template":"red\ngreen\nyellow\nblue\npurple\npink\ngreen\nbrown","output":"str","x":290,"y":1200,"wires":[["597fedfb.537b14","71e9a746.3ba92"]]},{"id":"bf6c13ea.37af88","type":"change","z":"6417ff5b.9a455","name":"restart","rules":[{"t":"set","p":"control","pt":"msg","to":"start","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":450,"y":1320,"wires":[["3413788e.4b29d"]]},{"id":"a66d83bd.16a7d8","type":"voice2json-config","z":"","profilePath":"/home/pi/en-us_kaldi-zamia-2.0","name":"enUsKaldi","sentences":"[GetTime]\nwhat time is it\ntell me the time\n\n[GetTemperature]\nwhats the temperature\nhow (hot | cold) is it\n\n[GetGarageState]\nis the garage door (open | closed)\n\n[ChangeLightState]\nlight_name = ((living room lamp | garage light) {name}) | <ChangeLightColor.light_name>\nlight_state = (on | off) {state}\n\nturn <light_state> [the] <light_name>\nturn [the] <light_name> <light_state>\n\n[ChangeLightColor]\nlight_name = (bedroom light) {name}\n\nset [the] <light_name> [to] $color\nmake [the] <light_name> $color","slots":[{"fileName":"rhasspy/number","managedBy":"external","fileContent":null,"executable":true},{"fileName":"color","managedBy":"external","fileContent":null,"executable":false}],"removeSlots":true}]
      ```
   
   + Whether the slot is an ***executable***, i.e. whether the slot (file) is a shell script.  This executable is able to load all the slot values at trainign time by itself.  For example:
      ```
      #!/usr/bin/env node
      const http = require('http');

      http.get('http://localhost:1880/color', (resp) => {
         let data = '';
         resp.on('data', (chunk) => {
            data += chunk;
         });
         resp.on('end', () => {
            const parsedData = JSON.parse(data);
            parsedData.forEach(item => console.log(item));
            return;
         });
      }).on("error", (err) => {
         return;
      });
      ```
     This executable slot file could for example load data via a http request from your Node-RED flow (at training time!).  Which means you can extend your Node-RED flow to handel the http request via a Http-In node, and compose an array of values dynamically. Here is an example with detailed description in the comment node:
     
     <img src="https://user-images.githubusercontent.com/46578064/85833264-bd29de00-b791-11ea-90a4-9b278673bddb.jpeg" width="500">
     
     ```
     [{"id":"66e3f3b0.e02504","type":"http in","z":"6417ff5b.9a455","name":"","url":"/color_slot","method":"get","upload":false,"swaggerDoc":"","x":180,"y":880,"wires":[["75ad979d.0f3f48"]]},{"id":"a61fe0a3.81d528","type":"http response","z":"6417ff5b.9a455","name":"","statusCode":"","headers":{},"x":570,"y":880,"wires":[]},{"id":"75ad979d.0f3f48","type":"change","z":"6417ff5b.9a455","name":"colors slot builder","rules":[{"t":"set","p":"payload","pt":"msg","to":"[\"red\",\"green\",\"blue\",\"yellow\",\"purple\",\"brown\",\"pink\"]","tot":"json"}],"action":"","property":"","from":"","to":"","reg":false,"x":390,"y":880,"wires":[["a61fe0a3.81d528","1bd754a4.9b960b"]]},{"id":"ef819a8d.e86b7","type":"voice2json-training","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","outputField":"payload","loadedProfile":"","x":350,"y":940,"wires":[["1bd754a4.9b960b","a167934e.842ce"]]},{"id":"2aee0277.dd776e","type":"inject","z":"6417ff5b.9a455","name":"","topic":"","payload":"train","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":170,"y":940,"wires":[["ef819a8d.e86b7"]]},{"id":"1bd754a4.9b960b","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":550,"y":940,"wires":[]},{"id":"fa2533f2.8a15d8","type":"comment","z":"6417ff5b.9a455","name":"build slot from http request to nodered","info":"This example flow builds a slot from an http request to nodered. Here we substituted the color slot in the standard example sentences that come with the en-us kaldi profile with a little node.js script that gets called at training time. This request can trigger a flow in nodered to do anything as long as it returns an array of values for the slot to the http response node. In this case a simple array of colors. You will see the request beeing triggered in the debug tab after you started training.\nWhen training finished you can try it by injecting the provided example wav into an stt node.\nFor this example to work please download the en-us kaldi profile from voice2json.org to your home folder and when necessary adapt the path in the config node to your download location and than click the train button.","x":390,"y":820,"wires":[]},{"id":"304e63ed.52ef9c","type":"inject","z":"6417ff5b.9a455","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":180,"y":1060,"wires":[["374bcdc.8462132"]]},{"id":"2b9e1c4e.2fbabc","type":"voice2json-stt","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","controlField":"control","outputField":"payload","autoStart":true,"x":540,"y":1060,"wires":[["d13d9f94.81da4"]]},{"id":"d13d9f94.81da4","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":730,"y":1060,"wires":[]},{"id":"374bcdc.8462132","type":"http request","z":"6417ff5b.9a455","name":"","method":"GET","ret":"bin","paytoqs":false,"url":"https://github.com/johanneskropf/node-red-contrib-voice2json/raw/master/wav/color.wav","tls":"","persist":false,"proxy":"","authType":"","x":350,"y":1060,"wires":[["2b9e1c4e.2fbabc"]]},{"id":"a167934e.842ce","type":"change","z":"6417ff5b.9a455","name":"restart","rules":[{"t":"set","p":"control","pt":"msg","to":"start","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":470,"y":1000,"wires":[["2b9e1c4e.2fbabc"]]},{"id":"a66d83bd.16a7d8","type":"voice2json-config","z":"","profilePath":"/home/pi/en-us_kaldi-zamia-2.0","name":"enUsKaldi","sentences":"[GetTime]\nwhat time is it\ntell me the time\n\n[GetTemperature]\nwhats the temperature\nhow (hot | cold) is it\n\n[GetGarageState]\nis the garage door (open | closed)\n\n[ChangeLightState]\nlight_name = ((living room lamp | garage light) {name}) | <ChangeLightColor.light_name>\nlight_state = (on | off) {state}\n\nturn <light_state> [the] <light_name>\nturn [the] <light_name> <light_state>\n\n[ChangeLightColor]\nlight_name = (bedroom light) {name}\n\nset [the] <light_name> [to] $color\nmake [the] <light_name> $color","slots":[{"fileName":"rhasspy/number","managedBy":"external","fileContent":null,"executable":true},{"fileName":"color","managedBy":"external","fileContent":null,"executable":false}],"removeSlots":true}]
     ```
   
   + The ***content*** of the slot.
   
   You can look at / edit the content of any slot file by clicking the edit view / icon in the slot table. The slot content will be shown in the edit window at the bottom of the slots tab.
   
   This is an example for a slot file called weekdays that could contain the following values:
   ```
   monday
   tuesday
   wednesday
   thursday
   friday
   saturday
   friday
   ```
   which can be used in the sentences.ini like this:
   ```
   (what | how) is the weather (<day> | on ($weekday){weekday})
   ```
   Where `($weekday)` references our weekday slot file, and the tag `{weekday}` is added for the intent recognition .
   This way a sentence with the content *"how is the weather on tuesday"* can be recognized including all the permutations defined by the corresponding rule in the sentences.ini.

   It is also possible to reuse slots in more than one intent:
   ```
   [Calendar]
   do i have (an appointment | appointments)  [(today | on ($weekday){weekdays})]

   [Weather]
   day = (today | tomorrow | now){time}
   how is the weather
   what is the weather [like]
   (what | how) is the weather (<day> | on ($weekday){weekday})
   ```
   
 + ***Please read the [official documentation on the grammar on the voice2json website](http://voice2json.org/sentences.html) as this setion only gave a brief overview of the capabilities.***
 
#### File Handling & Profile Sync

The config node allows you to edit the sentences file and the slot files located in each language profile directly from node-red. With this come some caveats. When you first make a config for a new profile path the node doesnt automatically load the sentences or slots that may already be present in a language profile directory but instead presents you with a clean slate to start with. Should you wish to import the sentences or slots already present in the profile folder to use them we provide seperate load from profile buttons for the sentences tab and the slots tab.
Reasons for this could be to see the example sentences that come with a profile or to import the sentences or/and slots from an exeisting profile that you made on another machine and imported here. This is also handy to get your profile back into sync should you have made manual external changes to the sentences or slots that you otherwise manage from nodered.
**If you dont load the sentences/slots from the profile and there are already pre existent ones or you made external changes the node will on deploy overwrite the sentences with the nodered version!**
For slot files there are a couple of options:
+ A slot file can be set to **not** managed from the config. In this case the slot file becomes read only and the content is refreshed every time you open the config for the profile.
+ If set to managed from the config screen it will behave the same as sentences so a slot that is in node-red will **always be overwritten with the nodered version** you see in the config screen. If you make external changes to such a slot you can use the slot button top reload all slots from the file system.
+ There is an advanced option to delete all slots not on the config screen. This way all slots not present on the config screen at that point will be deleted from the profile on deploy.

**Please make sure to create frequent backups of the relevant files in the profile folders and esspecially when importing an existant voice2json profile for use with nodered!**

### Training node

The training node enables the training of a profile from node-red. 

To start training select the profile to train from the nodes config and than after deploying send a `msg.payload = "train"` via the input message:

![Training flow](https://user-images.githubusercontent.com/14224149/84702422-e0b18500-af56-11ea-8dac-816b22536141.png)
```
[{"id":"307ba520.0db2fa","type":"voice2json-training","z":"11289790.c89848","name":"","voice2JsonConfig":"3cf7b405.ee3c5c","inputField":"payload","outputField":"payload","loadedProfile":"","x":410,"y":320,"wires":[["3762bcf3.2585c4"]]},{"id":"6aaceed9.49082","type":"inject","z":"11289790.c89848","name":"Start training","topic":"","payload":"train","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":190,"y":320,"wires":[["307ba520.0db2fa"]]},{"id":"3762bcf3.2585c4","type":"debug","z":"11289790.c89848","name":"Training result","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","x":640,"y":320,"wires":[]},{"id":"3cf7b405.ee3c5c","type":"voice2json-config","z":"","profilePath":"/home/pi/voice2json_profile/en-us_kaldi-zamia-2.0","name":"Kaldi english profile","sentences":"[GetTime]\nwhat time is it\ntell me the time\n\n[GetTemperature]\nwhats the temperature\nhow (hot | cold) is it\n\n[GetGarageState]\nis the garage door (open | closed)\n\n[ChangeLightState]\nlight_name = ((living room lamp | garage light) {name}) | <ChangeLightColor.light_name>\nlight_state = (on | off) {state}\n\nturn <light_state> [the] <light_name>\nturn [the] <light_name> <light_state>\n\n[ChangeLightColor]\nlight_name = (bedroom light) {name}\ncolor = (red | green | blue) {color}\n\nset [the] <light_name> [to] <color>\nmake [the] <light_name> <color>","slots":[{"fileName":"slot1","managedBy":"external","fileContent":null,"executable":false},{"fileName":"fold_a/fold_b/fold_c/testslot","managedBy":"external","fileContent":null,"executable":false},{"fileName":"rhasspy/number","managedBy":"external","fileContent":null,"executable":true}],"removeSlots":true}]
```

An output message will be sent, containing the training commandline output lines:
```
result:
/usr/lib/voice2json/lib/kaldi/egs/wsj/s5/utils/prepare_lang.sh /home/pi/de_kaldi-zamia-2.0/acoustic_model/data/local/dict  /home/pi/de_kaldi-zamia-2.0/acoustic_model/data/local/lang /home/pi/de_kaldi-zamia-2.0/acoustic_model/data/lang
Checking /home/pi/de_kaldi-zamia-2.0/acoustic_model/data/local/dict/silence_phones.txt ...
--> reading /home/pi/de_kaldi-zamia-2.0/acoustic_model/data/local/dict/silence_phones.txt
--> text seems to be UTF-8 or ASCII, checking whitespaces
--> text contains only allowed whitespaces
--> /home/pi/de_kaldi-zamia-2.0/acoustic_model/data/local/dict/silence_phones.txt is OK
...
```
Since the output is a big blob of text (instead of json), the Node-RED debug panel will not show the entire output.  Best way to see the whole training result is to write the training node output to a file, by using the File-Out node...

### Wait Wake node

A node to listen to a stream of raw audio buffers and detect a wake-word in that stream. When a wake word is detected:
1. It sends an output message on the first output, including the detected wake word and the time of detection relative to the nodes start and a unix timestamp to the first output. 
2. If the `Forward audio to 2nd output on detection` option is checked, the node will start ignoring any detected wake words after a detection and start forwarding the raw audio chunks to its second output.  The forwarding continues until an input message is injected, containing `listen` in the configured control property.  Then it will stop forwarding and start listening for a wake word again. 

The following figure explains how the wake-word will open the gate (thus forwarding the stream to the second output), and how the `listen` command will close the gate again:

![Wake word](https://user-images.githubusercontent.com/14224149/85192727-e47d3880-b2c3-11ea-95b4-87c8d4daed1d.png)

The second output can be directly connected to Record-Command node, to record a command after a wake word was detected (when in forward mode). The wait-wake node will act as a kind of gate for the Record-Command node this way as for it to only start recording when a wake word was detected.  This way it can be avoided that the Record-Command node has to process all conversations, which would be a waste of resources and could lead to unpredicatable results.

The Wake-Word listening process can be stopped at anytime, by injecting an input message containing `stop` in the configured control property. Note that the wait wake node will automatically start up again after a timeout of 2 seconds, if you dont stop the input audio stream when stopping this node. This way the stop command can be used to restart the node.

A possible source for the input stream of raw audio buffers is [node-red-contrib-sox-record](https://github.com/johanneskropf/node-red-contrib-sox-record) which should work out of the box with this node.

Here is a small examle flow using the [node-red-contrib-sox-record](https://github.com/johanneskropf/node-red-contrib-sox-record) node and a connected microphone to see the wait-wake node in action:

<img src="https://user-images.githubusercontent.com/46578064/85836583-18aa9a80-b797-11ea-8936-cf4d20b8041f.jpeg" width="500">

```
[{"id":"d70f5ed2.7088","type":"sox-record","z":"6417ff5b.9a455","name":"","buttonStart":"button","inputs":0,"inputSource":"1,0","byteOrder":"-L","encoding":"signed-integer","channels":1,"rate":16000,"bits":16,"gain":"0","lowpass":8000,"showDuration":false,"durationType":"forever","durationLength":0,"silenceDetection":"nothing","silenceDuration":"2.0","silenceThreshold":"2.0","outputFormat":"stream","manualPath":"color","debugOutput":false,"x":170,"y":1660,"wires":[["5b72f1e6.7d8e2"],[]]},{"id":"5b72f1e6.7d8e2","type":"voice2json-wait-wake","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","controlField":"control","outputField":"payload","nonContinousListen":true,"x":380,"y":1660,"wires":[["41502e87.5abfd","3a18ade7.ce6202"],["dc92e18d.01e8c"]]},{"id":"41502e87.5abfd","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":590,"y":1600,"wires":[]},{"id":"3a18ade7.ce6202","type":"trigger","z":"6417ff5b.9a455","op1":"","op2":"listen","op1type":"nul","op2type":"str","duration":"3","extend":false,"units":"s","reset":"","bytopic":"all","name":"3s than listen","x":590,"y":1660,"wires":[["5b72f1e6.7d8e2"]]},{"id":"dc92e18d.01e8c","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":590,"y":1720,"wires":[]},{"id":"c0769b02.c6d23","type":"inject","z":"6417ff5b.9a455","name":"stop (restart)","topic":"","payload":"stop","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":170,"y":1600,"wires":[["5a559572.e002fc"]]},{"id":"5a559572.e002fc","type":"change","z":"6417ff5b.9a455","name":"","rules":[{"t":"move","p":"payload","pt":"msg","to":"control","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":370,"y":1600,"wires":[["5b72f1e6.7d8e2"]]},{"id":"c3f82253.925cc","type":"comment","z":"6417ff5b.9a455","name":"wait-wake example","info":"Prerequisites for this example flow are that you must have a [node-red-sox-utils](https://github.com/johanneskropf/node-red-contrib-sox-utils) installed and a microphone connected to your raspberry or other device. Choose your input device in the mic nodes config and click the button to start recording. After a brief start up period the wait-wake node can be triggered by speaking the standard wake word of *hey mycroft* if no custom wake word has been configured in the selected profiles profile.yml. The wait-wake node will than forward the audio from the mic for three seconds on its second output and ignore wake words until told to listen again. You can restart (stop) the node by injecting start to the control topic.","x":410,"y":1540,"wires":[]},{"id":"a66d83bd.16a7d8","type":"voice2json-config","z":"","profilePath":"/home/pi/en-us_kaldi-zamia-2.0","name":"enUsKaldi","sentences":"[GetTime]\nwhat time is it\ntell me the time\n\n[GetTemperature]\nwhats the temperature\nhow (hot | cold) is it\n\n[GetGarageState]\nis the garage door (open | closed)\n\n[ChangeLightState]\nlight_name = ((living room lamp | garage light) {name}) | <ChangeLightColor.light_name>\nlight_state = (on | off) {state}\n\nturn <light_state> [the] <light_name>\nturn [the] <light_name> <light_state>\n\n[ChangeLightColor]\nlight_name = (bedroom light) {name}\n\nset [the] <light_name> [to] $color\nmake [the] <light_name> $color","slots":[{"fileName":"rhasspy/number","managedBy":"external","fileContent":null,"executable":true},{"fileName":"color","managedBy":"external","fileContent":null,"executable":false}],"removeSlots":true}]
```

Currently the default wakeword is ***"hey mycroft"***.  If you want to setup a custom wake-word, you can find more information in the [voice2json documentation](http://voice2json.org/commands.html#wait-wake).

### Record Command node

A node to record a voice command from a stream of raw audio buffers. The record command node will:
+ Start recording a voice command from a stream of raw audio buffers, as soon as those buffers start arriving on the configured input.
+ Stop recording when it detects silence, which means the end of the command. 

As soon as its stops recording it will send a single buffer to the configured output, which is a wav audio object containing the chunks of the detected speech command:

![Recording chunks](https://user-images.githubusercontent.com/14224149/85193443-cfef6f00-b2c8-11ea-833e-fa4ef46f50ce.png)

If the input audio stream is not stopped, it automatically will start recording a new command after a 2 second timeout.

The input of this can be directly connected to the second output of the wait wake node in forward mode or any other node that can send a stream of raw audio buffers in the correct format. The output wav buffer can be directly fed to the voice2json stt node input for transcription.

Here is a simple example flow:

<img src="https://user-images.githubusercontent.com/46578064/85837549-74295800-b798-11ea-8d7f-efd72e0e9c53.jpeg" width="500">

```
[{"id":"184ac771.24eb91","type":"sox-record","z":"6417ff5b.9a455","name":"","buttonStart":"msg","inputs":1,"inputSource":"1,0","byteOrder":"-L","encoding":"signed-integer","channels":1,"rate":16000,"bits":16,"gain":"0","lowpass":8000,"showDuration":false,"durationType":"forever","durationLength":0,"silenceDetection":"nothing","silenceDuration":"2.0","silenceThreshold":"2.0","outputFormat":"stream","manualPath":"","debugOutput":false,"x":290,"y":1900,"wires":[["ae954e1b.8764f"],[]]},{"id":"b21a3465.f1e6d","type":"inject","z":"6417ff5b.9a455","name":"","topic":"","payload":"start","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":130,"y":1900,"wires":[["184ac771.24eb91"]]},{"id":"ea9f63d8.ea2ba8","type":"change","z":"6417ff5b.9a455","name":"stop","rules":[{"t":"set","p":"payload","pt":"msg","to":"stop","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":370,"y":1960,"wires":[["184ac771.24eb91"]]},{"id":"ae954e1b.8764f","type":"voice2json-record-command","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","outputField":"payload","x":530,"y":1900,"wires":[["ea9f63d8.ea2ba8","4d0e9d91.67e32c"]]},{"id":"4d0e9d91.67e32c","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":770,"y":1900,"wires":[]},{"id":"6550c0a.e92874","type":"comment","z":"6417ff5b.9a455","name":"record command example","info":"Prerequisites for this example flow are that you must have a [node-red-sox-utils](https://github.com/johanneskropf/node-red-contrib-sox-utils) installed and a microphone connected to your raspberry or other device. Choose your input device in the mic nodes config and inject start to start recording and say something.\nThe record-command node will now listen to the stream of buffers from the microphone and as soon as it detects silence it will emit a single wav buffer containing the spoken command. ","x":450,"y":1840,"wires":[]},{"id":"a66d83bd.16a7d8","type":"voice2json-config","z":"","profilePath":"/home/pi/en-us_kaldi-zamia-2.0","name":"enUsKaldi","sentences":"[GetTime]\nwhat time is it\ntell me the time\n\n[GetTemperature]\nwhats the temperature\nhow (hot | cold) is it\n\n[GetGarageState]\nis the garage door (open | closed)\n\n[ChangeLightState]\nlight_name = ((living room lamp | garage light) {name}) | <ChangeLightColor.light_name>\nlight_state = (on | off) {state}\n\nturn <light_state> [the] <light_name>\nturn [the] <light_name> <light_state>\n\n[ChangeLightColor]\nlight_name = (bedroom light) {name}\n\nset [the] <light_name> [to] $color\nmake [the] <light_name> $color","slots":[{"fileName":"rhasspy/number","managedBy":"external","fileContent":null,"executable":true},{"fileName":"color","managedBy":"external","fileContent":null,"executable":false}],"removeSlots":true}]
```

### Speech To Text node

The speech to text node can be used to recognize sentences (which are specified in the selected config node).

![STT flow](https://user-images.githubusercontent.com/14224149/85177550-a01a7a00-b27c-11ea-9d53-05a1ba927888.png)
```
[{"id":"a130ba16.223568","type":"voice2json-stt","z":"11289790.c89848","name":"","voice2JsonConfig":"3cf7b405.ee3c5c","inputField":"payload","controlField":"control","outputField":"payload","autoStart":true,"x":660,"y":380,"wires":[["b1517366.97b42"]]},{"id":"b1517366.97b42","type":"debug","z":"11289790.c89848","name":"Text","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":850,"y":380,"wires":[]},{"id":"9bb2c518.0a5628","type":"http request","z":"11289790.c89848","name":"Load wav buffer","method":"GET","ret":"bin","paytoqs":false,"url":"https://raw.githubusercontent.com/johanneskropf/node-red-contrib-voice2json/master/wav/turn_on_lights_kitchen.wav","tls":"","persist":false,"proxy":"","authType":"","x":440,"y":380,"wires":[["a130ba16.223568"]]},{"id":"6940b487.dcee8c","type":"inject","z":"11289790.c89848","name":"Execute STT","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":250,"y":380,"wires":[["9bb2c518.0a5628"]]},{"id":"697e631.4c9599c","type":"inject","z":"11289790.c89848","name":"Start","topic":"","payload":"start","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":230,"y":280,"wires":[["77b4222d.8654cc"]]},{"id":"fd112978.dcb108","type":"inject","z":"11289790.c89848","name":"Stop","topic":"","payload":"stop","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":230,"y":320,"wires":[["77b4222d.8654cc"]]},{"id":"77b4222d.8654cc","type":"change","z":"11289790.c89848","name":"payload -> control","rules":[{"t":"move","p":"payload","pt":"msg","to":"control","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":450,"y":320,"wires":[["a130ba16.223568"]]},{"id":"3cf7b405.ee3c5c","type":"voice2json-config","z":"","profilePath":"/home/pi/voice2json_profile/en-us_kaldi-zamia-2.0","name":"Kaldi english profile","sentences":"[TurnLigths]\r\nturn (on | off){state} the light in the (kitchen | bathroom){room}","slots":[],"removeSlots":true}]
```

1. The STT node needs to be started.  There are 3 different ways to accomplish this:
   + This node offers auto-start (at deployment time), that can be enabled by activating the *"auto start transcriber"* checkbox on the config screen.  The advantage is that this node will be started immediately (after a deploy or startup), which means it will be ready as soon as the first input voice message arrives.
   + This node can be started explict, by injecting an input message with `"start"` (and stopped via `"stop"`) as the content of the configured control property of the input msg object.  This will be used mostly to restart this node after a new training has been executed. 
   + This node will be autostarted automatically when an input voice message arrives, when this node is not started yet.  When relying solely on this mode, the first input voice message will take a while to process (since voice2json still needs to load all its resources).
   Therefore it is advised to use one of the first two modes, since voice2json can load its resources before audio arrives (which greatly reduces the time of the first transcription).  And the combination with the last mode will ensure fail safety: if the voice2json process would be halted for some reason, this node will automatically restart the process when the next input voice message arrives.  Which might be usefull in a 24/7 setup.
   
2. Once started, start injecting input data containing a WAV audio buffer or the path to a WAV file via `msg.payload`.

3. The STT node will try to recognize the sentences, which have been specified in the sentences tab of the config node (*you need to retrain if you change your slots or sentences and restart the stt node for the stt node to pick those changes*):
   ```
   [TurnLigths]
   turn (on | off){state} the light in the (kitchen | bathroom){room}
   ```

4. The output message will be an object in the configured `msg.property`. The property **text** of this object contains the recognized text as a string. Here is an example output object:
   ```
   {
      "text": "turn on the light in the kitchen",
      "likelihood":1,
      "transcribe_seconds":3.4162743357010186,
      "wav_seconds":2.035,
      "tokens":null,
      "wav_name":"stta130ba16223568.wav"
   }
   ```
   As you can see the `text` property contains the text from the [wav](https://raw.githubusercontent.com/johanneskropf/node-red-contrib-voice2json/master/wav/turn_on_lights_kitchen.wav) audio file.

### Text To Intent node
Intent analysis involves searching information (rooms, switch statuses, names, ...) in a text, as a part of natural language understanding.

In the previous example flow, the STT node converted the wav file to a text sentence.  Now we will send this text to the TTI node, which will extract the required information from that text.

![TTI flow](https://user-images.githubusercontent.com/14224149/85178007-aceb9d80-b27d-11ea-85f2-55dca1034e8f.png)
```
[{"id":"faef3d3a.f726d","type":"debug","z":"11289790.c89848","name":"Intent","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":1050,"y":580,"wires":[]},{"id":"dd141eca.7d435","type":"inject","z":"11289790.c89848","name":"Inject sentence","topic":"","payload":"turn on the light in the kitchen","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":480,"y":580,"wires":[["88000e6b.23f55"]]},{"id":"88000e6b.23f55","type":"voice2json-tti","z":"11289790.c89848","name":"","voice2JsonConfig":"3cf7b405.ee3c5c","inputField":"payload","controlField":"control","outputField":"payload","autoStart":true,"x":880,"y":580,"wires":[["faef3d3a.f726d"]]},{"id":"8cebce39.0bc7c","type":"change","z":"11289790.c89848","name":"payload -> control","rules":[{"t":"move","p":"payload","pt":"msg","to":"control","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":670,"y":520,"wires":[["88000e6b.23f55"]]},{"id":"6fdd8681.afc558","type":"inject","z":"11289790.c89848","name":"Start","topic":"","payload":"start","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":450,"y":480,"wires":[["8cebce39.0bc7c"]]},{"id":"13b82eb1.b72bf1","type":"inject","z":"11289790.c89848","name":"Stop","topic":"","payload":"stop","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":450,"y":520,"wires":[["8cebce39.0bc7c"]]},{"id":"3cf7b405.ee3c5c","type":"voice2json-config","z":"","profilePath":"/home/pi/voice2json_profile/en-us_kaldi-zamia-2.0","name":"Kaldi english profile","sentences":"[TurnLigths]\r\nturn (on | off){state} the light in the (kitchen | bathroom){room}","slots":[],"removeSlots":true}]
```
1. The sentences in the config node contain all the information that we want to extract from the text:
   ```
   [TurnLigths]
   turn (on | off){state} the light in the (kitchen | bathroom){room}
   ```
   
2. This way the TTI node knows that it needs to determine the light 'state' (which can be on or off) and the room (which can be kitchen or bathroom).

3. The output will contain the information about both variables:
   ```
   {
      "text":"turn on the light in the kitchen",
      "intent":{
         "name":"TurnLigths",
         "confidence":1
      },
      "entities":[{
         "entity":"state",
         "value":"on",
         ...
      },
      {
         "entity":"room",
         "value":"kitchen",
         ...
      }],
      ...
      "slots":{
         "state":"on",
         "room":"kitchen"
      }
   }
   ```
   Based on the `confidence` field, it is possible to determine whether you want to accept the value or reject it...
   
The node can be started, stopped or restarted with the same messages as the stt node that include a valid payload in the configured control property of the input message object.

## Advanced topics

### How the transcription / intent recognition works in voice2json

To learn about how voive2json works in detail and better understand how it works we recommend to have a look at the [whitepaper about the whole process](http://voice2json.org/whitepaper.html) by the voice2json project.

Some basics about this:
+ Voice2json creates a [dictionary](http://voice2json.org/whitepaper.html#pronunciation-dictionary) and a [language model](http://voice2json.org/whitepaper.html#language-model) from your sentences at training time.
+ At runtime on transcription/recognition voice2json will recognize the sentence which is the ***closest*** (i.e. the statistically most likely result), even if it doesn't match exactly!  The recognition is based only on the this limited vocabulary you used in the sentences.  This is necessary to be able to run voice recognition fast on modest hardware (like a Raspberry PI 3),  thats why voice2json uses this small language model and dictionary that it creates at training time from the limited set of sentences which you configured in the config node. It will always try to fit whatever audio you pass to it for transcription into the model and vocabulary it build it from those sentences.

### Limiting false positive results

Since the STT node will always give a result (i.e. the closest one) even if it doesn't match, there will be false positives caused by random audio. These false positivies be reduced with a number of strategies:

+ One way would be to mix in a certain amount of the base language model from the profile your using. [The process for this is decribed here](http://voice2json.org/commands.html#language-model-mixing). This comes with a huge performance cost and will slow transcription by a factor of 3-4 times.
+ You can create a ***NULL*** intent. This would be an intent that includes either on one line or multiple lines some of the most common word including nouns, adjectives, verbs and articles of the language your using. Although it will reduce the accurracy of the recognition a little bit this will reduce the chance that random audio will be classified as one of your intents.  
+ In the object that the TTI node returns is a sub property under `intent.confidence` that gives a score between *0* and *1* on how close the transcription text was to the actual intent. This property can be used to sort out intents that are impropable. This is especially usefull together with a *NULL* intent.
+ The use of an accurate wake words, to make sure it only listens when you actually say something that is directed at it. The less random audio arrives at your stt and tti nodes the smaller the change of a fasle positive intent recognition becomes.

### Minimizing SD card wearing

Voice2json expects all input to be file-based, which means you have to store a file on the filesystem and pass the file path to Voice2json. Which means you can simply use the STT node like this:

![Filesystem](https://user-images.githubusercontent.com/14224149/85193711-5efd8680-b2cb-11ea-8700-2d35a67c6cb7.png)

1. Other nodes in the flow store a wav file on the filesystem.
2. A path to that file is injected via an input message into the STT node.
3. The STT node calls Voice2json and passes that file path.
4. Voice2json will load the wav file from the filesystem, and process it.

However this requires continiously writing to the filesystem, which can be very desctructive for some hardware like SD cards.  To solve that problem, an in-memory approach has been provided:

![In memory](https://user-images.githubusercontent.com/14224149/85194428-dfbd8200-b2cd-11ea-8217-2c20530adab9.png)

1. Another node in the flow (e.g. Record-Command node) injects a WAV buffer via an input message into the STT node.
2. The STT node will write the WAV file to an ***in-memory filesystem /dev/shm***.  Directory `/dev/shm/` is mounted to ram by default and you can read more about it [here](https://www.cyberciti.biz/tips/what-is-devshm-and-its-practical-usage.html).
3. The STT node calls Voice2json and passes that file path.
4. Voice2json will load the wav file from the in-memory filesystem, and process it.

Caution: not all Linux system provide the in-memory filesystem !  In those cases the STT node will use the `/tmp/` directory, which will result in lots of writing to filesystem again!  Note that in these cases you will need to include this path in the above Docker file, instead of `/dev/shm/` (if you use the docker container).

When `/dev/shm/` is not available on hardware similiar to a Raspberry Pi, another solution might be available:
1. Create a folder using the `mkdir`command (for example `mkdir /home/pi/tmp`).
would be to create your own folder that is mounted to tmpfs via fstab. You can do this by creating a  and than 
2. Add the line `tmpfs  /home/pi/tmp  tmpfs  defaults,noatime,size=100m  0 0` to file `/etc/fstab`. 
3. After a reboot, the directory `/home/pi/tmp` will automatically be mounted to ram.
4. Add nodes (e.g. the File-Out node) to your flow to store the WAV file into that in-memory directory.
5. Inject a message into the STT node, containing the path to that WAV file.

An in-memory filesystem means that data in it will be lost upon reboot, but sd card writes will be greatly reduced...
More information on this approach can be found [here](https://www.zdnet.com/article/raspberry-pi-extending-the-life-of-the-sd-card/).

## Limitations
+ This node does not identify voices from different persons, e.g. to support sentences like *"Play my favorite music"*.  You could workaround this by running multiple wake words in parallel, one for each person. But that’s a very resource intensive workaround/hack.

## Hardware setups
Some possible hardware setups are being listed here, to get you started. Each setup will have both advantages and disadvantages. The setups all fit into the flow chart from the top of this readme about the logic of processing something with nodered and voice2json and all the possible input sources.

### A single do it all device (Raspberry Pi or similar)

The simplest way to set up a complete workflow from wake word to intent processing is a single device running linux that supports both nodered and voice2json. This could for example be the very popular raspberry pi which from model 3 onwards is more than capable enough to run this combination. As the most basic requirement you will also need some form of microphone. A good start can be cheap usb conference microphones that are linux compatible. Another popular option are the [respeaker pi hats and microphones](https://www.seeedstudio.com/category/Speech-Recognition-c-44.html). You may also want to add a small speaker for sound feedback. You can now set up a complete speech command workflow on this device purely from nodered. Install one of the microphone nodes and connect it to the suite of voive2json nodes streaming raw audio buffers in the right format.

### Master satellite setup with Raspberry Zero for voice capture

When a series of microphones need to be installed in a building, it might become too expensive to use Raspberry Pi (3 or 4) devices.  In those cases one might consider to use Raspberry Pi Zero devices to reduce the cost.  However a single core Raspberry Pi zero is not powerful enough to run wake-word detection.  As a result the Zero will run a Node-RED flow that captures audio from its microphone, and then it will need to send that audio (as a continious stream) to a Raspberry Pi (3 or 4).  That central Raspberry Pi will need to run a Node-RED flow, that needs to do all the Voice2Json processing:

![Zero setup](https://user-images.githubusercontent.com/14224149/84948181-a4635d80-b0eb-11ea-9fa5-52cbc97c567a.png)

Keep in mind that this setup will result in a large amount of network traffic, even when you are not using speech recognition!  This can only be solved by running the wake-word detection on the device which is connected to the microphone.

### An Apple iOS siri-shortcut to send audio to nodered to be processed by voice2json

You can create a siri-shortcut in the shortcuts app on your iphone or ipad with a content like this:

<img src="https://user-images.githubusercontent.com/46578064/85840595-092e5000-b79d-11ea-8662-6559c9b14df6.jpeg" width="400">

to send audio via an http request to nodered and convert it to the right format with [sox-utils](https://github.com/johanneskropf/node-red-contrib-sox-utils):

<img src="https://user-images.githubusercontent.com/46578064/85841042-cb7df700-b79d-11ea-9da9-e03481a1566c.jpeg" width="600">

```
[{"id":"a87acd93.c30f4","type":"http in","z":"6417ff5b.9a455","name":"","url":"/audio","method":"put","upload":false,"swaggerDoc":"","x":130,"y":2080,"wires":[["71abe4b.00b8d1c","94801716.ebafc8"]]},{"id":"71abe4b.00b8d1c","type":"sox-convert","z":"6417ff5b.9a455","name":"","conversionType":"wav","outputToFile":"buffer","manualPath":"","wavMore":true,"wavByteOrder":"-L","wavEncoding":"signed-integer","wavChannels":1,"wavRate":16000,"wavBits":16,"flacMore":false,"flacCompression":8,"flacChannels":1,"flacRate":16000,"flacBits":16,"mp3More":false,"mp3Channels":2,"mp3Rate":44100,"mp3BitRate":128,"oggMore":false,"oggCompression":3,"oggChannels":2,"oggRate":44100,"debugOutput":false,"x":310,"y":2080,"wires":[["d09c9f59.8ed97"],[]]},{"id":"94801716.ebafc8","type":"http response","z":"6417ff5b.9a455","name":"","statusCode":"","headers":{},"x":290,"y":2140,"wires":[]},{"id":"d09c9f59.8ed97","type":"voice2json-stt","z":"6417ff5b.9a455","name":"","voice2JsonConfig":"a66d83bd.16a7d8","inputField":"payload","controlField":"control","outputField":"payload","autoStart":true,"x":500,"y":2080,"wires":[["207c9eec.afe73a"]]},{"id":"207c9eec.afe73a","type":"debug","z":"6417ff5b.9a455","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":690,"y":2080,"wires":[]},{"id":"a66d83bd.16a7d8","type":"voice2json-config","z":"","profilePath":"/home/pi/en-us_kaldi-zamia-2.0","name":"enUsKaldi","sentences":"[GetTime]\nwhat time is it\ntell me the time\n\n[GetTemperature]\nwhats the temperature\nhow (hot | cold) is it\n\n[GetGarageState]\nis the garage door (open | closed)\n\n[ChangeLightState]\nlight_name = ((living room lamp | garage light) {name}) | <ChangeLightColor.light_name>\nlight_state = (on | off) {state}\n\nturn <light_state> [the] <light_name>\nturn [the] <light_name> <light_state>\n\n[ChangeLightColor]\nlight_name = (bedroom light) {name}\n\nset [the] <light_name> [to] $color\nmake [the] <light_name> $color","slots":[{"fileName":"rhasspy/number","managedBy":"external","fileContent":null,"executable":true},{"fileName":"color","managedBy":"external","fileContent":null,"executable":false}],"removeSlots":true}]
```
**This approach will work for any audio source that can send an audio file in a convertible format to nodered over an http request, mqtt or a websocket.**
