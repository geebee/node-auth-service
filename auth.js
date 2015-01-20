//rebuild
var http = require("http");
var url = require("url");
var fs = require("fs");
var bunyan = require("bunyan");

process.log = bunyan.createLogger({
  name: "auth",
  streams: [
    {
      stream: process.stdout,
      level: "debug"
    },
    {
      type: 'rotating-file',
      path: 'log/error.log',
      level: 'error',
      period: 'weekly',
      count: 10
    }
  ]
});

// {{{ Command Line Processing - Sets 'secret', 'endpoint', 'port', 'dbConnectionString'
var secret, endpoint, dbConnectionString;
var processArgs = process.argv.slice(2);
while (processArgs.length > 0) {
  var key = processArgs.shift();
  var value = (processArgs[0].substring(0, 2) === '--') ? null : processArgs.shift();
  switch(key) {
    case "--secret":
      secret = value;
      break;
    case "--endpoint":
      endpoint = value;
      break;
    case "--port":
      port = value;
      break;
    case "--db":
      dbConnectionString = value;
      break;
    default:
      process.log.fatal("Incorrect parameters were used. Usage:\n  " + process.argv[0] + " " + process.argv[1] + " --secret <secret module> --endpoint <URL Path (no /'s)> --port <port number> --db <mongodb connection string>\n");
      process.exit(1);
  }
}

if (typeof secret === "undefined") {
  var fromEnv = process.env["SECRET"];
  if (typeof fromEnv === "undefined" || !fromEnv) {
    process.log.info("The --secret flag was not passed, and 'SECRET' could not be found in the environment, defaulting to 'mongoData'");
    secret = "mongoData";
  } else {
    secret = fromEnv;
  }
}
if (typeof endpoint === "undefined") {
  var fromEnv = process.env["ENDPOINT"];
  if (typeof fromEnv === "undefined" || !fromEnv) {
    process.log.info("The --endpoint flag was not passed, and 'ENDPOINT' could not be found in the environment, defaulting to 'auth'");
    endpoint = "auth";
  } else {
    endpoint = fromEnv;
  }
}
if (typeof port === "undefined") {
  var fromEnv = process.env["PORT"];
  if (typeof fromEnv === "undefined" || !fromEnv) {
    process.log.info("The --port flag was not passed, and 'PORT' could not be found in the environment, defaulting to 8891");
    port =  8891;
  } else {
    port = fromEnv;
  }
}
if (typeof dbConnectionString === "undefined") {
  var fromEnv = process.env["MONGO_PORT"];
  if (typeof fromEnv === "undefined" || !fromEnv) {
    process.log.fatal("The --db flag was not passed, and 'MONGO_PORT' could not be found in the environment, cannot start");
    process.exit(1);
  } else {
    dbConnectionString = fromEnv.replace("tcp:", "mongodb:");
  }
}

try {
  var secretHandler = require("./secrets/" + secret);
  process.log.info("Secret Handler - '" + secretHandler.NAME + "' registered");
} catch (e) {
  if (e.code === "MODULE_NOT_FOUND") {
    process.log.fatal("Secret module '" + secret + "' was not found in the secrets directory");
    process.exit(1);
  } else {
    throw e;
  }
}
// }}}

var auth = http.createServer(function(req, res) {
  var parsedURL = url.parse(req.url, true);
  if (parsedURL.pathname === "/" + endpoint) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'accepts,content-type,authorization,x-date,x-epoch-timestamp,x-request-id,x-content-length,content-md5',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,HEAD'
      });
      res.end();
    } else if (req.method === "POST") {
      var rawPostData = "";
      req.on("data", function(chunk) {
        rawPostData += chunk;
      });
      req.on("end", function() {
        var parsedPostData = {};
        rawPostData.split("&").forEach(function(kvPair){
          tempData = kvPair.split("=");
          parsedPostData[tempData[0]] = decodeURIComponent(tempData[1]);
        });
        process.log.debug("Parsed Post Data: %j", parsedPostData);

        secretHandler.once("error", function(err) {
          res.writeHead(500, "Internal Server Error", {"Content-Type": "application/json"});
          res.write(JSON.stringify({status: "error", message: "Unknown error has occurred with message: " + err }));
          res.end();
          process.log.error("Internal Error: " + err, {status: 500, method: req.method, url: req.url, error: err});
        });
        secretHandler.once("unauthorized", function(err) {
          res.writeHead(401, "Unauthorized", {"Content-Type": "application/json"});
          res.end(JSON.stringify({status:"denied", error: "" + err}));
          process.log.error("Unauthorized: " + err, {status: 401, method: req.method, url: req.url, error: err});
        });
        secretHandler.once("retrieved", function(err, data) {
          if (err) {
            res.writeHead(500, "Internal Server Error", {"Content-Type": "application/json"});
            res.write(JSON.strigify({status: "error", message: "Unknown error has occurred with message: " + err}));
            res.end();
            process.log.error("Internal Error: " + err, {status: 500, method: req.method, url: req.url, error: err});
          } else {
            res.writeHead(200, "OK", {
              "Content-Type": "application/json",
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'accepts,content-type,authorization,x-date,x-epoch-timestamp,x-request-id,x-content-length,content-md5',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,HEAD'
            });
            res.write(JSON.stringify(data));
            res.end();
            process.log.info(req.method + " request successful", {status:200, method: req.method, url: req.url});
          }
        });
        //dbName, collectionName, query
        secretHandler.retrieve(dbConnectionString + "/zigSwag", "users", {email: parsedPostData.email, passwordHash: parsedPostData.password});
      });
    } else {
      res.writeHead(405, "Method Not Allowed", {"Content-Type": "application/json"});
      res.write(JSON.stringify({status: "error", message: "Only POSTs are allowed to this URL"}));
      res.end();
      process.log.error(req.method + " requested, only POSTS allowed", {status: 405, method: req.method, url: req.url});
    }
  } else {
    res.writeHead(405, "Method Not Allowed", {"Content-Type": "application/json"});
    res.write(JSON.stringify({status: "error", message: "Only POSTs are allowed to this URL"}));
    res.end();
    process.log.error(req.method + " requested, only POSTS allowed", {status: 405, method: req.method, url: req.url});
  }
}).listen(port, function() {
  var ip = auth.address().address;
  var port = auth.address().port;
  process.log.info("Authentication endpoint is waiting at: http://" + ip + ":" + port + "/" + endpoint, {protocol: 'http', ip: ip, port: port, endpoint: endpoint});
});
