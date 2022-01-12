const Jimp = require('jimp');
const {DymoServices, convertImageToBitmap} = require('node-dymo-printer');

/**
 * Try to find the DYMO LabelWriter and print given image (image is sized for a 89mm x 36mm label).
 */

(async function () {

    const dymoServices = new DymoServices();

    // Load image to be printed.
    const image = await Jimp.read(__dirname + '/demo4.png');

    // Rotate image for label writer. Needs to be in portrait mode for printing.
    image.rotate(-90, true);
    const bitmap = await convertImageToBitmap(image);

    await dymoServices.print(bitmap);
    console.log('Successfully printed');

})();
