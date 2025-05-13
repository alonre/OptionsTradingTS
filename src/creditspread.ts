import {
    findOptimalCallCreditSpreads,
    calculateMaxStrikePrice,
    filterOptionsByStrikePrice,
    getOptionQuote,
    parseCreditSpreadParams,
    getUniqueExpiryGroups,
} from "./utils.js";
import chalk from 'chalk';
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

// Convert back to array and sort by ticker first, then by annualized ROI within each ticker group
const filteredResults = Array.from(bestROIByStrike.values())
    .sort((a, b) => {
        // First sort by ticker
        if (a.ticker !== b.ticker) {
            return a.ticker.localeCompare(b.ticker);
        }
        // Then by annualized ROI (highest first) within each ticker
        return b.annualizedROI - a.annualizedROI;
    });

// Group results by ticker
const resultsByTicker: { [key: string]: OptionAnalysisResult[] } = {};
filteredResults.forEach(result => {
    if (!resultsByTicker[result.ticker]) {
        resultsByTicker[result.ticker] = [];
    }
    resultsByTicker[result.ticker].push(result);
});

// Print results in a formatted table, grouped by ticker with alternating colors
console.log("\nOptimal Credit Spread Opportunities\n");

let totalOpportunities = 0;
let isFirstTicker = true;

Object.keys(resultsByTicker).forEach(ticker => {
    const results = resultsByTicker[ticker];
    totalOpportunities += results.length;
    
    // Add spacing between ticker groups except for the first one
    if (!isFirstTicker) {
        console.log();
    } else {
        isFirstTicker = false;
    }
    
    // Print ticker header with color
    console.log(chalk.bold.blue(`${ticker} (${results.length} opportunities)`));
    console.log(chalk.bold("Current | Strike | Long Strike | Exp Date | D2Exp | Net Credit | Width % | ROI | Annual ROI"));
    console.log(chalk.gray("-".repeat(100)));
    
    // Print results for this ticker
    results.forEach(result => {
        console.log(
            `${result.currentPrice.toFixed(2).padEnd(7)} | ` +
            `${result.strikePrice.toFixed(2).padEnd(6)} | ` +
            `${(result.longStrike || 0).toFixed(2).padEnd(10)} | ` +
            `${result.expDateStr.padEnd(8)} | ` +
            `${result.daysToExpiration.toString().padEnd(5)} | ` +
            `${chalk.green(result.bid.toFixed(4).padEnd(9))} | ` +
            `${((result.spreadWidthPercent || 0) * 100).toFixed(1).padEnd(6)}% | ` +
            `${chalk.yellow(result.ROI.toFixed(2) + '%').padEnd(6)} | ` +
            `${chalk.cyan((result.annualizedROI || 0).toFixed(2))}%`
        );
    });
});

console.log(`\nFound ${totalOpportunities} optimal credit spread opportunities across ${Object.keys(resultsByTicker).length} stocks.`);
