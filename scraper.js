// Import the necessary libraries we needed
var request = require('request');
/**
 * We are using the cheerio library because it has a comprehensive documentation on how to scrape a site
 * and extract what information you need in the same manner as writing code for jQuery. It's fast and scrapes through a site
 * into a variable quickly, incredibly popular with more than 2 million + downloads and has an active presence with alot
 * of contributors
 */
var cheerio = require('cheerio');
var moment = require('moment');
var Promise = require('promise');
/**
 * Using csv-write-stream to create CSV files as it has easy to use methods to create the file, the headers and the
 * rows of data we need. Its one of the top 10 popular CSV libraries on npmjs.com, has about 70,000 downloads in total,
 * starred 70 times and is well documented and kept up to date. Last update being 7 months ago, with alot of public contributions
 */
var csvWriter = require('csv-write-stream');
var fs = require('fs');

// Necessary variables we need
var dir = './data';
var domainUrl = 'http://www.shirts4mike.com/';

var urls = {
    unprocessUrls: [], // Urls we need to process and scrape for links
    processedUrls: [], // Urls we have processed and scraped, reference for future links we don't want to scrape
    error: ''
};

/**
 * Create directory 'data' to store CSV files
 */
try {
    fs.mkdirSync(dir);
} catch (e) {
    logError(e);
}

/**
 * First start scraping the site from the domainUrl by setting up a promise
 */
scrapeSite('', urls).then(processShirts, processUrls);

/**
 * Function that scrapes a site based on the URL path given
 * @param urlPath - The path of the domainUrl we want to scrape
 * @param urls - Object that contains array of processed Urls we've scraped, and unprocessed Urls yet to be scraped
 * @returns {*|exports|module.exports}
 */
function scrapeSite(urlPath, urls) {
    return new Promise(function (fulfill, reject) {
        var url = domainUrl + urlPath;
        request(url, function (error, response, body) {
            if (error) {
                // If there is an error, set error message to urls object to pass to fulfull function, and return false
                console.error(error);
                urls.error = error;
                fulfill(urls);
                return false;
            }
            var $ = cheerio.load(body);

            /** Find all links that have '.php' extension in it
             * Then we have to make sure we haven't processed the links in either
             * processedUrls or unprocessedUrls
             * If this passes, then push the link href to the unprocessUrls
             */
            $("a[href*=\\.php]").each(function () {

                if (urls.processedUrls.indexOf($(this).attr('href')) === -1 &&
                    urls.unprocessUrls.indexOf($(this).attr('href')) === -1) {
                    urls.unprocessUrls.push($(this).attr('href'));
                }
            });

            /**
             * If the unprocessUrls array is empty, then we have gone through every single .php link
             * in the site, and scraped every site
             */
            if (urls.unprocessUrls.length === 0) {
                fulfill(urls);
            } else {
                reject(urls);
            }
        });
    });
}

/**
 * Take the next available link from the unprocessUrls and scrape it for any unprocessed links
 * @param urls - Object that contains array of processed Urls we've scraped, and unprocessed Urls yet to be scraped
 */
function processUrls(urls) {

    var urlPath = urls.unprocessUrls.shift();
    urls.processedUrls.push(urlPath);
    scrapeSite(urlPath, urls)
        .then(processShirts, processUrls);
}

/**
 * Function that when all links are processed, we go through each one to start retrieving data of shirts
 * @param urls - Object that contains array of processed Urls we've scraped, and unprocessed Urls yet to be scraped
 */
function processShirts(urls) {
    if (urls.error !== '') {
        logError(urls.error);
    } else {
        // Let's create an object with two arrays
        var shirtObject = {
            shirtUrls: [], // Urls that are T shirt links e.g. shirt.php?id=10
            shirtsArray: [] // Array that contains array of data per shirt
        };

        for (var i = 0; i < urls.processedUrls.length; i++) {
            // Find only links that definitely are pages that have details about shirts
            if (urls.processedUrls[i].indexOf('id=') > 0) {
                shirtObject.shirtUrls.push(urls.processedUrls[i]);
            }
        }
        // When that is done, start the process of retrieving data
        populateShirtUrls(shirtObject);
    }
}

/**
 * Call a promise where we start populating CSV data until we've done all links, and then we generate the CSV
 * @param shirtObject - Object that contains property that has all the shirts data to be written to the CSV file
 */
function populateShirtUrls(shirtObject) {

    populateCSVData(shirtObject)
        .then(generateCSV, populateShirtUrls);
}

/**
 * Function that creates a promise which parses a Shirt detail page, then pops the shirt link from shirtUrls
 * @param shirtObject - Object that contains property that has all the shirts data to be written to the CSV file
 * @returns {*|exports|module.exports}
 */
function populateCSVData(shirtObject) {
    return new Promise(function (fulfill, reject) {
        var shirtDetailUrl = domainUrl + shirtObject.shirtUrls.shift();
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
            shirtObject.shirtsArray.push(shirtArray);

            if (shirtObject.shirtUrls.length === 0) {
                fulfill(shirtObject);
            } else {
                reject(shirtObject);
            }
        });
    });
}

/**
 * Function that using the data from shirtsArray, to generate the CSV file we need
 * @param shirtObject - Object that contains property that has all the shirts data to be written to the CSV file
 */
function generateCSV(shirtObject) {
    var writer = csvWriter({headers: ["Title", "Price", "ImageURL", "URL", "Time"]});
    writer.pipe(fs.createWriteStream(dir + '/' + moment().format('YYYY-MM-DD') + '.csv'));

    for (var i = 0; i < shirtObject.shirtsArray.length; i++) {
        writer.write(shirtObject.shirtsArray[i]);
    }
    writer.end();
}

/**
 * Log error messages in our log file
 * @param errorMessage - String of what went wrong
 */
function logError(errorMessage) {
    var errorString = '[' + (new Date().toString()) + '] ' + errorMessage + '\r\n';
    console.error(errorString);
    fs.appendFile('scraper-error.log', errorString, function (err) {
    });
}

