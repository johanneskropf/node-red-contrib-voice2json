# node-red-contrib-voice2json
Node-RED nodes that provide a simple wrapper for local speech and intent recognition via [voice2json](http://voice2json.org/).

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
