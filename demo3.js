const DymoServices = require('./src/dymo-services');

/**
 * Print a list of all printers found.
 */

new DymoServices().listPrinters()
    .then(result => console.log('Found these printers: ' + JSON.stringify(result, null, 2)))
    .catch(error => console.error('Error: ' + error));

