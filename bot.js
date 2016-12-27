var SlackBot = require('slackbots');
var querystring = require('querystring');
const https = require('https');

var botName = "yelphelp";
var saved = [];
var token = "";
var commands = [
    {
        name: "Nearby",
        pattern: /Nearby ((.{1,}),[\s]{0,1}([\w]{1,}),[\s]{0,1}([\w]{1,}))/,
        path: '/v3/businesses/search?',
        params: function(command, parsed){
            return { 
                location: parsed[0],
                radius: 10000,
                term: "restaurants"
            }
        },
        callback: function(data){   
            SendAddressData(data, 5, false);
        }
    },
    {
        name: "Closeby",
        pattern: /Closeby ([\d\.\w]{1,})([N|E|S|W]) ([\d\.\w]{1,})([N|E|S|W])/,
        path: '/v3/businesses/search?',
        params: function(command, parsed){
            return {
                longitude: parsed[2] == 'W' ? "-" + parsed[1] : parsed[1],
                latitude: parsed[4] == 'S' ? "-" + parsed[3] : parsed[3],
                radius: 10000,
                term: "restaurants"
            }
        },
        callback: function(data){
            SendAddressData(data, 5, false);
        }
    },
    {
        name: "Closest",
        pattern:  /Closest ([\d]{1,}) ((.{1,}),[\s]{0,1}([\w]{1,}),[\s]{0,1}([\w]{1,}))/,
        path: '/v3/businesses/search?',
        params: function(command, parsed){
            saved = parsed;
            return { 
                location: parsed[2],
                sort_by: "distance",
                term: "restaurants"
            }
        },
        callback: function(data){
            SendAddressData(data, parseInt(saved[1]), false);
        }
    },
    {
        name: "Top",
        pattern: /Top ([1-20]{1,}) ((.{1,}),[\s]{0,1}([\w]{1,}),[\s]{0,1}([\w]{1,}))/,
        path: '/v3/businesses/search?',
        params: function(command, parsed){
            saved = parsed;
            return { 
                location: parsed[2],
                sort_by: "rating",
                radius: 10000,
                term: "restaurants"
            }
        },
        callback: function(data){
            SendAddressData(data, parseInt(saved[1]), false);
        }
    },
    {
        name: "FindMe",
        pattern: /FindMe (\w{1,}) ((.{1,}),[\s]{0,1}([\w]{1,}),[\s]{0,1}([\w]{1,}))/,
        path: '/v3/businesses/search?',
        params: function(command, parsed){
            saved = parsed;
            return { 
                location: parsed[2],
                radius: 20000,
                term: "restaurants",
                categories: parsed[1]
            }
        },
        callback: function(data){
            SendAddressData(data, null, true, "No "+saved[1]+" restaurant can be found");
        }
    },
    {
        name: "Reviews",
        pattern: /Reviews (.{1,}) (([\d]{1,})(.{1,}),[\s]{0,1}([\w]{1,}),[\s]{0,1}([\w]{1,}))/,
        path: '/v3/businesses/search?',
        params: function(command, parsed){
            saved = parsed;
            return { 
                location: parsed[2],
                term: parsed[1]
            }
        },
        callback: function(data){
            if(data.total > 0){
                var found = null;
                data.businesses.forEach(function(item){
                    if(item.name == saved[1]){
                        found = item;
                    }
                });
                if(found != null){
                    getData(token, '/v3/businesses/' + found.id + "/reviews", {}, function(data){
                        if(data.total > 0){
                            var count = data.total < 3 ? data.total : 3;
                            for(var i = 0; i < count; i++){
                                var review = data.reviews[i];
                                bot.postMessageToChannel('general', "Username: " + review.user.name 
                                    + " \nRating: " + review.rating 
                                    + " \nText: " + review.text 
                                    + " \nUrl: " + review.url, params);
                            }
                        }
                    });
                }
                else{
                    bot.postMessageToChannel('general', saved[1] + " cannot be found", params);
                }
            }
            else{
                bot.postMessageToChannel('general', "No nearby restaurants can be found", params);
                console.log("No nearby restaurants can be found");
            }
        }
    },
    {
        name: "SearchByPhone",
        pattern:  /SearchByPhone (\d{11,13})/,
        path: '/v3/businesses/search/phone?',
        params: function(command, parsed){
            saved = "+"+parsed[1];
            return { 
                phone: "+"+parsed[1],
                term: "restaurants"
            }
        },
        callback: function(data){
            SendAddressData(data, null, false,"No restaurant with phone number "+saved+" can be found");
        }
    }
];

function SendAddressData(data, count, rating, error){
    if(error == undefined)
        error = "No nearby restaurants can be found";   
    if(data.total > 0){
        var i = 1;
        data.businesses.forEach(function(item){
            console.log(item)
            if(count == null || i <= count){
                if(rating)
                    bot.postMessageToChannel('general', "Name: " + item.name 
                        + " Location: " + item.location.address1 + ", " + item.location.city + ", " + item.location.state + ", " + item.location.country
                        + " Rating: " + item.rating, params);
                else
                    bot.postMessageToChannel('general', "Name: " + item.name 
                        + " Location: " + item.location.address1 + ", " + item.location.city + ", " + item.location.state + ", " + item.location.country, params);
                
                console.log(item.name + " - " + item.location.address1);
            }
            i++;
        });
    }
    else{
        bot.postMessageToChannel('general', error, params);
        console.log(error);
    }
}

var bot = new SlackBot({
    token: 'xoxb-110182098918-JfZDH2vVf1QfBPWBYbvzyrzH',
    name: 'yelphelp'
});

var params = {
    icon_emoji: ':cat:'
};   

bot.on('start', function() {
    bot.postMessageToChannel('general', 'Ready to read commands!', params);
});

bot.on('message', function(data) {
    if(data.text != undefined && data.username != botName){
        commands.forEach(function(command){
            if(command.pattern.test(data.text)){
                yelpApi(command.path, command.params(command, command.pattern.exec(data.text)), command.callback);
            }
        });
    }
});

function yelpApi(path, params, callback){
    var credentials = {
      'grant_type' : "client_credentials",
      'client_id' : "GyzvL649cBT0qS6J4CSFBw", 
      'client_secret' : "gTafECPSc699Y3AtzRmZch8tHMM8nPMxtUS5P25hEXGESHGUwTc14EQVZ9AVRByJ"
    };

    var credentialsStr = querystring.stringify(credentials);

    var authoptions = {
      host: 'api.yelp.com',
      port: '443',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type':'application/x-www-form-urlencoded',
        'Content-Length' : Buffer.byteLength(credentialsStr)      
      }   
    };

    var req = https.request(authoptions, function(response) {
        var str = '';
        response.on('data', function (chunk) {
          str += chunk;
        });

        response.on('end', function () {
            var tokens = JSON.parse(str);
            token = tokens.access_token;
            console.log("Token: ", tokens.access_token);
            getData(tokens.access_token, path, params, callback);
        });
    });

    req.write(credentialsStr);
    req.end();
}

function getData(access_token, path, params, callback)
{
  var paramString = querystring.stringify(params);
  console.log("Params: ", paramString);
  console.log( path + paramString);
  var options = {
    host: 'api.yelp.com',
    port: '443',
    path: path + paramString, 
    method: 'get',
    headers : {
      'Authorization' : 'Bearer ' + access_token,
    }
  };

  mycallback = function(response) {
    var str = '';
    
    response.on('data', function (chunk) {
      str += chunk;
    });
    
    response.on('end', function () {
      callback(JSON.parse(str));
    });
  }
  var newreq = https.request(options, mycallback).end();  
}