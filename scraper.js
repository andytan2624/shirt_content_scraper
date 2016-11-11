var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
var url = 'http://www.shirts4mike.com/';
var csvWriter = require('csv-write-stream');
var fs = require('fs');
var dir = './data';
var shirtsArray = [];

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

request(url, function(error, response, body) {
    if(error) {
        console.log("Error: " + error);
        return false;
    }
    var $ = cheerio.load(body);

    var linkToShirts = $('.nav li.shirts a').attr('href');

    getShirtsPage(url + linkToShirts);

});

function getShirtsPage(shirtIndexUrl) {
    request(shirtIndexUrl, function(error, response, body) {
        console.log(response.statusCode);
        var $ = cheerio.load(body);

        $('.products li a').each(function(index){
            var shirtDetailUrl = $(this).attr('href');
            getShirtDetails(url + shirtDetailUrl);
            console.log(shirtDetailUrl);
        });

        generateCSV();
    });
}

function getShirtDetails(shirtDetailUrl) {
    request(shirtDetailUrl, function(error, response, body) {
        console.log(error);
        var $ = cheerio.load(body);
        var price = $('.shirt-details h1 .price').text();
        var name = $('.shirt-details h1').text().replace($('.shirt-details h1 .price').text()+ ' ', '');
        var date = new Date();
        var imageURL = $('.shirt-picture span img').attr('src');
        var shirtArray = [name, price, imageURL, shirtDetailUrl, date.toTimeString()];
        shirtsArray.push(shirtArray);
        console.log(shirtsArray);
    });
}

function generateCSV() {
    var writer = csvWriter({ headers: ["Title", "Price", "ImageURL", "URL", "Time"]});
    writer.pipe(fs.createWriteStream(moment().format('YYYY-MM-DD') + '.csv'));
    //console.log(shirtsArray.length);
    for (var i = 0; i < shirtsArray.length; i++) {
     //   console.log(shirtsArray[i]);
    //    writer.write(shirtsArray[i]);
    }
    writer.end();
}



