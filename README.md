# node-red-contrib-voice2json
Node-RED nodes that provide a simple wrapper for local speech and intent recognition on linux via [voice2json](http://voice2json.org/).

Thanks to [Johannes Kropf](https://github.com/johanneskropf), my partner in crime for this node!  He has provided the idea of integrating Voice2Json in Node-RED.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install bartbutenaers/node-red-contrib-voice2json
```
Install voice2json on the same machine as nodered. Detailed instructions can be found in the [voice2json documentation](http://voice2json.org/install.html).

## Voice2json introduction

The [voice2json](http://voice2json.org/) project offers a collection of command line speech and intent recognition tools on Linux or in a Docker container.

## Node Usage

This suite contains 3 Node-RED nodes:

![image](https://user-images.githubusercontent.com/14224149/80300314-cd2a3f00-879b-11ea-9a55-b74bfabd1015.png)

The config node which can be used to store a path to a local voice2json [language profile folder](http://voice2json.org/#supported-languages):

![voice2json_config](https://user-images.githubusercontent.com/14224149/80300328-f1861b80-879b-11ea-9fee-0e2c3476527d.gif)

## Notes on minimizing SD card wear in voice2jsons file based workflow

The voice2json workflow is based on a few differnt concepts. One of them is that all handling of audio data is file based. In the [voice2json](http://voice2json.org/) documentation it describes it as follows:
`All of the available commands are designed to work well in Unix pipelines, typically consuming/emitting plaintext or newline-delimited JSON. Audio input/output is file-based, so you can receive audio from any source.`
The Node-RED wrapper we provide parses the emitted results from JSON to msg objects that you can very easily integrate into an existing Node-RED flow but you will still have to save audio data you want to process outside of Node-RED on your filesystem.
If you run Node-RED and voice2json on an SBC that uses a file system on a medium like an SD card it would be preferable to prevent unescessary writes and work with data in memory.
On hardware similiar to a Raspberry Pi a possible approach would be to create a folder that is mounted to tmpfs via fstab.
You can do this by creating a folder using the `mkdir`command for example `mkdir /home/pi/tmp` and than adding the line `tmpfs  /home/pi/tmp  tmpfs  defaults,noatime,size=100m  0 0` to `/etc/fstab`. After a reboot `/home/pi/tmp`will be mounted to ram. This means that data in it will be lost upon reboot but sd card writes will be greatly reduced.
More information on this approach can be found here: https://www.zdnet.com/article/raspberry-pi-extending-the-life-of-the-sd-card/.
