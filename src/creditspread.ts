import {
    findOptimalCallCreditSpreads,
    calculateMaxStrikePrice,
    filterOptionsByStrikePrice,
    getOptionQuote,
    parseCreditSpreadParams,
    getUniqueExpiryGroups,
} from "./utils.js";
import {OptionAnalysisResult} from "./types";

// Configuration
const MAX_DAYS_TO_EXP = 200;
const MIN_ANNUALIZED_ROI = 15; // 15% minimum annualized ROI
const CHEERIES_ONLY = false;

console.log('Call Credit Spread Analysis is running 🚀🚀🚀');
console.log(`Testing multiple spread widths with minimum annualized ROI of ${MIN_ANNUALIZED_ROI}%`);

const stocksInputData = parseCreditSpreadParams();

const maxExpDate = new Date(Date.now() + MAX_DAYS_TO_EXP * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

let resultArr: OptionAnalysisResult[] = [];

for(const stockInputRow of stocksInputData) {
    const {symbol, minStrikePrice} = stockInputRow;
    console.log(`Analyzing ${symbol} with minimum strike price at ${minStrikePrice * 100}% of current price...`);
    
    const {rows: stockOptionsChain, currentPrice} = await getOptionQuote(symbol, maxExpDate, "call");
    const expiryGroups = getUniqueExpiryGroups(stockOptionsChain);

    const absoluteMinStrikePrice = calculateMaxStrikePrice(minStrikePrice, currentPrice);
    const filteredOptionsByPrice = filterOptionsByStrikePrice(stockOptionsChain, absoluteMinStrikePrice, "call");
    
    // Find optimal credit spreads by testing different spread widths
    const optimalSpreads = findOptimalCallCreditSpreads(
        filteredOptionsByPrice,
        currentPrice,
        symbol,
        expiryGroups,
        MIN_ANNUALIZED_ROI
    );

    resultArr = [...resultArr, ...optimalSpreads];
}

// Filter out rows with the same short strike but lower ROI
const bestROIByStrike = new Map<string, OptionAnalysisResult>();

resultArr.forEach(result => {
    const key = `${result.ticker}-${result.strikePrice}`;
    
    if (!bestROIByStrike.has(key) || bestROIByStrike.get(key)!.ROI < result.ROI) {
        bestROIByStrike.set(key, result);
    }
});

// Convert back to array and sort by annualized ROI
const filteredResults = Array.from(bestROIByStrike.values())
    .sort((a, b) => b.annualizedROI - a.annualizedROI);

// Print results in a formatted table
console.log("\nTicker | Current | Strike | Long Strike | Exp Date | D2Exp | Net Credit | Width % | ROI | Annual ROI");
console.log("-".repeat(100));

filteredResults.forEach(result => {
    console.log(
        `${result.ticker.padEnd(6)} | ` +
        `${result.currentPrice.toFixed(2).padEnd(7)} | ` +
        `${result.strikePrice.toFixed(2).padEnd(6)} | ` +
        `${(result.longStrike || 0).toFixed(2).padEnd(10)} | ` +
        `${result.expDateStr.padEnd(8)} | ` +
        `${result.daysToExpiration.toString().padEnd(5)} | ` +
        `${result.bid.toFixed(4).padEnd(9)} | ` +
        `${((result.spreadWidthPercent || 0) * 100).toFixed(1).padEnd(6)}% | ` +
        `${result.ROI.toFixed(2).padEnd(5)}% | ` +
        `${(result.annualizedROI || 0).toFixed(2)}%`
    );
});

console.log(`\nFound ${filteredResults.length} optimal credit spread opportunities after filtering for best ROI per strike price.`);
