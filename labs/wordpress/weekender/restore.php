<?php
// Restores only files from this lab's selected private source recovery point.
if (!defined('WP_CLI') || !WP_CLI || get_option('composer_weekender_fixture') !== '1') {
    WP_CLI::error('Select the restored fictional database in its new isolated source.');
}
$root = realpath(ABSPATH);
if (realpath(WP_CONTENT_DIR) !== $root . '/wp-content') {
    WP_CLI::error('The selected new source content directory changed.');
}
$listing = json_decode(file_get_contents('/evidence/restore/source-files.json'), true, 32, JSON_THROW_ON_ERROR);
if (($listing['fictional'] ?? false) !== true || ($listing['configurationContainsSecrets'] ?? false) !== true ||
    !isset($listing['files']) || count($listing['files']) > 10000) {
    WP_CLI::error('Select this lab source backup file manifest.');
}
$expected = [];
$total = 0;
foreach ($listing['files'] as $item) {
    $path = $item['path'] ?? '';
    if (!is_string($path) || strlen($path) > 512 || preg_match('~[\\\\\x00-\x1f]|(?:^|/)\.{1,2}(?:/|$)~', $path) ||
        !($path === 'wp-config.php' || $path === '.htaccess' || str_starts_with($path, 'wp-content/')) ||
        isset($expected[$path]) || !is_int($item['bytes'] ?? null) || $item['bytes'] < 0 ||
        !preg_match('/^[a-f0-9]{64}$/', $item['sha256'] ?? '')) {
        WP_CLI::error('A source recovery path or checksum is invalid.');
    }
    $total += $item['bytes'];
    $expected[$path] = $item;
}
if ($total > 128 * 1024 * 1024 || $total !== $listing['uncompressedBytes'] || count($expected) !== $listing['fileCount'] || !isset($expected['wp-config.php'])) {
    WP_CLI::error('The bounded source recovery manifest changed.');
}
$archivePath = '/evidence/restore/source-files.tar.gz';
$archive = new PharData($archivePath);
$seen = [];
foreach (new RecursiveIteratorIterator($archive) as $entry) {
    if ($entry->isLink() || !$entry->isFile()) {
        WP_CLI::error('A source recovery entry is not a regular file.');
    }
    $prefix = 'phar://' . $archivePath . '/';
    if (!str_starts_with($entry->getPathname(), $prefix)) {
        WP_CLI::error('A source recovery archive path changed.');
    }
    $relative = substr($entry->getPathname(), strlen($prefix));
    if (!isset($expected[$relative]) || isset($seen[$relative]) ||
        $entry->getSize() !== $expected[$relative]['bytes'] ||
        hash_file('sha256', $entry->getPathname()) !== $expected[$relative]['sha256']) {
        WP_CLI::error('A source recovery file differs from the selected backup.');
    }
    $seen[$relative] = true;
}
if (count($seen) !== count($expected)) {
    WP_CLI::error('A source recovery file is missing.');
}
// The caller has just created this volume and restored its fixture database.
// Validate the entire archive before touching this fresh source's files.
$existing = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(WP_CONTENT_DIR, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
foreach ($existing as $item) {
    if ($item->isLink()) {
        WP_CLI::error('An unexpected link exists in the new source; preserve it for inspection.');
    }
}
foreach ($existing as $item) {
    if ($item->isDir()) {
        rmdir($item->getPathname());
    } else {
        unlink($item->getPathname());
    }
}
$paths = array_values(array_filter(array_keys($expected), fn($path) => $path !== 'wp-config.php'));
if (!$archive->extractTo($root, $paths, true)) {
    WP_CLI::error('The source file restore did not finish.');
}
// The old wp-config.php remains in the private recovery artifact. The new
// source deliberately keeps its freshly generated local DB credentials/config.
foreach ($paths as $relative) {
    if (!is_file($root . '/' . $relative) || hash_file('sha256', $root . '/' . $relative) !== $expected[$relative]['sha256']) {
        WP_CLI::error('A restored source file failed its final checksum.');
    }
}
WP_CLI::line('Restored the selected source uploads, themes, plugins and rewrite configuration; fresh isolated DB wiring was retained.');
