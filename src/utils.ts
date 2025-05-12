import chalk from 'chalk';
import fs from "fs"
import { toZonedTime } from 'date-fns-tz';

import {
  OptionChainResponse,
  OptionsChainQuote,
  OptionChainLink,
  OptionType,
  PutInputData, OptionAnalysisResult
} from './types';

/**
 * Safely parses a string that might contain commas as a float.
 * @param value The string to parse.
 * @returns The parsed float value.
 */
const safeParseFloat = (value: string): number => {
  if (!value || value === '--') return 0;
  return parseFloat(value.replace(/,/g, ''));
};

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
  leverage: number = 1,
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
  console.log(chalk.bold('Ticker  | Current  | Strike |  Exp Date  | D2Exp |  Bid  |   Diff   | ROI (Yearly)'));
  console.log('-'.repeat(80)); // Adjust the repeat count based on your console width

  // Rows
  chain.forEach(({ ticker, currentPrice, strikePrice, expDateStr, daysToExpiration, bid, percentageFromStrike, ROI }) => {
    const diffFormatted = formatWithSignColor(percentageFromStrike) + '%';
    const roiFormatted = formatWithSignColor(ROI) + '%';
    console.log(
        `${ticker.padEnd(7)} | ${currentPrice.toString().padEnd(8)} | ${strikePrice.toString().padEnd(6)} | ${expDateStr.padEnd(10)} | ${daysToExpiration.toString().padEnd(5)} | ${bid.toString().padEnd(5)} | ${diffFormatted.padEnd(8)} | ${roiFormatted}`
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
    console.log(chalk.green(`Fetching options for ${ticker} at ${url}...`));
    const rawResult = await fetch(url, {
      headers: {
        "accept-language": "*",
        "user-agent": "node",
      },
    });

    const res: OptionChainResponse = await rawResult.json();
    const rows = res.data?.table?.rows || [];
    const currentPrice = res.data?.lastTrade ? safeParseFloat(res.data.lastTrade.split('$')[1].split('(')[0].trim()) : 0;

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
  const maxStrikePriceValue = typeof maxStrikePrice === 'string' ? 
    safeParseFloat(maxStrikePrice) : maxStrikePrice;
    
  return optionsChain.filter((row) => {
    if (!row.strike) return false;
    
    const strikeValue = safeParseFloat(row.strike);
    
    return Optiontype === "put" ?
      (strikeValue < maxStrikePriceValue) && (row.p_Bid !== '--') :
      (strikeValue > maxStrikePriceValue) && (row.c_Bid !== '--');
  });
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
    ticker: string,
    expiryGroups: string[]
): OptionAnalysisResult[] => {
  const MIN_ROI_PERCENTAGE = 15; // Minimum ROI threshold

  const results = chain.map(chainLink => {
    const optionPremiumBid = safeParseFloat(chainLink.p_Bid);
    const strikePrice = safeParseFloat(chainLink.strike);
    const expDate = new Date(findExpiryGroupStartingWith(chainLink.expiryDate, expiryGroups));
    const expDateStr = expDate.toISOString().split('T')[0];
    const daysToExpiration = daysUntil(expDate);
    const percentageFromStrike = calculatePercentageChange(strikePrice, currentPrice);
    // const ROI = calculateOptionsROI(optionPremiumBid, strikePrice, daysToExpiration);
    const ROI = calculateAPY(strikePrice, optionPremiumBid, daysToExpiration);
    
    return {
      ticker,
      currentPrice,
      strikePrice,
      expDateStr,
      expDate,
      daysToExpiration,
      bid: optionPremiumBid,
      percentageFromStrike,
      ROI
    };
  }).filter(result => result.ROI >= MIN_ROI_PERCENTAGE); // Filter out options with less than minimum ROI

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


/**
 * Returns a unique list of expiration dates from an options chain.
 *
 * @param optionsChain The options chain to analyze.
 * @returns An array of unique expiration dates, excluding empty strings and null values.
 */
export const getUniqueExpiryGroups = (optionsChain: OptionChainLink[]): string[] => {
  const expiryGroups = optionsChain
    .map(option => option.expirygroup) // Assuming 'expirygroup' is a property of OptionChainLink
    .filter(expiry => expiry && expiry.trim() !== ''); // Filter out empty strings

  return Array.from(new Set(expiryGroups)); // Return unique values
};

/**
 * Finds the first expiry group that starts with the given date string.
 *
 * @param dateStr The date string to search for.
 * @param expiryGroups The list of expiry groups to search in.
 * @returns The first expiry group that starts with the given date string, or undefined if not found.
 */
export const findExpiryGroupStartingWith = (dateStr: string, expiryGroups: string[]): string | undefined => {
  const monthMap: { [key: string]: string } = {
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    May: 'May',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December',
  };

  // Split the dateStr to get the month and day
  const [shortMonth, dayNum] = dateStr.split(' ');
  const longMonth = monthMap[shortMonth]; // Convert to long month name

  if (!longMonth) return undefined; // Return undefined if month is invalid

  const formattedDateStr = `${longMonth} ${dayNum}`; // Create the formatted string

  return expiryGroups.find(expiry => expiry.startsWith(formattedDateStr));
};

/**
 * Calculates the number of days until the given date.
 *
 * @param date The date to calculate the days until.
 * @returns The number of days until the given date, normalized to NYC timezone.
 */
export const daysUntil = (date: Date): number => {
  const millisecondsInADay = 24 * 60 * 60 * 1000; // Number of milliseconds in a day
  const nycTimeZone = 'America/New_York';
  
  // Convert both dates to NYC timezone for consistent calculation
  const nycDate = toZonedTime(date, nycTimeZone);
  const nycNow = toZonedTime(new Date(), nycTimeZone);
  
  // Calculate the difference in days
  const differenceInMilliseconds = nycDate.getTime() - nycNow.getTime();
  const days = Math.ceil(differenceInMilliseconds / millisecondsInADay);
  
  // Return at least 1 day for same-day or past expirations to avoid the error
  return Math.max(1, days);
};

/**
 * Calculates the Annualized Percentage Yield (APY) for a given strike price, option premium, and days to expiration.
 *
 * @param strikePrice The strike price of the option.
 * @param optionPremium The premium you get for selling the option.
 * @param daysToExpiration The number of days until the option expires.
 * @returns The Annualized Percentage Yield (APY) as a percentage.
 */
export const calculateAPY = (strikePrice: number, optionPremium: number, daysToExpiration: number): number => {
  if (daysToExpiration <= 0) {
    throw new Error("Days to expiration must be greater than zero.");
  }
  
  const gain = optionPremium / strikePrice; // Calculate gain as absolute percentage
  const apy = (gain / daysToExpiration) * DAYS_IN_YEAR; // Normalize to yearly interest value
  
  return apy * 100;
};