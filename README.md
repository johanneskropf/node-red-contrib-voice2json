# node-red-contrib-voice2json

`!!!This is very much wip, so please use carefully. The nodes will only work with the latest version of voice2json and are not backwards compatible with voice2json 1.0.0!!!`

Node-RED nodes that provide a simple wrapper for local speech and intent recognition on linux via [voice2json](http://voice2json.org/).

The [voice2json](http://voice2json.org/) project offers a collection of command line speech and intent recognition tools on Linux or in a Docker container.

Thanks to [Bart Butenaers](https://github.com/bartbutenaers), my partner in crime for this node!  He came up with the crazy idea that I should get involved in this business of node-red node development, and without his knowledge and his huge contribution to this node it wouldn't be here today.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install johanneskropf/node-red-contrib-voice2json
```

### Voice2Json installation
Install voice2json on the same machine as nodered. Detailed instructions can be found in the [voice2json documentation](http://voice2json.org/install.html), two install Voice2Json in one of the following ways:

1. As a (pre-compiled) Debian package.
2. As a Docker container.

If you want to use node-red-contrib-voice2json with a docker install you have to adapt the supplied bash script (from the Voice2Json documentation) to include the line `-v “/dev/shm/:/dev/shm/“ \`.  This means the entire script will look like this:
```
#!/usr/bin/env bash
docker run -i \
       -v "${HOME}:${HOME}" \
       -v “/dev/shm/:/dev/shm/“ \
       -w "$(pwd)" \
       -e "HOME=${HOME}" \
       --user "$(id -u):$(id -g)" \
       synesthesiam/voice2json:2.0.0 "$@"
```
More information about this can be found below in the section *"Notes on minimizing SD card wear in voice2jsons file based workflow"*.

### Language profile installation
To be able to start voice recognition, a language profile needs to be installed.  Download the profile of your preferred language, from the [list](http://voice2json.org/#supported-languages) of supported languages.  The directory - where the language profile is stored - needs to be entered in the config node screen (see further).

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

## Nodes

### Config node

Create a config node for each installed voice2json language profile.  The config node contains the following information:

+ A ***path*** to a local voice2json [language profile](http://voice2json.org/#supported-languages) directory.

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
   
   + Whether the slot is ***managed by*** Node-RED or an external program.  In the latter case, the slot content will be read-only in Node-RED since it will be updated by an external background program.
   
   + Whether the slot is an ***executable***, which means that the slot is a shell script.  This executable is able to load all the slot values by itself.  For example:
      ```
      #!/usr/bin/env node
      const http = require('http');

      http.get('http://localhost:1880/test_http', (resp) => {
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
     This executable slot file will load data via a http request from your Node-RED flow (at training time!), which means you can extend your Node-RED flow to compose an array of values dynamically:
     
     ![Executable slot flow](https://user-images.githubusercontent.com/14224149/84831161-2049a100-b02b-11ea-9a87-6af2035e17bd.png)
     
     TODO: export flow and share it here ...
     TODO: show a flow with a file-out node to write a slot file from your node-red flow, and afterwards start the training...
   
   + The ***content*** of the slot.  
   
   For example a slot file called weekdays could contain the following values:
   ```
   monday
   tuesday
   wednesday
   thursday
   friday
   saturday
   friday
   ```
   Can be used it in our sentences.ini like this:
   ```
   (what | how) is the weather (<day> | on ($weekday){weekday})
   ```
   Where `($weekday)` references our weekday slot file, and the tag {weekday} is added for the intent recognition .
   This way a sentence like *"how is the weather on tuesday"* can be recognize, and also all the possible permutations.

   It is also possible to use the weekday slot in another intent, by using these sentences:
   ```
   [Calendar]
   do i have (an appointment | appointments)  [(today | on ($weekday){weekdays})]

   [Weather]
   day = (today | tomorrow | now){time}
   how is the weather
   what is the weather [like]
   (what | how) is the weather (<day> | on ($weekday){weekday})
   ```

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

TODO Jonathan: add small example flow

Currently the default wakeword is ***"hey mycroft"***.  If you want to setup a custom wake-word, you can find more information in the [voice2json documentation](http://voice2json.org/commands.html#wait-wake).

### Record Command node

A node to record a voice command from a stream of raw audio buffers. The record command node will:
+ Start recording a voice command from a stream of raw audio buffers, as soon as those buffers start arriving on the configured input.
+ Stop recording when it detects silence, which means the end of the command. 

As soon as its stops recording it will send a single buffer to the configured output, which is a wav audio object containing the chunks of the detected speech command:

![Recording chunks](https://user-images.githubusercontent.com/14224149/85193443-cfef6f00-b2c8-11ea-833e-fa4ef46f50ce.png)

If the input audio stream is not stopped, it automatically will start recording a new command after a 2 second timeout.

The input of this can be directly connected to the second output of the wait wake node in forward mode or any other node that can send a stream of raw audio buffers in the correct format. The output wav buffer can be directly fed to the voice2json stt node input for transcription.

TODO Jonathan: add small example flow

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
Some possible hardware setups are being listed here, to get you started.  Each setup will have both advantages and disadvantages...

### Raspberry Zero for voice capture

When a series of microphones need to be installed in a building, it might become too expensive to use Raspberry Pi (3 or 4) devices.  In those cases one might consider to use Raspberry Pi Zero devices to reduce the cost.  However a single core Raspberry Pi zero is not powerful enough to run wake-word detection.  As a result the Zero will run a Node-RED flow that captures audio from its microphone, and then it will need to send that audio (as a continious stream) to a Raspberry Pi (3 or 4).  That central Raspberry Pi will need to run a Node-RED flow, that needs to do all the Voice2Json processing:

![Zero setup](https://user-images.githubusercontent.com/14224149/84948181-a4635d80-b0eb-11ea-9fa5-52cbc97c567a.png)

Keep in mind that this setup will result in a large amount of network traffic, even when you are not using speech recognition!  This can only be solved by running the wake-word detection on the device which is connected to the microphone.
