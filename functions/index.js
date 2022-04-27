const functions = require("firebase-functions");
const admin = require("firebase-admin");
const rp = require("request-promise");
const cheerio = require("cheerio");
// const {StringDecoder} = require("string_decoder");
const fs = require("fs");
// const readline = require("readline");
const puppeteer = require("puppeteer");

/* eslint-disable */


// var serviceAccount =
// require("G:/keys/asset-manager-271ba-firebase-adminsdk-ggtbe-55a38d9604.json");

// function deploy 전에 실행할 것
// export GOOGLE_APPLICATION_CREDENTIALS="G:/keys/asset-manager-271ba-firebase-adminsdk-ggtbe-55a38d9604.json"
// functions랑 호스팅 에뮬레이터 실행
// firebase emulators:start --only functions,hosting

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "https://asset-manager-271ba.firebaseio.com",
  // databaseURL: "http://localhost:4000/firestore"
});


// var admin = require("firebase-admin");
//
// // var serviceAccount = require("path/to/serviceAccountKey.json");
//
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

let stockCodes = [];

async function processLineByLine() {
  console.log("processing");
  stockCodes = fs.readFileSync("code.txt", "utf-8")
      .split("\n")
      .filter(Boolean);
}


function connectStock(stockCode) {
  const url = "http://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?pGB=1&gicode=A" + stockCode +"&cID=&MenuYn=Y&ReportGB=&NewMenuID=11&stkGb=701";

  console.log(stockCode);
  return rp(url);
}

// 0. 환율 가져오기 안됨
// 1. stock 으로 아이템 만들기
// 2. stockPrice 랑 stockNo 를 regex 하기
// 3. 값들을 숫자로 바꾸기
// 4. description 이 2부분으로 되어있는데 다 가져오기
// 5. 좀 더 빠르게 할 때 2개씩 넣으면 퐁당퐁당으로 가져오는 문제 있음
// 6. 내가 원하는 값들을 DB에 저장하기

function scrape(html) {
  const ch = cheerio.load(html);
  const name = ch("#giName").text();
  // let equityHoldings;
  // let roe;
  let stocksNo;
  // const requiredReturnRate = 8.21;
  let stockPrice;
  // let description;
  try {
    // equityHoldings = ch("#highlight_D_A > table > tbody > tr:nth-child(10) > td:nth-child(4)").text();
    // roe = ch("#highlight_D_A > table > tbody > tr:nth-child(18) > td:nth-child(5)").text();
    stocksNo = ch("#svdMainGrid1 > table > tbody > tr:nth-child(7) > td:nth-child(2)").text();
    stockPrice = ch("#svdMainGrid1 > table > tbody > tr:nth-child(1) > td:nth-child(2)").text();
    console.log(name);
    console.log(stocksNo);
    // const split = stockPrice.split("/ ");
    console.log("stockPrice" + stockPrice);
    // let stockAmount = parseInt(split[0].replaceAll(',', '')) + parseInt(split[1].replaceAll(',', ''));
    // console.log(stockAmount);
    // description = ch('#bizSummaryContent');
    // //console.log(description);
    // let child = description.children('li');
    // console.log(child.text());

    // var stock = newStock(name, stockPrice);
    const stock = {
      name: name,
      price: stockPrice,
    };

    // console.log(stock);
    return saveDB(stock);
  } catch (e) {
    // roe = "N/A";
  }
  // checkSRim();
}

// stocks / stockName
// currency / dollar

const db = admin.firestore();

function saveDB(stock) {
  console.log("savedb");
  const doc = db.collection("stocks").doc(stock.name);
  return doc.set(stock);
}

function onConnectError(error, url) {
  console.log(url);
  console.log("error" + error);
}

// function checkSRim() {
//   let price;
//   price = (equityHoldings + equityHoldings * ((roe-requiredReturnRate)/requiredReturnRate) + 100000000)/stocksNo;
//   if (price < stockPrice) {
//     console.log(name);
//   }
// }

// function newStock(name, price) {
//   return {
//     name: name,
//     price: price,
//   };
// }


function getCurrencyRate() {
  const url = "https://finance.daum.net/exchanges";

  puppeteer
      .launch()
      .then(function(browser) {
        return browser.newPage();
      })
      .then(function(page) {
        return page.goto(url).then(function() {
          return page.content();
        });
      })
      .then(function(html) {
        const ch = cheerio.load(html);
        const dollarRate = ch("#boxContents > div:nth-child(2) > div:nth-child(2) > div > table > tbody > tr:nth-child(1) > td:nth-child(3) > span").text();
        console.log(dollarRate);
      })
      .catch(function(err) {
        console.log("err");
      });
}

exports.getStockCodes = functions.https.onRequest((request, response) => {
  processLineByLine();
  response.set("Access-Control-Allow-Origin", '*');
  response.status(200).send(stockCodes);
})


exports.currencyRate = functions.https.onRequest((request, response) => {
  getCurrencyRate(); //todo: later
})


exports.scraping = functions.https.onRequest((request, response) => {
  let stockCode = request.query.stockCode;
  console.log(stockCode);
  if(!stockCode || stockCode.length<=0) {
    response.status(500).send("Please enter stock code");
  }
  let myPromise = new Promise((resolve, reject) => {
    let p1 = connectStock(stockCode).then(function(result) {
      //console.log('connectStock Result: ' + result);
      scrape(result).then(function(result) {
        //console.log(result);
        resolve(result);
      })
    })
  });
  //console.log('myPromise: ' + myPromise);
  myPromise.then(function(result) {
    response.set('Access-Control-Allow-Origin', '*');
    response.status(200).send(result);
  })
  return myPromise;

  //processLineByLine();

  // for(i=0; i<stockCodes.length; i++) {
  //   connectStock(i)
  // }
  // const results = [];
  //
  // return connectStock(onConnectSuccess, onConnectError, i);
  //
  // result.then(function() {
  //   console.log("scraping complete!");
  //   results.push(result);
  //   results.then(function(html) {
  //       successFn(html);
  //       // if(index < 10) {
  //       //   connectStock(successFn, errorFn, index+3);
  //       // }
  //     })
  //     .catch(function(err) {
  //       errorFn(err, url);
  //     });
  //
  //   response.send("success");
  //   return Promise.all(results).then((values) => {
  //     console.log("complete!");
  //   });
  //
  // });
});

exports.scrapingSchedule = functions.pubsub.schedule("22:35").onRun((context) => {
  scraping();
  return null;
});
