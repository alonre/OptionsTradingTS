import chalk from 'chalk';
import fs from "fs"

import {
  OptionChainResponse,
  OptionsChainQuote,
  OptionChainLink,
  OptionType,
  PutInputData, OptionAnalysisResult
} from './types';

const DAYS_IN_YEAR = 365;

/**
 * Calculates the Return on Investment (ROI) for an options trade.
 * @param optionPremium The premium you get for selling the option.
 * @param targetPrice The target price for the option.
 * @param daysToExp The number of days until the option expires.
 * @param leverage The leverage applied to the trade. Default is 0.1.
 * @param commission The commission fee for the trade. Default is 0.
 * @returns The ROI as a percentage.
 */
export const calculateOptionsROI = (
  optionPremium: number,
  targetPrice: number,
  daysToExp: number,
  leverage: number = 0.1,
  commission: number = 0
): number => {
  const cost: number = targetPrice * leverage + commission;
  const profit: number = optionPremium; 
  const timesInYear: number = DAYS_IN_YEAR / (daysToExp + 2);  // :todo why +2 ?
  const ROI: number = ((profit * timesInYear) / cost) * 100;
  return ROI;
}



/**
 * Calculates percentage change from current to target price.
 */
export const calculatePercentageChange = (targetPrice: number, currentPrice: number): number => {
    return ((targetPrice - currentPrice) / currentPrice) * 100;
  }


/**
 * Formats a number as a percentage and applies color coding based on the value's sign.
 * Positive values are green, and negative values are red.
 *
 * @param value The value to format.
 * @returns A string representing the formatted and color-coded value.
 */
const formatWithSignColor = (value: number): string => {
  const formattedValue = value.toFixed(3);
  return value > 0 ? chalk.green(formattedValue) : chalk.red(formattedValue);
};

/**
 * Prints stock options chain as a table with color-coded differences and ROIs for each option entry.
 */
export const printStockChains = (chain: OptionAnalysisResult[]): void => {
  // Header
  console.log(chalk.bold('Ticker  | Current  | Strike |  Exp Date  |  Bid  |   Diff   | ROI'));
  console.log('-'.repeat(80)); // Adjust the repeat count based on your console width

  // Rows
  chain.forEach(({ ticker, currentPrice, strikePrice, expDateStr, bid, percentageFromStrike, ROI }) => {
    const diffFormatted = formatWithSignColor(percentageFromStrike) + '%';
    const roiFormatted = formatWithSignColor(ROI) + '%';
    console.log(
        `${ticker.padEnd(7)} | ${currentPrice.toString().padEnd(8)} | ${strikePrice.toString().padEnd(6)} | ${expDateStr.padEnd(10)} | ${bid.toString().padEnd(5)} | ${diffFormatted.padEnd(8)} | ${roiFormatted}`
    );
  });
};

// export const printStockChains = (chain: OptionAnalysisResult[]): void => {
//   console.log(`\nname   current  strike   exp-date    bid    diff       roi \n_______________________________________________________________`);
//   chain.forEach(({ ticker, currentPrice, strikePrice, expDateStr, bid, percentageFromStrike, ROI }) => {
//     console.log(`${ticker} , ${currentPrice} , ${strikePrice} , ${expDateStr} , ${bid} , ${formatWithSignColor(percentageFromStrike)}%  , ${formatWithSignColor(ROI)}% `);
//   });
// };




/**
 * Converts a date string in the format "MonthName Day" (e.g., "Feb 25") to a Date object.
 * The function assumes the year based on whether the month has already occurred this year:
 * - If the month is the current month or has not yet occurred, it assumes the current year.
 * - If the month has already passed, it assumes the next year.
 * @param stringDate The date string to convert, format "MonthName Day" (e.g., "Feb 25").
 * @returns The Date object corresponding to the input string, with the time set to 00:00:00 UTC.
 */
export const convertStringToDate = (stringDate: string): Date => {
  const today = new Date();
  const currMonth = today.getMonth() + 1; // JavaScript's months are 0-indexed, added 1 for comparison
  const currYear = today.getFullYear();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const [monthName, dayStr] = stringDate.split(' ');
  const day = parseInt(dayStr);
  const month = monthNames.indexOf(monthName) + 1; // JavaScript's months are 0-indexed, added 1 to match human-readable format
  const year = month >= currMonth ? currYear : currYear + 1;

  const date = new Date(`${year}-${month}-${day}`);
  date.setUTCHours(0,0,0,0);
  return date;
}


/**
 * Parses parameters for put.txt options from a text file.
 * Each line in the file should contain a stock symbol and a maximum strike price, separated by a comma (e.g., "AAPL,70").
 *
 * @returns An array of objects, each with a 'symbol' (string) and 'maxStrikePrice' (string formatted as a fixed decimal to two places).
 */
export const parsePutParams = ():PutInputData[] => {
  const dataFromFile: string = fs.readFileSync(process.cwd() + `/data/put.txt`, "utf-8");
  const lines: string[] = dataFromFile.split("\n");
  const putInputData:PutInputData[] = lines.map(row => {
    const [symbol, price] = row.split(",");
    return {
      symbol: symbol,
      maxStrikePrice: parseFloat(price)
    };
  }).filter(stock => stock.maxStrikePrice && stock.symbol);

  return putInputData;
};

/**
 * Fetches option quotes for a given stock ticker.
 *
 * @param ticker The stock symbol.
 * @param maxExpDate The maximum expiration date for the options.
 * @param Optiontype The type of options to fetch (e.g., call or put.txt).
 * @returns A promise resolving to an array containing the rows of data and the current stock price.
 */
