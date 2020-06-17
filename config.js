module.exports = {
    ignores: [
        'billing_service.yml',
    ],
    targets: {
        php: {
            repo: 'git@github.com:Zingle/php-sdk.git',
            brach: 'next',
            packageName: 'ZingleSdk\\\\\\',
            postProcessor: 'php_post_processor',
        },
    }
};
