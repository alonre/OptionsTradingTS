import chalk from 'chalk';
import {
    evaluatePutOptionsPerformance,
    calculateMaxStrikePrice,
    filterOptionsByStrikePrice,
    getOptionQuote,
    parsePutParams, filterCherries,
    getUniqueExpiryGroups,
} from "./utils.js";
import {OptionAnalysisResult} from "./types";

//Don't show me options with exp date the is more than X days from today
const MAX_DAYS_TO_EXP = 450
const CHEERIES_ONLY = true

console.log('Script is running 🚀🚀🚀')
const stocksInputData = parsePutParams();

const maxExpDate = new Date(Date.now() + MAX_DAYS_TO_EXP * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

// Group results by ticker
const resultsByTicker: { [key: string]: OptionAnalysisResult[] } = {};

for(const stockInputRow of stocksInputData ) {
    const {symbol, maxStrikePrice} = stockInputRow;
    const {rows: stockOptionsChain, currentPrice} = await getOptionQuote(symbol, maxExpDate, "put");
    const expiryGroups = getUniqueExpiryGroups(stockOptionsChain);

    const absoluteMaxStrikePrice = calculateMaxStrikePrice(maxStrikePrice, currentPrice);
    const filteredOptionsByPrice = filterOptionsByStrikePrice(stockOptionsChain, absoluteMaxStrikePrice, "put");
    let putOptionPerformance = evaluatePutOptionsPerformance(filteredOptionsByPrice, currentPrice, symbol, expiryGroups);

    // Optionally filter for cherries and then sort
    putOptionPerformance = (CHEERIES_ONLY ? filterCherries(putOptionPerformance) : putOptionPerformance)
        .sort((a, b) => b.annualizedROI - a.annualizedROI);

    // Group by ticker
    if (!resultsByTicker[symbol]) {
        resultsByTicker[symbol] = [];
    }
    resultsByTicker[symbol].push(...putOptionPerformance);
}

// Print results in a formatted table, grouped by ticker
console.log("\nPut Options Analysis\n");

let totalOpportunities = 0;
let isFirstTicker = true;

Object.keys(resultsByTicker).forEach(ticker => {
    const results = resultsByTicker[ticker];
    if (results.length === 0) return;
    
    totalOpportunities += results.length;
    
    // Add spacing between ticker groups except for the first one
    if (!isFirstTicker) {
        console.log();
    } else {
        isFirstTicker = false;
    }
    
    // Print ticker header with color
    console.log(chalk.bold.blue(`${ticker} (${results.length} opportunities)`));
    console.log(chalk.bold("Current | Strike |  Exp Date  | D2Exp |  Bid   |   Diff   |  ROI   | Annual ROI"));
    console.log(chalk.gray("-".repeat(80)));
    
    // Print each option for this ticker
    results.forEach(result => {
        console.log(
            `${result.currentPrice.toFixed(2).padEnd(7)} | ` +
            `${result.strikePrice.toFixed(2).padEnd(6)} | ` +
            `${result.expDateStr.padEnd(10)} | ` +
            `${result.daysToExpiration.toString().padStart(5)} | ` +
            `${chalk.green(result.bid.toFixed(2).padStart(6))} | ` +
            `${chalk.magenta((result.percentageFromStrike.toFixed(1) + '%').padStart(8))} | ` +
            `${chalk.yellow(result.ROI.toFixed(2) + '%').padEnd(6)} | ` +
            `${chalk.cyan((result.annualizedROI || 0).toFixed(2))}%`
        );
    });
});

console.log(`\nFound ${totalOpportunities} put options across ${Object.keys(resultsByTicker).length} stocks.`);
