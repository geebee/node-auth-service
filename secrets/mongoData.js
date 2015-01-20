/* {{{ Rules:
 *  A compliant secret handler:
 *   1. Extends EventEmitter
 *   2. Contains NAME, and DESCRIPTION constants
 *   3. Has a 'retrieve' function, which:
 *    a. emits a 'received' event upon receiving the request for a secret
 *    b. emits a 'retrieved' event upon successfully retrieving and formatting the secret for delivery
 *    c. emits an 'unauthorized' event upon the authentication attempt failing (no results found)
 *    d. emits an 'error' event upon being unable to successfully process the secret
 *    e. may take any number of optional/mandatory parameters as needed
 */
// }}}

var EventEmitter = require("events").EventEmitter;
var mongoData = new EventEmitter();
var mongoose = require("mongoose");
var isConnected = false;
var receivedTime;

mongoData.NAME = "mongoData";
mongoData.DESCRIPTION = "Retrieves data from a MongoDB collection based on DB, collectionName, and query";

var DummySchema, Dummy;

function findMatching(query) {
  Dummy.findOne({email: query.email}, 'passwordHash signingKey', function(err, data) {
    if (err) {
      console.log("Error: " + err);
      console.log("about to emit 'error' event");
      err = "Mongo Error: " + err;
      mongoData.emit("error", err);
    }
    if (!data) {
      console.log("about to emit 'unauthorized' event");
      err = "No user matching submitted credentials found";
      mongoData.emit("unauthorized", err);
    } else {
      var regularData = data.toObject();
      var bcrypt = require("bcrypt");
      bcrypt.compare(query.passwordHash, regularData.passwordHash, function(err, passwordMatch) {
        if (err) {
          console.log("Bcrypt Comparison Error: " + err);
          mongoData.emit("error", err, null);
        } else {
          var processedTime = new Date().getTime();
          console.log("Secret retrieved in: %dms", processedTime - receivedTime);
          if (passwordMatch === true) {
            console.log("about to emit 'retrieved' event");
            delete regularData.passwordHash;
            mongoData.emit("retrieved", null, regularData);
          } else if (passwordMatch === false) {
            console.log("Password Hashes did not match");
            mongoData.emit("error", "Password was invalid", null);
          } else {
            console.log("Error: Unknown Value in Hash Comparison Function");
            mongoData.emit("error", "Unknown error in hash comparison result", null);
          }
        }
      });
    }
  });
}

mongoData.retrieve = function(dbConnectionString, collectionName, query) {
  console.log("about to emit 'received' event");
  receivedTime = new Date().getTime();
  mongoData.emit("received", null);

  if (isConnected === false) {
    console.log("Connecting to Mongo");
    mongoose.connect(dbConnectionString, {server: {poolSize: 5}});
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function () {
      console.log("Connected to Mongo");
      DummySchema = mongoose.Schema({}, {collection: collectionName});
      Dummy = mongoose.model('Dummy', DummySchema);
      isConnected = true;
      findMatching(query);
    });
  } else {
    console.log("Already connected, just querying");
    findMatching(query);
  }
};

module.exports = mongoData;
