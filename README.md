# node-red-contrib-voice2json

`!!!This is very much wip, so please use carefully. The nodes will only work with the latest version of voice2json and are not backwards compatible with voice2json 1.0.0!!!`

Node-RED nodes that provide a simple wrapper for local speech and intent recognition on linux via [voice2json](http://voice2json.org/).

Thanks to [Bart Butenaers](https://github.com/bartbutenaers), my partner in crime for this node!  He came up with the crazy idea that i should get involved in this business of node-red node development and without him his knowledge and his huge contribution to this node it wouldn't be here today.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install johanneskropf/node-red-contrib-voice2json
```
Install voice2json on the same machine as nodered. Detailed instructions can be found in the [voice2json documentation](http://voice2json.org/install.html).

If you want to use node-red-contrib-voice2json with a docker install you have to adapt the supplied bash script to include the line `-v “/dev/shm/:/dev/shm/“ \`.
So it will be:
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

## Voice2json introduction

The [voice2json](http://voice2json.org/) project offers a collection of command line speech and intent recognition tools on Linux or in a Docker container.

## Node Usage

This suite contains 5 Node-RED nodes:

![image](https://user-images.githubusercontent.com/14224149/80300314-cd2a3f00-879b-11ea-9a55-b74bfabd1015.png)

### A note on audio formats

***The nodes in this suite expect a certain audio format. The format is:***
* wait wake & record command:
    * a stream of raw audio buffers
* stt:
    * a single wav as a buffer object
* Little Endian
* signed-integer
* 1 channel mono
* 16000 Hz
* 16 bit

### Nodes
#### Config

The config node which can be used to store a path to a local voice2json [language profile folder](http://voice2json.org/#supported-languages):

![voice2json_config](https://user-images.githubusercontent.com/14224149/80300328-f1861b80-879b-11ea-9fee-0e2c3476527d.gif)

When using the nodes with the docker container installation you have to download any profile you want to use to a path somewhere in your home directory as otherwise the container will not be able to access it. Another option would be to include the path to your container as an additional `-v` argument in the voice2json docker run bash script.

#### Train

The training node enables the training of a profile from node-red. To start training select the profile to train from the nodes config and than after deploying send a `payload`of `train` as the configured input `msg` property. Any Output of the training will be send to the configured output.

#### Wait Wake

A node to listen to a stream of raw audio buffers and detect a wake-word. When a wake word was detected it sends an object including the detected wake word, the time of detection relative to the nodes start and a unix timestamp to the first output. If the `Forward audio to 2nd output on detection` option is checked the node will start ignoring any detected wake words after a detection and start forwarding the raw audio chunks to its second output until it receives a payload of `listen` on which it will stop forwarding and start listening for a wake word again. The second output can be directly connected to record command node to record a command after a wake word was detected when in forward mode.
A possible source for the input stream of raw audio buffers is [node-red-contrib-sox-record](https://github.com/johanneskropf/node-red-contrib-sox-record) which should work out of the box with this node.
More info about how to set a wake word or train your own can be found in the [voice2json documentation](http://voice2json.org/commands.html#wait-wake).

#### Record Command

A node to record a voice command from a stream of raw audio buffers. The record command node will start recording a voice command from a stream of raw audio buffers as soon as they start arriving on the configured input. It will stop recording when it detects silence / the end of the command. As soon as its stops recording it will send a single buffer to the configured output containing a wav audio object that consists just of the detected speech. If the input audio stream is not stopped it will start recording a new command after a 2 second timeout.
This nodes input can be directly connected to the second output of the wait wake node in forward mode or any other node that can send a stream of raw audio buffers in the correct format. The output wav buffer can be directly fed to the voice2json stt node for transcription.

#### Speech To Text

#### Text To Intent

## Notes on minimizing SD card wear in voice2jsons file based workflow

The voice2json workflow is based on a few differnt concepts. One of them is that all handling of audio data is file based. In the [voice2json](http://voice2json.org/) documentation it describes it as follows:
`All of the available commands are designed to work well in Unix pipelines, typically consuming/emitting plaintext or newline-delimited JSON. Audio input/output is file-based, so you can receive audio from any source.`
The Node-RED wrapper we provide parses the emitted results from JSON to msg objects that you can very easily integrate into an existing Node-RED flow but you will still have to save audio data you want to process outside of Node-RED on your filesystem.
If you run Node-RED and voice2json on an SBC that uses a file system on a medium like an SD card it would be preferable to prevent unnecessary writes and work with data in memory.
This is why we implemented a feature were you can pass the wav data as a single buffer object to the stt node. As we need to have a copy of the wav in the file system we use the `/dev/shm/` directory to write a tmp copy of the passed in buffer.
'/dev/shm' is mounted to ram by default and you can read more about it [here](https://www.cyberciti.biz/tips/what-is-devshm-and-its-practical-usage.html).
On hardware similiar to a Raspberry Pi another possible approach would be to create your own folder that is mounted to tmpfs via fstab.
You can do this by creating a folder using the `mkdir`command for example `mkdir /home/pi/tmp` and than adding the line `tmpfs  /home/pi/tmp  tmpfs  defaults,noatime,size=100m  0 0` to `/etc/fstab`. After a reboot `/home/pi/tmp`will be mounted to ram. This means that data in it will be lost upon reboot but sd card writes will be greatly reduced.
More information on this approach can be found here: https://www.zdnet.com/article/raspberry-pi-extending-the-life-of-the-sd-card/.
