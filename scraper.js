// Import the necessary libraries we needed
var request = require('request');
/**
 * We are using the cheerio library because it has a comprehensive documentation on how to scrape a site
 * and extract what information you need in the same manner as writing code for jQuery
 */
var cheerio = require('cheerio');
var moment = require('moment');
var Promise = require('promise');
/**
 * Using csv-write-stream to create CSV files as it has easy to use methods to create the file, the headers and the
 * rows of data we need
 */
var csvWriter = require('csv-write-stream');
var fs = require('fs');

// Necessary variables we need
var dir = './data';
var domainUrl = 'http://www.shirts4mikee.com/';


var unprocessUrls = []; // Urls we need to process and scrape for links
var processedUrls = []; // Urls we have processed and scraped, reference for future links we don't want to scrape
var shirtUrls = []; // Urls that are T shirt linkes e.g. shirt.php?id=10
var shirtsArray = []; // Array that contains array of data per shirt

/**
 * Create directory 'data' to store CSV files
 */
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

/**
 * First start scraping the site from the domainUrl by setting up a promise
 */
scrapeSite('').then(processShirts, processUrls);

/**
 * Function that scrapes a site based on the URL path given
 */
function scrapeSite(urlPath) {
    return new Promise(function (fulfill, reject) {
        var url = domainUrl + urlPath;
        request(url, function (error, response, body) {
            if (error) {
                fulfill(error);
                return false;
            }
            var $ = cheerio.load(body);

            /** Find all links that have '.php' extension in it
             * Then we have to make sure we haven't processed the links in either
             * processedUrls or unprocessedUrls
             * If this passes, then push the link href to the unprocessUrls
             */
            $("a[href*=\\.php]").each(function () {
                if (processedUrls.indexOf($(this).attr('href')) === -1 &&
                    unprocessUrls.indexOf($(this).attr('href')) === -1) {
                    unprocessUrls.push($(this).attr('href'));
                }
            });

            /**
             * If the unprocessUrls array is empty, then we have gone through every single .php link
             * in the site, and scraped every site
             */
            if (unprocessUrls.length === 0) {
                fulfill();
            } else {
                reject();
            }
        });
    });
}

/**
 * Take the next available link from the unprocessUrls and scrape it for any unprocessed links
 */
function processUrls() {
    var urlPath = unprocessUrls.shift();
    processedUrls.push(urlPath);
    scrapeSite(urlPath)
        .then(processShirts, processUrls);
}

/**
 * Function that when all links are processed, we go through each one to start retrieving data of shirts
 * @param error_message
 */
function processShirts(message) {
    if (message !== undefined) {
        logError(message);
    } else {
        for (var i = 0; i < processedUrls.length; i++) {
            // Find only links that definitely are pages that have details about shirts
            if (processedUrls[i].indexOf('id=') > 0) {
                shirtUrls.push(processedUrls[i]);
            }
        }
        // When that is done, start the process of retrieving data
        populateShirtUrls();
    }
}

/**
 * Call a promise where we start populating CSV data until we've done all links, and then we generate the CSV
 */
function populateShirtUrls() {
    populateCSVData()
        .then(generateCSV, populateShirtUrls);
}

/**
 * Function that creates a promise which parses a Shirt detail page, then pops the shirt link from shirtUrls
 * @returns {*|exports|module.exports}
 */
function populateCSVData() {
    return new Promise(function (fulfill, reject) {
        var shirtDetailUrl = domainUrl + shirtUrls.shift();
        request(shirtDetailUrl, function (error, response, body) {
            if (error) {
                logError("Error: " + error);
                return false;
            }

            var $ = cheerio.load(body);
            var price = $('.shirt-details h1 .price').text();
            var name = $('.shirt-details h1').text().replace($('.shirt-details h1 .price').text() + ' ', '');
            var date = new Date();
            var imageURL = $('.shirt-picture span img').attr('src');
            var shirtArray = [name, price, imageURL, shirtDetailUrl, date.toTimeString()];
            shirtsArray.push(shirtArray);

            if (shirtUrls.length === 0) {
                fulfill();
            } else {
                reject();
            }
        });
    });
}

// Function that using the data from shirtsArray, to generate the CSV file we need
function generateCSV() {
    var writer = csvWriter({headers: ["Title", "Price", "ImageURL", "URL", "Time"]});
    writer.pipe(fs.createWriteStream(dir + '/' + moment().format('YYYY-MM-DD') + '.csv'));

    for (var i = 0; i < shirtsArray.length; i++) {
        writer.write(shirtsArray[i]);
    }
    writer.end();
}

// Log error messages in our log file
function logError(errorMessage) {
    var errorString = '[' + (new Date().toString()) + '] ' + errorMessage + '\r\n';
    fs.appendFile('scraper-error.log', errorString, function (err) {
    });
}

