/**
 * Created by Heshan.i on 8/1/2016.
 */
var redis = require('redis');
var config = require('config');
var util = require('util');
var bluebird = require('bluebird');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

client = redis.createClient(config.Redis.port, config.Redis.ip);
client.auth(config.Redis.password);

client.on("error", function (err) {
    console.log('error', 'Redis connection error :: %s', err);
});

client.on("connect", function (err) {
    client.select(config.Redis.redisDB, redis.print);
    console.log("Redis Connect Success");
});



dashboardClient = redis.createClient(config.DashboardRedis.port, config.DashboardRedis.ip);
dashboardClient.auth(config.DashboardRedis.password);

dashboardClient.on("error", function (err) {
    console.log('error', 'Redis connection error :: %s', err);
});

dashboardClient.on("connect", function (err) {
    dashboardClient.select(config.DashboardRedis.redisDB, redis.print);
    console.log("Redis Connect Success");
});

function scanAsync(index, pattern, matchingKeys){
    console.log("-------------------Using scanAsync---------------------");
    return dashboardClient.scanAsync(index, 'MATCH', pattern, 'COUNT', 1000).then(
        function (replies) {
            if(replies.length > 1) {
                var match = matchingKeys.concat(replies[1]);
                if (replies[0] === "0") {
                    return match;
                } else {
                    return scanAsync(replies[0], pattern, match)
                }
            }else{
                return matchingKeys;
            }

        });
}

var Publish = function(pattern, message, callback){
    try {
        client.publish(pattern, message, function (err, result) {
            if (err) {
                console.log(util.format('Redis Publish Error - pattern: %s :: Error: %s', pattern, err));
                callback(err, null);
            } else {
                console.log(util.format('Redis Publish - pattern: %s :: Reply: %s', pattern, result));
                callback(null, result);
            }
        });
    }catch(err){
        console.log("Redis Publish Err:: "+ err);
        callback(err, null);
    }
};

var SearchKeys = function (searchString, ignore, callback) {
    var result = [];

    var sPromise = scanAsync(0, searchString, []);
    //var sPromise = client.scanrx(searchPattern).toArray().toPromise();
    sPromise.then(function(replies){
        //if (err) {
        //    logger.error('Redis searchKeys error :: %s', err);
        //    callback(err, result);
        //} else {
        logger.info('Redis searchKeys success :: replies:%s', replies.length);
        if (replies && replies.length > 0) {

            if(ignore && ignore.length > 0){
                for(var i = 0; i < ignore.length; i++){
                    var regexStr = util.format("^.*%s.*$", ignore[i]);
                    var pattern_regex = new RegExp(regexStr);

                    for(var j =0; j < replies.length; j++){
                        if(replies[j].search(pattern_regex) === 0){
                            replies.splice(j,1);
                        }
                    }
                }
            }

            dashboardClient.mget(replies, function(err, result){
                if(err){
                    callback(err, []);
                }else{
                    callback(null, result);
                }
            });
        } else {
            callback(null, result);
        }
        //}
    });
};
/*var SearchKeys = function (searchString, ignore, callback) {
    var result = [];
    try {
        dashboardClient.keys(searchString, function (err, replies) {
            if (err) {
                callback(err, result);
            } else {
                console.log(replies.length + " replies:");
                if (replies.length > 0) {
                    if(ignore && ignore.length > 0){
                        for(var i = 0; i < ignore.length; i++){
                            var regexStr = util.format("^.*%s.*$", ignore[i]);
                            var pattern_regex = new RegExp(regexStr);

                            for(var j =0; j < replies.length; j++){
                                if(replies[j].search(pattern_regex) === 0){
                                    replies.splice(j,1);
                                }
                            }
                        }
                    }
                    dashboardClient.mget(replies, function(err, result){
                        if(err){
                            callback(err, []);
                        }else{
                            callback(null, result);
                        }
                    });
                } else {
                    callback(null, result);
                }
            }
        });
    }catch(err) {
        console.log("Redis Publish Err:: " + err);
        callback(err, result);
    }
};*/


module.exports.Publish = Publish;
module.exports.SearchKeys = SearchKeys;