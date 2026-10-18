<?php
// MIT. Bounded source-side variant; never creates destination content or executes imported data.
if (get_option('composer_weekender_fixture') !== '1' || get_option('composer_weekender_scenario') !== 'publisher' || get_option('blogname') !== 'Macedon Weekender — fictional lab') {
    WP_CLI::error('Select the registered fictional publisher source.');
}
if (count($args ?? []) !== 1 || !in_array($args[0], ['check', 'apply'], true)) {
    WP_CLI::error('Select the explicit Classic check or apply step.');
}
$selected = ['functions.php', 'header.php', 'index.php', 'footer.php', 'style.css', 'assets/fonts/Literata72pt-Regular.woff2', 'assets/fonts/OFL-Literata.txt'];
$source = '/fixture/classic-theme';
$target = WP_CONTENT_DIR . '/themes/macedon-weekender-classic-lab';
$expected = [];
foreach ($selected as $name) {
    if (is_link($source . '/' . $name) || !is_file($source . '/' . $name)) WP_CLI::error('A maintained Classic theme input changed.');
    $expected[$name] = hash_file('sha256', $source . '/' . $name);
}
if (file_exists($target)) {
    if (is_link($target) || !is_dir($target)) WP_CLI::error('Existing Classic theme ownership changed; it was preserved.');
    $actual = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($target, FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->isLink() || !$file->isFile()) WP_CLI::error('Existing Classic theme ownership changed; it was preserved.');
        $name = substr($file->getPathname(), strlen($target) + 1);
        $actual[$name] = hash_file('sha256', $file->getPathname());
    }
    ksort($actual); ksort($expected);
    if ($actual !== $expected) WP_CLI::error('Existing Classic theme bytes differ; source edits were preserved.');
}
if ($args[0] === 'check') { WP_CLI::line('Fictional Classic preflight passed.'); return; }
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$plugin = get_plugin_data(WP_PLUGIN_DIR . '/classic-editor/classic-editor.php', false, false);
if (!is_plugin_active('classic-editor/classic-editor.php') || ($plugin['Version'] ?? '') !== '1.7.0') WP_CLI::error('Select the reviewed active Classic Editor.');
if (!file_exists($target)) {
    foreach ($selected as $name) {
        wp_mkdir_p(dirname($target . '/' . $name));
        if (!copy($source . '/' . $name, $target . '/' . $name)) WP_CLI::error('The owned Classic theme copy failed.');
    }
}
switch_theme('macedon-weekender-classic-lab');
update_option('classic-editor-replace', 'classic');
update_option('classic-editor-allow-users', 'disallow');
if (!get_option('composer_weekender_classic_menu')) {
    if (wp_get_nav_menu_object('Weekender classic main')) WP_CLI::error('An existing unregistered menu was preserved.');
    $menu = wp_create_nav_menu('Weekender classic main');
    if (is_wp_error($menu)) WP_CLI::error('The fictional Classic menu could not be created.');
    foreach (['Latest stories' => home_url('/'), 'About the Weekender' => home_url('/about/'), 'The weekend guide' => home_url('/weekend-guide/')] as $title => $url) {
        $item = wp_update_nav_menu_item($menu, 0, ['menu-item-title' => $title, 'menu-item-url' => $url, 'menu-item-type' => 'custom', 'menu-item-status' => 'publish']);
        if (is_wp_error($item)) WP_CLI::error('A fictional Classic menu item could not be created.');
    }
    set_theme_mod('nav_menu_locations', ['primary' => $menu]);
    update_option('composer_weekender_classic_menu', $menu);
}
$post = get_posts(['post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1])[0] ?? null;
WP_CLI::line(json_encode(['wordpress' => get_bloginfo('version'), 'classicEditor' => $plugin['Version'], 'theme' => get_stylesheet(), 'blockTheme' => wp_is_block_theme(), 'blockEditor' => $post ? use_block_editor_for_post($post) : null, 'articleCount' => array_sum((array)wp_count_posts('post')), 'themeFiles' => $expected], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
