<?php
// MIT. Conventional PHP theme for the fictional Classic Editor source.
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'gallery', 'caption']);
    register_nav_menus(['primary' => 'Weekender main navigation']);
});
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('weekender-classic', get_stylesheet_uri(), [], '1.0.0');
});
