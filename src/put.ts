import {
    evaluatePutOptionsPerformance,
    calculateMaxStrikePrice,
    filterOptionsByStrikePrice,
    getOptionQuote,
    parsePutParams, printStockChains, filterCherries,
} from "./utils.js";
import {OptionAnalysisResult} from "./types";

//Don't show me options with exp date the is more than X days from today
const MAX_DAYS_TO_EXP = 45
const CHEERIES_ONLY = false

console.log('Script is running 🚀🚀🚀')
const stocksInputData = parsePutParams();

const maxExpDate = new Date(Date.now() + MAX_DAYS_TO_EXP * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

let resultArr = []

for(const stockInputRow of stocksInputData ) {
    const {symbol,maxStrikePrice} = stockInputRow
    const {rows: stockOptionsChain, currentPrice} = await getOptionQuote(symbol, maxExpDate, "put");

     const absoluteMaxStrikePrice =  calculateMaxStrikePrice(maxStrikePrice,currentPrice);
     const filteredOptionsByPrice = filterOptionsByStrikePrice(stockOptionsChain, absoluteMaxStrikePrice, "put");

    let putOptionPerformance = evaluatePutOptionsPerformance(filteredOptionsByPrice, currentPrice, symbol);

    // Optionally filter for cherries and then sort
    putOptionPerformance = (CHEERIES_ONLY ? filterCherries(putOptionPerformance) : putOptionPerformance)
        .sort((a, b) => b.ROI - a.ROI);

    resultArr = [...resultArr, ...putOptionPerformance];
}

printStockChains(resultArr)



