const config = require('../config');
const fs = require('fs');
const _ = require('lodash');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const argv = require('yargs').argv;
const rimraf = require('rimraf');
const yaml = require('js-yaml');
const pascalCase = require('pascal-case').pascalCase;
const kebabCase = require('kebab-case');

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

function getBuildPath(langTarget) {
    return `${BUILD_DIR}/${langTarget}`;
}

async function processSpecs(meta, langTarget) {
    const processors = Object.keys(meta).map(async (file) => {
        const specMeta  = meta[file];
        const targetDir = `${getBuildPath(langTarget)}/src/${specMeta.packagePrefix}`;
        fs.mkdirSync(targetDir, { recursive: true });
        const options = {
            i: file,
            o: targetDir,
            g: langTarget,
            packageName: `"${config.targets[langTarget].packageName}${specMeta.packagePrefix}"`,
            invokerPackage: `"${config.targets[langTarget].packageName}${specMeta.packagePrefix}"`,
        };

        console.log(`Generating spec ${file}`);
        await runGenerator(options);
        console.log('Done generating');
    });

    return Promise.all(processors);
}

function gatherSpecs() {
    const files = fs.readdirSync(SPECS_DIR);
    const matcher = new RegExp('^(.*)\.ya?ml$', 'i');

    return files.filter(file => matcher.test(file))
        .filter(file => !(config.ignores.indexOf(file) >= 0))
        .map(file => `${SPECS_DIR}/${file}`);
}

async function cloneRepo(lang, repo) {
    const command = `git clone ${repo} ${BUILD_DIR}/${lang}`;
    const { stdout, stderr } = await exec(command);

    console.log(stdout);
}

async function runGenerator(options) {
    const optionsString = Object.keys(options).reduce((result, key) => {
        return `${result} ${key.length > 1 ? '--' : '-'}${kebabCase(key)} ${options[key]}`
    }, '');

    return exec(`./node_modules/.bin/openapi-generator generate ${optionsString}`);
}

async function getLastCommitMessage() {
    const { stdout } = await exec('git log -1 --pretty=%B');

    return stdout.trim();
}

async function commitChanges(commitMessage, lang) {
    console.log('Commit changes');
    const gitPath = getBuildPath(lang);

    return exec(`git -C ${gitPath} add . && git -C ${gitPath} commit -m "${commitMessage}"`);
}

async function pushRepo(lang) {
    return exec(`git -C ${getBuildPath(lang)} push`);
}

async function build() {
    const lastCommitMessage = await getLastCommitMessage();
    const specs = gatherSpecs();
    const meta = specs.reduce((obj, file) => {
        obj[file] = extractMeta(file);

        return obj;
    }, {});

    _.each(config.targets, async (targetConfig, lang) => {
        // clone repository
        await cloneRepo(lang, targetConfig.repo);

        // run generator into repository
        await processSpecs(meta, lang);

        if (targetConfig.hasOwnProperty('postProcessor')) {
            console.log(`Post processing for ${lang}`);
            require(`../src/${targetConfig.postProcessor}`)(targetConfig, meta);
        }

        // commit change
        const commitMessage = `SpecBuild: ${lastCommitMessage}`;
        console.log(`Commiting "${commitMessage}"`);
        await commitChanges(commitMessage, lang);
        pushRepo(lang);
    });
}

build();
