
var EventEmitter = require('events').EventEmitter;
var exec = require('child_process').exec;
var minimist=require('minimist');
var http = require('http');
var youtube = new (require('youtube-node'))();
var fs = require('fs');
var sanitize = require('sanitize-filename');

var params = minimist(process.argv.slice(2));
var keys = require(params['keys'] || './keys.json');

const PORT=params['p'] || 9090;

youtube.setKey(keys.youtube);

var html = fs.readFileSync('index.html');

var testres;

// youtube.search('gonna go far kid', 2, (err, res) => {

var params = (req) => {
  let q = req.url.split('?'), result = {};

  if (q.length >= 2) {
    q[1].split('&').forEach(i => {
      try {
        result[i.split('=')[0]] = unescape(i.split('=')[1]);
      } catch (e) {
        result[i.split('=')[0]] = '';
      }
    });
  }

  return result;
};

var downloading = {};

const handleRequest = (req, res) => {
  
  var p = params(req);
  var search = p['search'];
  if (search && search != '') {
    var ip = req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         req.connection.socket.remoteAddress;
    console.log('From ' + ip + ' searching: ' + search);
    youtube.search(search, 1, (err, list) => {
      if (err) {
        res.end('Error during search: ' + err);
        console.log('Error during search: ' + err);
      }
      else {
        if (list.items.length == 0) res.end('No results for search: ' + search);
        else {

          var url = "https://www.youtube.com/watch?v=" + list.items[0].id.videoId;
          var videoName = list.items[0].snippet.title.split(' ').join('_'); // Replace spaces
          videoName += '.mp3';
          videoName = sanitize(videoName);
          var videoPath = './dl/' + videoName;

          var checkAndContinue = function () {

            fs.access(videoPath, fs.R_OK, (err) => {
              // Doesn't exist
              if (err) {
                 var cmd = 'youtube-dl --extract-audio --audio-format mp3 "' + url + '" -o "' + videoPath + '"';

                console.log('Executing: ' + cmd);
                
                downloading[videoPath] = new EventEmitter();

                exec(cmd, (err, stdout, stderr) => {

                  if (err) {
                    console.log('cmd err:' + err);
                    res.end('Cmd err:' + err);
                    downloading[videoPath].emit('error');
                    delete downloading[videoPath];
                    return;
                  }

                  downloading[videoPath].emit('done');
                  delete downloading[videoPath];

                  // Begin streaming file
                  var stat = fs.statSync(videoPath);
                  var total = stat.size;

                  res.writeHead(200, {
                    'Content-Length': total,
                    'Content-Type': 'audio/mp3',
                    'Content-Disposition': 'inline; filename="' + videoName + '.mp4"'
                  });
                  fs.createReadStream(videoPath).pipe(res);
                });
              }
              else {

                console.log(videoPath + ' already exists.');

                // Begin streaming file
                var stat = fs.statSync(videoPath);
                var total = stat.size;

                res.writeHead(200, {
                  'Content-Length': total,
                  'Content-Type': 'audio/mp3',
                  'Content-Disposition': 'inline; filename="' + videoName + '.mp4"'
                });
                fs.createReadStream(videoPath).pipe(res);
              }
            });
          };


          // Wait if already downloading
          if (downloading[videoPath]) {
            downloading[videoPath].addListener('done', checkAndContinue);
            downloading[videoPath].addListener('error', res.end('error'));
          }
          else {
            checkAndContinue();
          }

        }
      }
    });
  }
  else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);
  }
};

var server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log("MP3 Fetching server listening on port %s", PORT);
});

