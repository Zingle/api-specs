const projectMap = require('../project-map');
const fs = require('fs');
const _ = require('lodash');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const argv = require('yargs').argv;
const rimraf = require('rimraf');
const yaml = require('js-yaml');
const pascalCase = require('pascal-case').pascalCase;

const BUILD_DIR = './build';
const SPECS_DIR = './specs';

if (argv.clean) {
    console.log(`Deleting ${BUILD_DIR}`);
    rimraf.sync(BUILD_DIR);
}

if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR);
}

function extractMeta(filePath) {
    const data = yaml.safeLoad(fs.readFileSync(filePath));

    return {
        packagePrefix: pascalCase(data.info.title),
    };
}

function processSpecs(specFiles, langTarget) {
    specFiles.forEach(async file => {
        const command = `./node_modules/.bin/openapi-generator generate -i ${file} -o ./build/${langTarget} -g ${langTarget}`;
        console.log(`Generating spec ${file}`);
        await exec(command);
    });
}

function gatherSpecs() {
    const files = fs.readdirSync(SPECS_DIR);
    const matcher = new RegExp('^(.*)\.ya?ml$', 'i');

    return files.filter(file => matcher.test(file))
        .filter(file => !(projectMap.ignores.indexOf(file) >= 0))
        .map(file => `${SPECS_DIR}/${file}`);
}

async function cloneRepo(lang, repo) {
    const command = `git clone ${repo} ${BUILD_DIR}/${lang}`;
    const { stdout, stderr } = await exec(command);

    console.log(stdout);
}

async function runGenerator(lang) {
    const command = `./node_modules/.bin/openapi-generator`;
}

const specs = gatherSpecs();
console.log(specs);
const meta = specs.reduce((obj, file) => {
    obj[file] = extractMeta(file);

    return obj;
}, {});
_.each(projectMap.targets, (map, lang) => {
    // clone repository
    cloneRepo(lang, map.repo);

    // run generator into repository
    processSpecs(specs, lang);
    // commit change
    // push it back
});
