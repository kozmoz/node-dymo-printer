import {DymoServices} from 'node-dymo-printer';

/**
 * Print a list of all printers found.
 */
const result = await new DymoServices().listPrinters();
console.log('Found these printers: ' + JSON.stringify(result, null, 2));

