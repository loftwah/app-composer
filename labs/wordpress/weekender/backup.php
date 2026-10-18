<?php
// Actual source file backup; the separate wp db export supplies the database.
if (!defined('WP_CLI') || !WP_CLI || get_option('composer_weekender_fixture') !== '1') {
    WP_CLI::error('Select the registered fictional WordPress source.');
}
if (!file_exists(ABSPATH . '.maintenance')) {
    WP_CLI::error('Quiesce this source before taking its recovery point.');
}
$destination = '/evidence/source-files.tar';
if (file_exists($destination) || file_exists($destination . '.gz')) {
    WP_CLI::error('A source backup is never overwritten.');
}
$archive = new PharData($destination);
$files = [];
$totalBytes = 0;
$root = realpath(ABSPATH);
$paths = ['wp-config.php', '.htaccess'];
$content = realpath(WP_CONTENT_DIR);
if ($content !== $root . '/wp-content') {
    WP_CLI::error('The fictional source content directory changed.');
}
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($content, FilesystemIterator::SKIP_DOTS));
foreach ($iterator as $item) {
    if ($item->isLink()) {
        WP_CLI::error('A source file is a symbolic link; review it before backup.');
    }
    if ($item->isFile()) {
        $paths[] = substr($item->getPathname(), strlen($root) + 1);
    }
}
sort($paths, SORT_STRING);
foreach ($paths as $relative) {
    $path = $root . '/' . $relative;
    if ($relative === '.htaccess' && !file_exists($path)) {
        continue;
    }
    if (is_link($path) || !is_file($path) || realpath($path) !== $path) {
        WP_CLI::error('A source backup path is absent or changed.');
    }
    $size = filesize($path);
    $totalBytes += $size;
    if (count($files) >= 10000 || $totalBytes > 128 * 1024 * 1024) {
        WP_CLI::error('The fictional source backup exceeds its reviewed bound.');
    }
    $archive->addFile($path, $relative);
    $files[] = ['path' => $relative, 'bytes' => $size, 'sha256' => hash_file('sha256', $path)];
}
$archive->compress(Phar::GZ);
unset($archive);
unlink($destination);
chmod($destination . '.gz', 0600);
file_put_contents('/evidence/source-files.json', json_encode([
    'fictional' => true,
    'configurationContainsSecrets' => true,
    'fileCount' => count($files), 'uncompressedBytes' => $totalBytes,
    'files' => $files,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
chmod('/evidence/source-files.json', 0600);
WP_CLI::line('Created the private source files backup; no configuration values are printed.');
