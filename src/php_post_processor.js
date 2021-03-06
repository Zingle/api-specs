const fs = require('fs');

module.exports = function (config, meta) {
    const composerTpl = JSON.parse(fs.readFileSync('./assets/php/composer.json'));


    Object.values(meta).forEach(specMeta => {
        const namespace = `ZingleSdk\\${specMeta.packagePrefix}\\`;

        composerTpl.autoload['psr-4'][namespace] = `src/${specMeta.packagePrefix}/lib/`;
    });

    fs.writeFileSync('./build/php/composer.json', JSON.stringify(composerTpl, null, 4));
};