export const getOptionQuote = async (
    ticker: string,
    maxExpDate: string,
    Optiontype: string
): Promise<OptionsChainQuote> => {
  try {
    const todayStr: string = new Date().toISOString().split('T')[0];
    const url: string = `https://api.nasdaq.com/api/quote/${ticker}/option-chain?assetclass=stocks&fromdate=${todayStr}&todate=${maxExpDate}&excode=oprac&callput=${Optiontype}&money=out&type=all`;
    const rawResult = await fetch(url, {
      headers: {
        "accept-language": "*",
        "user-agent": "node",
      },
    });

    const res: OptionChainResponse = await rawResult.json();
    const rows = res.data?.table?.rows || [];
    const currentPrice = res.data?.lastTrade ? parseFloat(res.data.lastTrade.split('$')[1].split('(')[0].trim()) : 0;

    if (rows.length == 0)  throw new Error(`no results for ${ticker}!`);
    console.log(chalk.green(`current price for ${ticker} is ${currentPrice}, got ${rows.length} rows`));

    return { rows, currentPrice };
  } catch (e) {
    console.error(chalk.red(e));
    return { rows: [], currentPrice: 0 }; // Ensuring a consistent return type even in case of error
  }
};

/**
 * Calculates the maximum strike price based on an absolute value or a percentage of the current price.
 * If `maxPrice` is 1 or greater, it's treated as an absolute value. If it's less than 1, it's treated as a percentage of `currentPrice`.
 *
 * @param maxPrice The maximum price or percentage for the strike price.
 * @param currentPrice The current price of the stock.
 * @returns The calculated absolute maximum strike price.
 */
export const calculateMaxStrikePrice = (maxPrice: number, currentPrice: number): number => {
  if (maxPrice >= 1) return maxPrice; // Treat as absolute price
  return currentPrice * maxPrice; // Treat as percentage
}


/**
 * Filters a stock option chain based on option type and maximum strike price, including only options with bid values.
 *
 * @param stockChain An array of stock option chain rows.
 * @param Optiontype The type of options to filter by ("put" or "call").
 * @param maxStrikePrice The maximum strike price for filtering options.
 * @returns An array of stock chain rows filtered by the specified criteria.
 */
export const filterOptionsByStrikePrice = (
    optionsChain: OptionChainLink[],
    maxStrikePrice: string | number,
    Optiontype: OptionType
): OptionChainLink[] => {
  return optionsChain.filter((row) =>
      Optiontype === "put" ?
          (parseFloat(row.strike) < parseFloat(maxStrikePrice.toString())) && (row.p_Bid !== '--') :
          (parseFloat(row.strike) > parseFloat(maxStrikePrice.toString())) && (row.c_Bid !== '--')
  );
}

/**
 * Analyzes and sorts put options from a given options chain based on their Return on Investment (ROI).
 * It calculates the ROI for each option based on its bid price, strike price, and days until expiration.
 * The function then sorts the options in descending order of ROI.
 *
 * @param chain An array of OptionChainLink objects representing the options chain. Each object must include
 *              a bid price (`p_Bid`), a strike price (`strike`), and an expiry date (`expiryDate`).
 * @param currentPrice The current price of the underlying stock, used to calculate the percentage from strike.
 * @param ticker The ticker symbol of the stock, included in the result for identification.
 *
 * @returns An array of OptionAnalysisResult objects, each containing the ticker symbol, current stock price,
 *          option strike price, option expiration date as a string (`expDateStr`), bid price, the percentage
 *          difference from the strike price to the current price (`percentageFromStrike`), and the calculated ROI.
 *          The array is sorted by ROI in descending order.
 */

export const evaluatePutOptionsPerformance = (
    chain: OptionChainLink[],
    currentPrice: number,
    ticker: string
): OptionAnalysisResult[] => {
  const millisecondsInDay = 24 * 3600 * 1000;
  const today = new Date();

  const results = chain.map(chainLink => {
    const optionPremiumBid = parseFloat(chainLink.p_Bid);
    const strikePrice = parseFloat(chainLink.strike);
    const expDate = convertStringToDate(chainLink.expiryDate);
    const expDateStr = expDate.toISOString().split('T')[0];
    const daysToExpiration = Math.ceil((expDate.getTime() - today.getTime()) / millisecondsInDay);
    const percentageFromStrike = calculatePercentageChange(strikePrice, currentPrice);
    const ROI = calculateOptionsROI(optionPremiumBid, strikePrice, daysToExpiration);
    return {
      ticker,
      currentPrice,
      strikePrice,
      expDateStr,
      expDate,
      bid: optionPremiumBid,
      percentageFromStrike,
      ROI
    };
  })
  return results;
};


/**
 * Filters and returns a subset of put options considered as "cherries".
 * A "cherry" is defined as a put option that has the same expiration date as the previous option in the list,
 * a smaller absolute percentage from strike, and a higher bid value than the previous option.
 *
 * @param putOptions Array of put option objects to be filtered.
 * @returns An array of put options that meet the "cherry" criteria.
 */
export const filterCherries = (putOptions: OptionAnalysisResult[]): OptionAnalysisResult[] => {
  return putOptions.filter((option, idx) => {
    if (idx === 0) return false; // Skip the first element as it can't be compared with a previous one.

    const { expDate, percentageFromStrike, bid } = option;
    const previousOption = putOptions[idx - 1];

    return (
        expDate === previousOption.expDate &&
        Math.abs(percentageFromStrike) < Math.abs(previousOption.percentageFromStrike) &&
        bid > previousOption.bid
    );
  });
};
