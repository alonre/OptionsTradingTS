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
 * Calculates the strike price threshold based on a percentage of the current price or an absolute value.
 * For values >= 1, the function treats them as a percentage multiplier of the current price (e.g., 1.4 means 140% of current price).
 * For values < 1, the function treats them as a direct percentage of the current price (e.g., 0.7 means 70% of current price).
 *
 * @param priceMultiplier The price multiplier or percentage for the strike price.
 * @param currentPrice The current price of the stock.
 * @returns The calculated strike price threshold.
 */
export const calculateMaxStrikePrice = (priceMultiplier: number, currentPrice: number): number => {
  if (priceMultiplier >= 1) return currentPrice * priceMultiplier; // Treat as percentage multiplier (e.g., 1.4 = 140%)
  return currentPrice * priceMultiplier; // Treat as direct percentage (e.g., 0.7 = 70%)
}


/**
 * Filters a stock option chain based on option type and strike price threshold, including only options with bid values.
 *
 * @param stockChain An array of stock option chain rows.
 * @param Optiontype The type of options to filter by ("put" or "call").
 * @param strikeThreshold For puts: the maximum strike price; For calls: the minimum strike price.
 * @returns An array of stock chain rows filtered by the specified criteria.
 */
export const filterOptionsByStrikePrice = (
    optionsChain: OptionChainLink[],
    strikeThreshold: string | number,
    Optiontype: OptionType
): OptionChainLink[] => {
  const thresholdValue = typeof strikeThreshold === 'string' ? 
    safeParseFloat(strikeThreshold) : strikeThreshold;
    
  return optionsChain.filter((row: OptionChainLink) => {
    if (!row.strike) return false;
    
    const strikeValue = safeParseFloat(row.strike);
    
    return Optiontype === "put" ?
      // For puts: filter strikes below the threshold (which is the max strike price)
      (strikeValue < thresholdValue) && (row.p_Bid !== '--') :
      // For calls: filter strikes above the threshold (which is the min strike price)
      (strikeValue > thresholdValue) && (row.c_Bid !== '--');
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
  const MIN_ANN_ROI_PERCENTAGE = 15; // Minimum ROI threshold

  const results = chain.map(chainLink => {
    const optionPremiumBid = safeParseFloat(chainLink.p_Bid);
    const strikePrice = safeParseFloat(chainLink.strike);
    const expDate = new Date(findExpiryGroupStartingWith(chainLink.expiryDate, expiryGroups));
    const expDateStr = expDate.toISOString().split('T')[0];
    const daysToExpiration = daysUntil(expDate);
    const daysToCollateralRelease = daysToExpiration + 2; // Add settlement days
    const percentageFromStrike = calculatePercentageChange(strikePrice, currentPrice);
    // Calculate effective ROI (premium / strike price) as a percentage
    const ROI = (optionPremiumBid / strikePrice) * 100;
    
    // Calculate annualized ROI with compounding (same as credit spread)
    const roiDecimal = optionPremiumBid / strikePrice;
    const annualizedROI = (Math.pow(1 + roiDecimal, 365 / daysToCollateralRelease) - 1) * 100;
    
    return {
      ticker,
      currentPrice,
      strikePrice,
      expDateStr,
      expDate,
      daysToExpiration,
      bid: optionPremiumBid,
      percentageFromStrike,
      ROI,
      annualizedROI
    };
  }).filter(result => result.annualizedROI >= MIN_ANN_ROI_PERCENTAGE); // Filter out options with less than minimum ROI

  return results;
};

/**
 * Filters and returns a subset of put options considered as "cherries".
 * A "cherry" is defined as a put option that has a higher bid value than the previous option
 * with the same expiration date, while also having a smaller absolute percentage from strike.
 *
 * @param putOptions Array of put option objects to be filtered.
 * @returns An array of put options that meet the "cherry" criteria.
 */
export const filterCherries = (putOptions: OptionAnalysisResult[]): OptionAnalysisResult[] => {
  // First, sort options by expiration date string and then by strike price
  const sortedOptions = [...putOptions].sort((a, b) => {
    if (a.expDateStr === b.expDateStr) {
      return a.strikePrice - b.strikePrice;
    }
    return a.expDateStr.localeCompare(b.expDateStr);
  });

  const cherries: OptionAnalysisResult[] = [];
  let currentExpGroup: OptionAnalysisResult[] = [];
  let currentExpDateStr: string | null = null;

  // Group by expiration date string
  for (const option of sortedOptions) {
    if (option.expDateStr !== currentExpDateStr) {
      // Process previous group if exists
      if (currentExpGroup.length > 0) {
        // Find cherries in this expiration group
        for (let i = 1; i < currentExpGroup.length; i++) {
          const curr = currentExpGroup[i];
          const prev = currentExpGroup[i - 1];
          
          if (Math.abs(curr.percentageFromStrike) < Math.abs(prev.percentageFromStrike) &&
              curr.bid > prev.bid) {
            cherries.push(curr);
          }
        }
      }
      // Start new group
      currentExpDateStr = option.expDateStr;
      currentExpGroup = [option];
    } else {
      currentExpGroup.push(option);
    }
  }

  // Process the last group
  if (currentExpGroup.length > 0) {
    for (let i = 1; i < currentExpGroup.length; i++) {
      const curr = currentExpGroup[i];
      const prev = currentExpGroup[i - 1];
      
      if (Math.abs(curr.percentageFromStrike) < Math.abs(prev.percentageFromStrike) &&
          curr.bid > prev.bid) {
        cherries.push(curr);
      }
    }
  }

  return cherries;
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
 * Parses parameters for credit spread options from a text file.
 * Each line in the file should contain a stock symbol and a minimum strike price, separated by a comma.
 * (e.g., "AAPL,1.2" where 1.2 means 120% of current price)
 * 
 * @returns An array of objects, each with a 'symbol' (string) and 'minStrikePrice' (number).
 */
export const parseCreditSpreadParams = (): { symbol: string, minStrikePrice: number }[] => {
  try {
    const data = fs.readFileSync('./data/creditspread.txt', 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    return lines.map(line => {
      const [symbol, minStrikePrice] = line.split(',');
      return {
        symbol,
        minStrikePrice: parseFloat(minStrikePrice)
      };
    });
  } catch (error) {
    console.error('Error reading credit spread parameters:', error);
    return [];
  }
};

/**
 * Evaluates the performance of call credit spread options from a given options chain.
 * A call credit spread involves selling a call option at a lower strike price and buying a call option
 * at a higher strike price with the same expiration date.
 *
 * @param chain The options chain to analyze.
 * @param currentPrice The current price of the underlying stock.
 * @param ticker The stock ticker symbol.
 * @param expiryGroups The available expiration date groups.
 * @param spreadWidthPercent The percentage width between the short and long options (e.g., 0.05 for 5%).
 * @param minAnnualizedROI The minimum annualized ROI threshold (as a percentage).
 * @returns An array of analyzed credit spread options.
 */
export const evaluateCallCreditSpreadPerformance = (
  chain: OptionChainLink[],
  currentPrice: number,
  ticker: string,
  expiryGroups: string[],
  spreadWidthPercent: number,
  minAnnualizedROI: number = 15
): OptionAnalysisResult[] => {
  const results: OptionAnalysisResult[] = [];
  
  // Group options by expiration date
  const optionsByExpiry: { [key: string]: OptionChainLink[] } = {};
  
  chain.forEach(option => {
    const expDateStr = option.expiryDate || '';
    if (!optionsByExpiry[expDateStr]) {
      optionsByExpiry[expDateStr] = [];
    }
    optionsByExpiry[expDateStr].push(option);
  });
  
  // Process each expiration date group
  Object.entries(optionsByExpiry).forEach(([expDateStr, options]) => {
    // Sort options by strike price (ascending)
    const sortedOptions = [...options].sort((a, b) => {
      const strikeA = safeParseFloat(a.strike || '0');
      const strikeB = safeParseFloat(b.strike || '0');
      return strikeA - strikeB;
    });
    
    // For each option, find a suitable long option to create a spread
    for (let i = 0; i < sortedOptions.length - 1; i++) {
      const shortOption = sortedOptions[i];
      const shortStrike = safeParseFloat(shortOption.strike || '0');
      const shortBid = safeParseFloat(shortOption.c_Bid || '0'); // Use c_Bid for call options
      
      if (shortBid <= 0) continue; // Skip if no bid for short option
      
      // Convert expiration date string to Date object
      const expDate = convertStringToDate(expDateStr);
      
      // Calculate days to expiration
      const daysToExpiration = daysUntil(expDate);
      
      // Calculate percentage from strike for the short option
      const percentageFromStrike = calculatePercentageChange(shortStrike, currentPrice);
      
      // Calculate the target strike price for the long option (higher than short strike)
      const targetLongStrike = shortStrike * (1 + spreadWidthPercent);
      
      // Find the closest strike price that is greater than or equal to the target
      let longOption = null;
      for (let j = i + 1; j < sortedOptions.length; j++) {
        const potentialLongOption = sortedOptions[j];
        const potentialLongStrike = safeParseFloat(potentialLongOption.strike || '0');
        
        if (potentialLongStrike >= targetLongStrike) {
          longOption = potentialLongOption;
          break;
        }
      }
      
      if (!longOption) continue; // Skip if no suitable long option found
      
      const longStrike = safeParseFloat(longOption.strike || '0');
      // Use actual ask price from API if available, otherwise fall back to a reasonable estimate
      const longAsk = safeParseFloat(longOption.c_Ask || '0') || safeParseFloat(longOption.c_Bid || '0') * 1.1;
      
      if (longAsk <= 0) continue; // Skip if no valid ask for long option
      
      // Calculate net credit received (short bid - long ask)
      const netCredit = shortBid - longAsk;
      
      if (netCredit <= 0) continue; // Skip if no net credit (unprofitable spread)
      
      // Calculate max risk (difference between strikes - net credit)
      const maxRisk = longStrike - shortStrike - netCredit;
      
      if (maxRisk <= 0) continue; // Skip if no risk (unlikely but possible)
      
      // Calculate ROI (net credit / max risk)
      const roi = (netCredit / maxRisk) * 100;
      
      // Calculate annualized ROI using compound interest formula
      // Formula: (1 + r)^(365/t) - 1, where r is the ROI as a decimal and t is days to expiration
      const roiDecimal = roi / 100; // Convert percentage to decimal
      const daysToCollateralRelease = daysToExpiration + 2;
      const annualizedROI = (Math.pow(1 + roiDecimal, 365 / daysToCollateralRelease) - 1) * 100;
      
      // Skip if annualized ROI is below threshold
      if (annualizedROI < minAnnualizedROI) continue;
      
      results.push({
        ticker,
        currentPrice,
        strikePrice: shortStrike, // Use short strike as the main strike price
        expDateStr,
        expDate,
        daysToExpiration,
        bid: netCredit, // Use net credit as the bid
        percentageFromStrike,
        ROI: roi,
        annualizedROI,
        spreadWidthPercent,
        longStrike
      });
    }
  });
  
  return results;
};

/**
 * Tests multiple spread widths for call credit spreads and returns the optimal results.
 *
 * @param chain The options chain to analyze.
 * @param currentPrice The current price of the underlying stock.
 * @param ticker The stock ticker symbol.
 * @param expiryGroups The available expiration date groups.
 * @param minAnnualizedROI The minimum annualized ROI threshold (as a percentage).
 * @returns An array of analyzed credit spread options with optimal spread widths, sorted by ROI.
 */
export const findOptimalCallCreditSpreads = (
  chain: OptionChainLink[],
  currentPrice: number,
  ticker: string,
  expiryGroups: string[],
  minAnnualizedROI: number = 15
): OptionAnalysisResult[] => {
  // Test different spread widths
  const spreadWidths = [0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15, 0.20];
  let allResults: OptionAnalysisResult[] = [];
  
  // Evaluate each spread width
  spreadWidths.forEach(spreadWidth => {
    const results = evaluateCallCreditSpreadPerformance(
      chain,
      currentPrice,
      ticker,
      expiryGroups,
      spreadWidth,
      minAnnualizedROI
    );
    
    allResults = [...allResults, ...results];
  });
  
  // Deduplicate results by keeping only the best result (highest annualized ROI)
  // for each unique combination of ticker, strike price, and expiration date
  const uniqueResults = new Map<string, OptionAnalysisResult>();
  
  allResults.forEach(result => {
    const key = `${result.ticker}-${result.strikePrice}-${result.expDateStr}`;
    
    if (!uniqueResults.has(key) || uniqueResults.get(key)!.annualizedROI < result.annualizedROI) {
      uniqueResults.set(key, result);
    }
  });
  
  // Sort by annualized ROI (highest first)
  return Array.from(uniqueResults.values()).sort((a, b) => b.annualizedROI - a.annualizedROI);
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