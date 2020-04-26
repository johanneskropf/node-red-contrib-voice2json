# node-red-contrib-voice2json
Node-RED nodes for local speech and intent recognition via voice2json

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install bartbutenaers/node-red-contrib-msg-resend
```

## Voice2json introduction

The [voice2json](http://voice2json.org/) project offers command line speech and intent recognition on Linux or in a Docker container.

## Node Usage

This suite contains 3 Node-RED nodes:

![image](https://user-images.githubusercontent.com/14224149/80300314-cd2a3f00-879b-11ea-9a55-b74bfabd1015.png)

And a config node which can be used to store a path to a local voice2json installation:

![voice2json_config](https://user-images.githubusercontent.com/14224149/80300328-f1861b80-879b-11ea-9fee-0e2c3476527d.gif)
