
This just hosts a webserver which downloads and responds with the audio of the first youtube video found with the given name to search for.  

Node server listens for url query, which it searches for with [youtube-npm](https://www.npmjs.com/package/youtube-node), the first result is forwarded on to [youtube-dl](https://github.com/rg3/youtube-dl) to download, then serves the resulting mp3 back.  


This is really just to avoid subscribing to spotify to get music on my phone.
